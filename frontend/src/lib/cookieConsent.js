export const COOKIE_CONSENT_STORAGE_KEY = 'wp:cookie-consent-v1'
export const COOKIE_CONSENT_COOKIE_NAME = 'wp_cookie_consent'
export const COOKIE_CONSENT_VERSION = 1

/** Chrome limituje cookies do ~400 dni - to górny sensowny limit „jak najdłużej”. */
export const COOKIE_CONSENT_MAX_AGE_SEC = 60 * 60 * 24 * 400

function isSecureContext() {
  return typeof window !== 'undefined' && window.location?.protocol === 'https:'
}

function readRawCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'),
  )
  return match ? decodeURIComponent(match[1]) : null
}

function writeRawCookie(name, value, maxAgeSec) {
  if (typeof document === 'undefined') return
  const secure = isSecureContext() ? '; Secure' : ''
  document.cookie =
    `${name}=${encodeURIComponent(value)}` +
    `; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`
}

function parseChoice(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.version !== COOKIE_CONSENT_VERSION || parsed.essential !== true) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function readCookieConsent() {
  // 1) localStorage (trwałe do wyczyszczenia danych)
  try {
    const fromLs = parseChoice(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))
    if (fromLs) {
      // odnów Max-Age cookie przy każdym odczycie (sliding)
      writeRawCookie(
        COOKIE_CONSENT_COOKIE_NAME,
        JSON.stringify(fromLs),
        COOKIE_CONSENT_MAX_AGE_SEC,
      )
      return fromLs
    }
  } catch {
    /* private mode */
  }

  // 2) fallback: długowieczne cookie (gdy LS niedostępne / wyczyszczone osobno)
  const fromCookie = parseChoice(readRawCookie(COOKIE_CONSENT_COOKIE_NAME))
  if (fromCookie) {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(fromCookie))
    } catch {
      /* ignore */
    }
    writeRawCookie(
      COOKIE_CONSENT_COOKIE_NAME,
      JSON.stringify(fromCookie),
      COOKIE_CONSENT_MAX_AGE_SEC,
    )
  }
  return fromCookie
}

export function writeCookieConsent(analytics = false) {
  const choice = {
    version: COOKIE_CONSENT_VERSION,
    essential: true,
    analytics: Boolean(analytics),
    decidedAt: new Date().toISOString(),
    expiresHint: '400d',
  }
  const raw = JSON.stringify(choice)

  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, raw)
  } catch {
    /* private mode */
  }

  writeRawCookie(COOKIE_CONSENT_COOKIE_NAME, raw, COOKIE_CONSENT_MAX_AGE_SEC)

  return choice
}

export const COOKIE_INVENTORY = [
  {
    id: 'wp-session',
    name: 'wp_session',
    category: 'essential',
    purposeKey: 'cookieSessionPurpose',
    durationKey: 'cookieSessionDuration',
  },
  {
    id: 'consent-ls',
    name: COOKIE_CONSENT_STORAGE_KEY,
    category: 'essential',
    purposeKey: 'cookieConsentPurpose',
    durationKey: 'cookieConsentDuration',
  },
  {
    id: 'consent-cookie',
    name: COOKIE_CONSENT_COOKIE_NAME,
    category: 'essential',
    purposeKey: 'cookieConsentCookiePurpose',
    durationKey: 'cookieConsentCookieDuration',
  },
  {
    id: 'locale',
    name: 'wp_locale',
    category: 'functional',
    purposeKey: 'cookieLocalePurpose',
    durationKey: 'cookieLocaleDuration',
  },
]
