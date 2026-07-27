import { apiUrl } from './api'

/** In-flight dedupe for identical POST bodies (helps React Strict Mode + parallel mounts). */
const inflight = new Map()

/** Short TTL cache for read-only bootstrap payloads. */
const ttlCache = new Map()

/** Last successful body + ETag for PHP 304 short-circuit. */
const etagStore = new Map()

/** Server CACHE_VERSION — when it changes, drop client TTL/ETag stores. */
let knownCacheVersion = null

/**
 * Sync with site-config cache_version (bumped on pnpm dev / release).
 * @param {string|null|undefined} version
 */
export function syncApiCacheVersion(version) {
  if (!version) return
  if (knownCacheVersion != null && knownCacheVersion !== version) {
    ttlCache.clear()
    etagStore.clear()
  }
  knownCacheVersion = version
}

function cacheKey(endpoint, body) {
  const params = new URLSearchParams(body)
  // stable key
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  return `${endpoint}?${new URLSearchParams(entries)}`
}

/**
 * POST application/x-www-form-urlencoded to PHP API.
 * @param {string} endpoint e.g. 'skins.php'
 * @param {Record<string, string|number|boolean|null|undefined>} body
 * @param {{ dedupe?: boolean, ttlMs?: number, signal?: AbortSignal }} [opts]
 */
export async function postApi(endpoint, body = {}, opts = {}) {
  const { dedupe = true, ttlMs = 0, signal } = opts
  const payload = {}
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue
    payload[k] = String(v)
  }

  const key = cacheKey(endpoint, payload)

  if (ttlMs > 0) {
    const hit = ttlCache.get(key)
    if (hit && hit.expires > Date.now()) {
      return structuredClone ? structuredClone(hit.data) : JSON.parse(JSON.stringify(hit.data))
    }
  }

  if (dedupe && inflight.has(key)) {
    return inflight.get(key)
  }

  const run = (async () => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const prev = etagStore.get(key)
    if (prev?.etag) {
      headers['If-None-Match'] = prev.etag
    }

    const res = await fetch(apiUrl(endpoint), {
      method: 'POST',
      headers,
      credentials: 'include',
      body: new URLSearchParams(payload),
      signal,
    })

    if (res.status === 304) {
      const cached = etagStore.get(key)?.data ?? ttlCache.get(key)?.data
      if (cached != null) {
        if (ttlMs > 0) {
          ttlCache.set(key, { expires: Date.now() + ttlMs, data: cached })
        }
        return structuredClone
          ? structuredClone(cached)
          : JSON.parse(JSON.stringify(cached))
      }
      throw new Error('Not modified (no local cache)')
    }

    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(text.slice(0, 180) || `HTTP ${res.status}`)
    }
    if (!res.ok || data.error || data.errorDB) {
      const err = new Error(data.error || data.errorDB || `HTTP ${res.status}`)
      err.data = data
      err.status = res.status
      throw err
    }

    const etag = res.headers.get('ETag')
    if (etag) {
      etagStore.set(key, { etag, data })
    }

    if (ttlMs > 0 && res.ok && !data.error && !data.errorDB) {
      ttlCache.set(key, { expires: Date.now() + ttlMs, data })
    }
    return data
  })()

  if (dedupe) {
    inflight.set(key, run)
    run.finally(() => {
      if (inflight.get(key) === run) inflight.delete(key)
    })
  }

  return run
}

/** Drop TTL entries (e.g. after save / reset). */
export function invalidateApiCache(prefix = '') {
  if (!prefix) {
    ttlCache.clear()
    etagStore.clear()
    return
  }
  for (const key of ttlCache.keys()) {
    if (key.startsWith(prefix)) ttlCache.delete(key)
  }
  for (const key of etagStore.keys()) {
    if (key.startsWith(prefix)) etagStore.delete(key)
  }
}
