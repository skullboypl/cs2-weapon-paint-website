/** Bazowy URL API bez końcowego slasha. */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_URL || '/api'
  return String(raw).replace(/\/+$/, '') || '/api'
}

/** Składa ścieżkę API: apiUrl('getUserProfile.php') → '/api/getUserProfile.php' */
export function apiUrl(path = '') {
  const base = getApiBase()
  const clean = String(path).replace(/^\/+/, '')
  return clean ? `${base}/${clean}` : base
}
