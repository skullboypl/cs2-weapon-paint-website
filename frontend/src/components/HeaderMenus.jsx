import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nProvider'
import '../styles/HeaderMenus.css'

const LOCALE_META = {
  en: { flagSrc: '/images/flags/en.svg', name: 'English' },
  pl: { flagSrc: '/images/flags/pl.svg', name: 'Polski' },
  de: { flagSrc: '/images/flags/de.svg', name: 'Deutsch' },
  fr: { flagSrc: '/images/flags/fr.svg', name: 'Français' },
  ru: { flagSrc: '/images/flags/ru.svg', name: 'Русский' },
  uk: { flagSrc: '/images/flags/uk.svg', name: 'Українська' },
}

function useIsMobile(query = '(max-width: 767px)') {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [query])
  return mobile
}

function useClickOutside(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose])
}

export function LangDropdown({ compact = false }) {
  const { t, locale, setLocale, locales } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const mobile = useIsMobile()
  const current = LOCALE_META[locale] || LOCALE_META.en

  useClickOutside(rootRef, open && !mobile, () => setOpen(false))

  useEffect(() => {
    if (!(open && mobile)) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, mobile])

  const pick = (code) => {
    setLocale(code)
    setOpen(false)
  }

  const list = (
    <ul className="wp-menu-list" role="listbox" aria-label={t.langLabel}>
      {locales.map((code) => {
        const meta = LOCALE_META[code] || {
          flagSrc: '/images/flags/en.svg',
          name: code.toUpperCase(),
        }
        return (
          <li key={code}>
            <button
              type="button"
              role="option"
              aria-selected={code === locale}
              className={
                code === locale ? 'wp-menu-item is-active' : 'wp-menu-item'
              }
              onClick={() => pick(code)}
            >
              <img
                className="wp-menu-flag"
                src={meta.flagSrc}
                alt=""
                width={18}
                height={12}
                draggable={false}
              />
              <span className="wp-menu-item__label">{meta.name}</span>
              <span className="wp-menu-item__code">{code.toUpperCase()}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="wp-menu wp-lang" ref={rootRef}>
      <button
        type="button"
        className={open ? 'wp-menu-trigger is-open' : 'wp-menu-trigger'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.langLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <img
          className="wp-menu-flag"
          src={current.flagSrc}
          alt=""
          width={18}
          height={12}
          draggable={false}
        />
        {!compact && <span className="wp-lang__name">{current.name}</span>}
        <span className="wp-menu-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && !mobile && <div className="wp-menu-panel wp-lang-panel">{list}</div>}

      {open &&
        mobile &&
        createPortal(
          <div className="wp-sheet" role="dialog" aria-label={t.langLabel}>
            <button
              type="button"
              className="wp-sheet__backdrop"
              aria-label={t.menuClose}
              onClick={() => setOpen(false)}
            />
            <div className="wp-sheet__panel">
              <div className="wp-sheet__head">
                <strong>{t.langLabel}</strong>
                <button type="button" className="wp-sheet__x" onClick={() => setOpen(false)}>
                  ×
                </button>
              </div>
              <div className="wp-sheet__body">{list}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export function HeaderUserMenu({ user, onLogout }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef(null)
  const mobile = useIsMobile()

  useClickOutside(rootRef, open && !mobile, () => setOpen(false))

  useEffect(() => {
    if (!(open && mobile)) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, mobile])

  useEffect(() => {
    if (!copied) return undefined
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  const countryCode = String(user.loccountrycode || '')
    .trim()
    .toUpperCase()
  const steamId = user.steamid ? String(user.steamid) : ''

  const copySteamId = async () => {
    if (!steamId) return
    try {
      await navigator.clipboard.writeText(steamId)
      setCopied(true)
    } catch {
      /* ignore */
    }
  }

  const panel = (
    <>
      <div className="wp-user-head">
        <img
          className="wp-user-head__avatar"
          src={user.avatar}
          alt=""
          width={44}
          height={44}
          draggable={false}
        />
        <div className="wp-user-head__copy">
          <strong>{user.personaname}</strong>
          {user.realname ? <em className="wp-user-realname">{user.realname}</em> : null}
        </div>
      </div>

      <dl className="wp-user-meta">
        {steamId ? (
          <div className="wp-user-meta__row">
            <dt>{t.steamIdLabel}</dt>
            <dd>
              <code className="wp-user-steamid">{steamId}</code>
              <button
                type="button"
                className="wp-user-copy"
                onClick={copySteamId}
                title={t.copySteamId}
              >
                {copied ? t.copied : t.copy}
              </button>
            </dd>
          </div>
        ) : null}
        {countryCode ? (
          <div className="wp-user-meta__row">
            <dt>{t.steamCountryLabel}</dt>
            <dd>
              <span>{countryCode}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="wp-user-links">
        <a
          className="wp-menu-item"
          href={user.profileurl}
          target="_blank"
          rel="noreferrer"
          role="menuitem"
          onClick={() => setOpen(false)}
        >
          {t.viewSteamProfile}
        </a>
      </div>

      <button
        type="button"
        className="wp-user-logout"
        role="menuitem"
        onClick={() => {
          setOpen(false)
          onLogout?.()
        }}
      >
        {t.logout}
      </button>
    </>
  )

  return (
    <div className="wp-menu wp-user" ref={rootRef}>
      <button
        type="button"
        className={open ? 'wp-user-trigger is-open' : 'wp-user-trigger'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.accountMenu}
        onClick={() => setOpen((v) => !v)}
      >
        <img
          className="wp-user-trigger__avatar"
          src={user.avatar}
          alt=""
          width={36}
          height={36}
          draggable={false}
        />
        <span className="wp-user-trigger__name">{user.personaname}</span>
        <span className="wp-menu-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && !mobile && (
        <div className="wp-menu-panel wp-user-panel" role="menu">
          {panel}
        </div>
      )}

      {open &&
        mobile &&
        createPortal(
          <div className="wp-sheet" role="dialog" aria-label={t.accountMenu}>
            <button
              type="button"
              className="wp-sheet__backdrop"
              aria-label={t.menuClose}
              onClick={() => setOpen(false)}
            />
            <div className="wp-sheet__panel">
              <div className="wp-sheet__head">
                <strong>{t.accountMenu}</strong>
                <button type="button" className="wp-sheet__x" onClick={() => setOpen(false)}>
                  ×
                </button>
              </div>
              <div className="wp-sheet__body">{panel}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export function TeamSwitcher({ team, onSelect, onBack }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const mobile = useIsMobile()

  useClickOutside(rootRef, open && !mobile, () => setOpen(false))

  useEffect(() => {
    if (!(open && mobile)) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, mobile])

  if (!team) return null

  const isT = team === 'T'
  const label = isT ? t.teamT : t.teamCt
  const code = isT ? 'T' : 'CT'

  const pick = (next) => {
    setOpen(false)
    if (next !== team) onSelect?.(next)
  }

  const list = (
    <ul className="wp-menu-list" role="listbox" aria-label={t.teamSwitcherLabel}>
      <li>
        <button
          type="button"
          role="option"
          aria-selected={isT}
          className={isT ? 'wp-menu-item wp-team-option is-active is-t' : 'wp-menu-item wp-team-option is-t'}
          onClick={() => pick('T')}
        >
          <span className="wp-team-pill wp-team-pill--t" aria-hidden>
            T
          </span>
          <span className="wp-menu-item__label">{t.teamT}</span>
        </button>
      </li>
      <li>
        <button
          type="button"
          role="option"
          aria-selected={!isT}
          className={
            !isT ? 'wp-menu-item wp-team-option is-active is-ct' : 'wp-menu-item wp-team-option is-ct'
          }
          onClick={() => pick('CT')}
        >
          <span className="wp-team-pill wp-team-pill--ct" aria-hidden>
            CT
          </span>
          <span className="wp-menu-item__label">{t.teamCt}</span>
        </button>
      </li>
      <li className="wp-menu-sep" aria-hidden="true" />
      <li>
        <button
          type="button"
          className="wp-menu-item wp-team-back"
          onClick={() => {
            setOpen(false)
            onBack?.()
          }}
        >
          <span className="wp-menu-item__label">{t.teamBack}</span>
        </button>
      </li>
    </ul>
  )

  return (
    <div className="wp-menu wp-team-switch" ref={rootRef}>
      <button
        type="button"
        className={
          open
            ? `wp-team-trigger is-open wp-team-trigger--${code.toLowerCase()}`
            : `wp-team-trigger wp-team-trigger--${code.toLowerCase()}`
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.teamSwitcherLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`wp-team-pill wp-team-pill--${code.toLowerCase()}`} aria-hidden>
          {code}
        </span>
        <span className="wp-team-trigger__name">{label}</span>
        <span className="wp-menu-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && !mobile && (
        <div className="wp-menu-panel wp-team-panel">{list}</div>
      )}

      {open &&
        mobile &&
        createPortal(
          <div className="wp-sheet" role="dialog" aria-label={t.teamSwitcherLabel}>
            <button
              type="button"
              className="wp-sheet__backdrop"
              aria-label={t.menuClose}
              onClick={() => setOpen(false)}
            />
            <div className="wp-sheet__panel">
              <div className="wp-sheet__head">
                <strong>{t.teamSwitcherLabel}</strong>
                <button type="button" className="wp-sheet__x" onClick={() => setOpen(false)}>
                  ×
                </button>
              </div>
              <div className="wp-sheet__body">{list}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
