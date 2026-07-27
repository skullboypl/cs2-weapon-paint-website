import { apiUrl } from './api'
import { syncApiCacheVersion } from './postApi'

let cached = null
let inflight = null

/** @returns {Promise<{ beta_3d: boolean, cache_version: string|null }>} */
export function loadSiteConfig() {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight

  inflight = fetch(apiUrl('site-config.php'), { credentials: 'include' })
    .then((res) => res.json())
    .then((data) => {
      const cache_version =
        typeof data?.cache_version === 'string' && data.cache_version
          ? data.cache_version
          : null
      syncApiCacheVersion(cache_version)
      cached = {
        beta_3d: Boolean(data?.beta_3d),
        cache_version,
      }
      return cached
    })
    .catch(() => {
      cached = { beta_3d: false, cache_version: null }
      return cached
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
