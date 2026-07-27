import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { apiUrl } from '../lib/api'
import MapBackdrop from './MapBackdrop'
import { LangDropdown } from './HeaderMenus'
import SkinShowcase from './SkinShowcase'
import SiteFooter from './SiteFooter'
import '../styles/Login.css'

export default function Login() {
  const { t } = useI18n()
  const [showSafety, setShowSafety] = useState(false)
  const titleId = useId()

  useEffect(() => {
    document.body.classList.add('login-page')
    return () => document.body.classList.remove('login-page')
  }, [])

  useEffect(() => {
    if (!showSafety) return
    const onKey = (e) => {
      if (e.key === 'Escape') setShowSafety(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSafety])

  const handleSteamLogin = () => {
    window.location.href = apiUrl('login-steam.php')
  }

  return (
    <div className="login-shell">
      <MapBackdrop />

      <div className="login-panel" role="main">
        <header className="login-panel__head">
          <div className="login-panel__brand">
            <img
              className="login-panel__emblem"
              src="/images/wp-emblem.svg"
              width={36}
              height={36}
              alt=""
              draggable={false}
            />
            <span>{t.brand}</span>
          </div>
          <LangDropdown compact />
        </header>

        <div className="login-panel__grid">
          <section className="login-col login-col--main">
            <h1 className="login-col__label">{t.signInHeading}</h1>
            <p className="login-col__tagline">{t.tagline}</p>

            <button
              type="button"
              className="login-steam-btn"
              onClick={handleSteamLogin}
              aria-label={t.steamAria}
            >
              <img
                src="/images/Steam_icon_logo.svg"
                alt=""
                width={28}
                height={28}
                draggable={false}
              />
              <span>{t.steamCta}</span>
            </button>

            <button
              type="button"
              className="login-help"
              onClick={() => setShowSafety(true)}
            >
              {t.safetyLink}
            </button>
          </section>

          <section className="login-col login-col--side" aria-label={t.sideHeading}>
            <h2 className="login-col__label">{t.sideHeading}</h2>
            <div className="login-side-card">
              <SkinShowcase />
              <p className="login-side-card__hint">{t.sideHint}</p>
              <ul className="login-side-card__list">
                {t.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <SiteFooter variant="login" />
      </div>

      {showSafety && (
        <div
          className="login-modal-bg"
          onClick={() => setShowSafety(false)}
          role="presentation"
        >
          <div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId}>{t.safetyTitle}</h2>
            <ul>
              {t.safetyItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              <li>
                {t.safetyDocs}:{' '}
                <a
                  href="https://steamcommunity.com/dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Steam Web API
                </a>
              </li>
            </ul>
            <button
              type="button"
              className="login-modal__close"
              onClick={() => setShowSafety(false)}
            >
              {t.safetyClose}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
