import { useState, useEffect } from 'react'
import { apiUrl } from '../lib/api'

const PROFILE_TIMEOUT_MS = 20000

export function useUser() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PROFILE_TIMEOUT_MS)

    fetch(apiUrl('getUserProfile.php'), {
      credentials: 'include',
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = await res.json()
        if (!data.error && data.steamid) {
          setUser(data)
        }
        const url = new URL(window.location.href)
        url.searchParams.delete('steamid')
        url.searchParams.delete('login')
        window.history.replaceState({}, document.title, url.pathname + url.search)
      })
      .catch(() => {
        /* timeout / network - treat as logged out */
      })
      .finally(() => {
        clearTimeout(timer)
        setLoading(false)
      })

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [])

  return { user, loading }
}
