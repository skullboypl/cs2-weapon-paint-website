import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { postApi, invalidateApiCache } from '../lib/postApi'
import { askConfirm, showToast } from '../lib/dialogs'
import { fetchJsonCached } from '../lib/dataCache'
import { useI18n } from '../i18n/I18nProvider'
import '../styles/Loadouts.css'

function teamLabel(weaponTeam, t) {
  if (weaponTeam === 2 || weaponTeam === '2') return 'T'
  if (weaponTeam === 3 || weaponTeam === '3') return 'CT'
  return t.loadoutBoth
}

function resolveThumb(skinsCatalog, defindex, paintId, fallbackUrl) {
  if (fallbackUrl && fallbackUrl !== 'pending') return fallbackUrl
  if (!skinsCatalog?.length || defindex == null) return null
  const hit = skinsCatalog.find(
    (s) =>
      Number(s.weapon_defindex) === Number(defindex) &&
      Number(s.paint) === Number(paintId ?? 0),
  )
  return hit?.image || null
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

export default function LoadoutsPanel({ team, onApplied }) {
  const { t } = useI18n()
  const rootRef = useRef(null)
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('mine') // mine | public
  const [loadouts, setLoadouts] = useState([])
  const [publicLoadouts, setPublicLoadouts] = useState([])
  const [skinsCatalog, setSkinsCatalog] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState('team')
  const [isPublic, setIsPublic] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [thumbKey, setThumbKey] = useState(null)

  const refreshMine = useCallback(async () => {
    const data = await postApi('loadouts.php', { action: 'list' }, { ttlMs: 5000 })
    setLoadouts(data.loadouts || [])
  }, [])

  const refreshPublic = useCallback(async () => {
    const data = await postApi(
      'loadouts.php',
      { action: 'list_public', limit: '40' },
      { ttlMs: 8000 },
    )
    setPublicLoadouts(data.loadouts || [])
  }, [])

  // Prefetch mine list for the header badge count (not only when dropdown opens)
  useEffect(() => {
    fetchJsonCached('/data/skins_en.json').then(setSkinsCatalog).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshMine()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMine])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await refreshMine()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, refreshMine])

  useEffect(() => {
    if (!open || tab !== 'public') return undefined
    let cancelled = false
    ;(async () => {
      try {
        await refreshPublic()
        if (!cancelled) setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, tab, refreshPublic])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (!mobile) document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, mobile])

  useEffect(() => {
    if (!(open && mobile)) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, mobile])

  useEffect(() => {
    if (!saveOpen) return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      ;(async () => {
        try {
          const data = await postApi(
            'loadouts.php',
            {
              action: 'candidates',
              scope,
              team: team || 'T',
            },
            { ttlMs: 4000 },
          )
          if (cancelled) return
          const skins = data.skins || []
          setCandidates(skins)
          if (skins.length) {
            const first = skins[0]
            setThumbKey(
              `${first.weapon_team}:${first.weapon_defindex}:${first.weapon_paint_id}`,
            )
          } else {
            setThumbKey(null)
          }
        } catch (e) {
          if (!cancelled) setError(e.message)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [saveOpen, scope, team])

  const openSave = () => {
    setOpen(false)
    setName('')
    setScope('team')
    setIsPublic(false)
    setError(null)
    setSaveOpen(true)
  }

  const selectedThumb = useMemo(() => {
    if (!thumbKey) return null
    return candidates.find(
      (c) =>
        `${c.weapon_team}:${c.weapon_defindex}:${c.weapon_paint_id}` === thumbKey,
    )
  }, [candidates, thumbKey])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const thumbUrl = selectedThumb
        ? resolveThumb(
            skinsCatalog,
            selectedThumb.weapon_defindex,
            selectedThumb.weapon_paint_id,
            null,
          )
        : null
      await postApi('loadouts.php', {
        action: 'save',
        name: name.trim(),
        scope,
        team: team || 'T',
        is_public: isPublic ? '1' : '0',
        thumb_url: thumbUrl || 'pending',
        thumb_defindex: selectedThumb?.weapon_defindex ?? '',
        thumb_paint_id: selectedThumb?.weapon_paint_id ?? '',
      })
      invalidateApiCache('loadouts.php')
      setSaveOpen(false)
      await refreshMine()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleApply = async (id) => {
    const ok = await askConfirm({
      title: t.loadoutApply,
      message: t.loadoutApplyConfirm,
      confirmLabel: t.loadoutApply,
      cancelLabel: t.cancel,
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await postApi('loadouts.php', { action: 'apply', id: String(id) })
      invalidateApiCache('skins.php')
      setOpen(false)
      await refreshMine()
      onApplied?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await askConfirm({
      title: t.loadoutDelete,
      message: t.loadoutDeleteConfirm,
      confirmLabel: t.loadoutDelete,
      cancelLabel: t.cancel,
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await postApi('loadouts.php', { action: 'delete', id: String(id) })
      invalidateApiCache('loadouts.php')
      await refreshMine()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePublic = async (item) => {
    const next = Number(item.is_public) === 1 ? 0 : 1
    setBusy(true)
    setError(null)
    try {
      await postApi('loadouts.php', {
        action: 'set_public',
        id: String(item.id),
        is_public: String(next),
      })
      invalidateApiCache('loadouts.php')
      setLoadouts((prev) =>
        prev.map((row) =>
          Number(row.id) === Number(item.id) ? { ...row, is_public: next } : row,
        ),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async (id) => {
    const ok = await askConfirm({
      title: t.loadoutCopy,
      message: t.loadoutCopyConfirm,
      confirmLabel: t.loadoutCopy,
      cancelLabel: t.cancel,
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const data = await postApi('loadouts.php', { action: 'copy', id: String(id) })
      invalidateApiCache('loadouts.php')
      await refreshMine()
      setTab('mine')
      showToast(t.loadoutCopyDone.replace('{name}', data.name || ''))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const renderRow = (item, { mine }) => {
    const src = resolveThumb(
      skinsCatalog,
      item.thumb_defindex,
      item.thumb_paint_id,
      item.thumb_url,
    )
    const badge =
      item.scope === 'both' ? t.loadoutBoth : teamLabel(item.weapon_team, t)
    const publicOn = Number(item.is_public) === 1

    return (
      <li key={item.id} className="wp-loadouts-menu__row">
        <div className="wp-loadouts-menu__thumb">
          {src ? (
            <img src={src} alt="" draggable={false} />
          ) : (
            <span className="wp-loadouts__thumb-fallback" />
          )}
        </div>
        <div className="wp-loadouts-menu__meta">
          <strong>{item.name}</strong>
          <span className="wp-loadouts-menu__badges">
            <span
              className={
                item.scope === 'both'
                  ? 'wp-loadouts__badge wp-loadouts__badge--both'
                  : `wp-loadouts__badge wp-loadouts__badge--${badge.toLowerCase()}`
              }
            >
              {badge}
            </span>
            {mine && publicOn && (
              <span className="wp-loadouts__badge wp-loadouts__badge--public">
                {t.loadoutPublicBadge}
              </span>
            )}
            {!mine && item.owner_name && (
              <span className="wp-loadouts__owner" title={item.owner_name}>
                {item.owner_name}
              </span>
            )}
          </span>
        </div>
        <div className="wp-loadouts-menu__row-actions">
          {mine ? (
            <>
              <button
                type="button"
                className="wp-loadouts__btn"
                disabled={busy}
                onClick={() => handleApply(item.id)}
              >
                {t.loadoutApply}
              </button>
              <button
                type="button"
                className={
                  publicOn
                    ? 'wp-loadouts__btn wp-loadouts__btn--public is-on'
                    : 'wp-loadouts__btn wp-loadouts__btn--public'
                }
                disabled={busy}
                onClick={() => handleTogglePublic(item)}
                title={publicOn ? t.loadoutMakePrivate : t.loadoutMakePublic}
              >
                {publicOn ? t.loadoutPublicOn : t.loadoutPublicOff}
              </button>
              <button
                type="button"
                className="wp-loadouts__btn wp-loadouts__btn--danger"
                disabled={busy}
                onClick={() => handleDelete(item.id)}
              >
                {t.loadoutDelete}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="wp-loadouts__btn wp-loadouts__btn--primary"
              disabled={busy}
              onClick={() => handleCopy(item.id)}
            >
              {t.loadoutCopy}
            </button>
          )}
        </div>
      </li>
    )
  }

  const listBody = (
    <>
      <div className="wp-loadouts-menu__top">
        <p className="wp-loadouts-menu__hint">
          {tab === 'mine' ? t.loadoutsHint : t.loadoutsPublicHint}
        </p>
        {tab === 'mine' && (
          <button
            type="button"
            className="wp-loadouts__btn wp-loadouts__btn--primary"
            onClick={openSave}
            disabled={busy}
          >
            {t.loadoutSave}
          </button>
        )}
      </div>

      <div className="wp-loadouts-tabs" role="tablist" aria-label={t.loadoutsTitle}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? 'wp-loadouts-tabs__btn is-active' : 'wp-loadouts-tabs__btn'}
          onClick={() => setTab('mine')}
        >
          {t.loadoutsTabMine}
          <em>{loadouts.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'public'}
          className={tab === 'public' ? 'wp-loadouts-tabs__btn is-active' : 'wp-loadouts-tabs__btn'}
          onClick={() => setTab('public')}
        >
          {t.loadoutsTabPublic}
          <em>{publicLoadouts.length}</em>
        </button>
      </div>

      {error && <p className="wp-loadouts__error">{error}</p>}

      {tab === 'mine' ? (
        loadouts.length === 0 ? (
          <p className="wp-loadouts__empty">{t.loadoutEmpty}</p>
        ) : (
          <ul className="wp-loadouts-menu__list">
            {loadouts.map((item) => renderRow(item, { mine: true }))}
          </ul>
        )
      ) : publicLoadouts.length === 0 ? (
        <p className="wp-loadouts__empty">{t.loadoutPublicEmpty}</p>
      ) : (
        <ul className="wp-loadouts-menu__list">
          {publicLoadouts.map((item) => renderRow(item, { mine: false }))}
        </ul>
      )}
    </>
  )

  return (
    <div className="wp-menu wp-loadouts-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? 'wp-menu-trigger is-open' : 'wp-menu-trigger'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.loadoutsTitle}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="wp-loadouts-menu__icon" aria-hidden>
          ⧉
        </span>
        <span className="wp-loadouts-menu__label">{t.loadoutsShort}</span>
        <span className="wp-loadouts-menu__count">{loadouts.length}</span>
        <span className="wp-menu-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && !mobile && (
        <div className="wp-menu-panel wp-loadouts-panel" role="menu">
          {listBody}
        </div>
      )}

      {open &&
        mobile &&
        createPortal(
          <div className="wp-sheet" role="dialog" aria-label={t.loadoutsTitle}>
            <button
              type="button"
              className="wp-sheet__backdrop"
              aria-label={t.menuClose}
              onClick={() => setOpen(false)}
            />
            <div className="wp-sheet__panel">
              <div className="wp-sheet__head">
                <strong>{t.loadoutsTitle}</strong>
                <button type="button" className="wp-sheet__x" onClick={() => setOpen(false)}>
                  ×
                </button>
              </div>
              <div className="wp-sheet__body">{listBody}</div>
            </div>
          </div>,
          document.body,
        )}

      {saveOpen && (
        <div
          className="wp-loadouts-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t.loadoutSave}
        >
          <form className="wp-loadouts-modal__panel" onSubmit={handleSave}>
            <h3 className="wp-loadouts-modal__title">{t.loadoutSave}</h3>

            <label className="wp-loadouts-modal__field">
              <span>{t.loadoutName}</span>
              <input
                type="text"
                maxLength={48}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.loadoutNamePlaceholder}
                required
                autoFocus
              />
            </label>

            <fieldset className="wp-loadouts-modal__scope">
              <legend>{t.loadoutScope}</legend>
              <label>
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'team'}
                  onChange={() => setScope('team')}
                />
                {t.loadoutScopeTeam} ({team})
              </label>
              <label>
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'both'}
                  onChange={() => setScope('both')}
                />
                {t.loadoutScopeBoth}
              </label>
            </fieldset>

            <label className="wp-loadouts-modal__public">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>
                <strong>{t.loadoutPublic}</strong>
                <em>{t.loadoutPublicHint}</em>
              </span>
            </label>

            <div className="wp-loadouts-modal__thumbs">
              <span className="wp-loadouts-modal__label">{t.loadoutThumb}</span>
              {candidates.length === 0 ? (
                <p className="wp-loadouts__empty">{t.loadoutNoSkins}</p>
              ) : (
                <div className="wp-loadouts-modal__thumb-grid">
                  {candidates.map((c) => {
                    const key = `${c.weapon_team}:${c.weapon_defindex}:${c.weapon_paint_id}`
                    const src = resolveThumb(
                      skinsCatalog,
                      c.weapon_defindex,
                      c.weapon_paint_id,
                      null,
                    )
                    return (
                      <button
                        key={key}
                        type="button"
                        className={
                          thumbKey === key
                            ? 'wp-loadouts-modal__pick is-active'
                            : 'wp-loadouts-modal__pick'
                        }
                        onClick={() => setThumbKey(key)}
                      >
                        {src ? (
                          <img src={src} alt="" draggable={false} />
                        ) : (
                          <span>{c.weapon_paint_id}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {error && <p className="wp-loadouts__error">{error}</p>}

            <div className="wp-loadouts-modal__footer">
              <button
                type="button"
                className="wp-loadouts__btn"
                onClick={() => setSaveOpen(false)}
                disabled={busy}
              >
                {t.menuClose}
              </button>
              <button
                type="submit"
                className="wp-loadouts__btn wp-loadouts__btn--primary"
                disabled={busy || !name.trim()}
              >
                {t.loadoutSave}
              </button>
            </div>
          </form>
          <button
            type="button"
            className="wp-loadouts-modal__backdrop"
            aria-label={t.menuClose}
            onClick={() => setSaveOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
