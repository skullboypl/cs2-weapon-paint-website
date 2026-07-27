import { createContext, useContext, useEffect, useState } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALES,
  STORAGE_KEY,
  translations,
} from './translations'

const I18nContext = createContext(null)

function resolveInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALES.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(resolveInitialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* ignore */
    }
  }, [locale])

  const setLocale = (next) => {
    if (!LOCALES.includes(next)) return
    setLocaleState(next)
  }

  const t = translations[locale] ?? translations[DEFAULT_LOCALE]

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, locales: LOCALES }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
