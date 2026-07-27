/** Register Weapon Paints service worker (PWA). */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Pick up a waiting worker after navigations / builds
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready - activate on next load
              worker.postMessage?.({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[PWA] SW register failed:', err)
      })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register)
}
