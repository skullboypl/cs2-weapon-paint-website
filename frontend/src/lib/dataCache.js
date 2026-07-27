/** In-memory + sessionStorage cache for JSON catalogs. */

const mem = new Map()
const PREFIX = 'wp_json_v3:'

function fromSession(url) {
  try {
    const raw = sessionStorage.getItem(PREFIX + url)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toSession(url, data) {
  try {
    sessionStorage.setItem(PREFIX + url, JSON.stringify(data))
  } catch {
    /* quota */
  }
}

export function fetchJsonCached(url) {
  if (mem.has(url)) return mem.get(url)

  const cached = fromSession(url)
  if (cached != null) {
    const resolved = Promise.resolve(cached)
    mem.set(url, resolved)
    // soft revalidate
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        toSession(url, data)
        mem.set(url, Promise.resolve(data))
      })
      .catch(() => {})
    return resolved
  }

  const pending = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((data) => {
      toSession(url, data)
      mem.set(url, Promise.resolve(data))
      return data
    })
    .catch((err) => {
      mem.delete(url)
      throw err
    })

  mem.set(url, pending)
  return pending
}

const CATALOG_URLS = [
  '/weapons.json',
  '/data/skins_en.json',
  '/data/agents_en.json',
  '/data/gloves_en.json',
  '/data/wp3d-available.json',
]

export function prefetchWeaponCatalogs() {
  return Promise.allSettled(CATALOG_URLS.map((url) => fetchJsonCached(url)))
}

export function preloadImages(urls, { concurrency = 8, limit = 48 } = {}) {
  const list = Array.from(new Set((urls || []).filter(Boolean))).slice(0, limit)
  if (!list.length) return Promise.resolve()

  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (i < list.length) {
      const url = list[i++]
      await new Promise((resolve) => {
        const img = new Image()
        img.onload = img.onerror = () => resolve()
        img.src = url
      })
    }
  })
  return Promise.all(workers)
}

export function preloadImagesIdle(urls, opts) {
  const run = () => {
    preloadImages(urls, opts)
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 1200 })
  } else {
    setTimeout(run, 40)
  }
}
