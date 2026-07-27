import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import {
  COOKIE_INVENTORY,
  readCookieConsent,
  writeCookieConsent,
} from '../lib/cookieConsent'
import '../styles/CookieConsent.css'

function CookieGlyph() {
  return (
    <svg
      className="cookie-dock__glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-4-4 4 4 0 0 1-4-4 6 6 0 0 1-2-2Z" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="15" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function CookieConsent() {
  const { t } = useI18n()
  const panelId = useId()
  const [mounted, setMounted] = useState(false)
  const [hasChoice, setHasChoice] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const decided = readCookieConsent() != null
    setHasChoice(decided)
    setOpen(!decided)
    setMounted(true)
  }, [])

  if (!mounted) return null

  const decide = (analytics) => {
    writeCookieConsent(analytics)
    setHasChoice(true)
    setOpen(false)
  }

  return (
    <div className="cookie-dock">
      {open && (
        <div
          id={panelId}
          className="cookie-dock__panel"
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          aria-describedby={`${panelId}-desc`}
        >
          <div className="cookie-dock__head">
            <span className="cookie-dock__icon">
              <CookieGlyph />
            </span>
            <div>
              <p id={`${panelId}-title`} className="cookie-dock__title">
                {t.cookieTitle}
              </p>
              <p id={`${panelId}-desc`} className="cookie-dock__desc">
                {t.cookieDesc}
              </p>
            </div>
          </div>

          <ul className="cookie-dock__list">
            {COOKIE_INVENTORY.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{t[item.purposeKey]}</span>
                <em>{t[item.durationKey]}</em>
              </li>
            ))}
          </ul>

          <div className="cookie-dock__actions">
            <button
              type="button"
              className="cookie-dock__btn cookie-dock__btn--ghost"
              onClick={() => decide(false)}
            >
              {t.cookieEssential}
            </button>
            <button
              type="button"
              className="cookie-dock__btn cookie-dock__btn--primary"
              onClick={() => decide(false)}
            >
              {t.cookieAccept}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={
          hasChoice
            ? 'cookie-dock__fab'
            : 'cookie-dock__fab cookie-dock__fab--pending'
        }
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t.cookieSettings}
        onClick={() => setOpen((v) => !v)}
      >
        <CookieGlyph />
      </button>
    </div>
  )
}
