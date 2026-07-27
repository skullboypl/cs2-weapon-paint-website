import { useCallback, useEffect, useState } from 'react'
import { postApi, invalidateApiCache } from '../lib/postApi'
import { askConfirm, getConfirmState } from '../lib/dialogs'
import { fetchJsonCached } from '../lib/dataCache'
import { buildTeamLoadout, skinIsCustomized } from '../lib/loadoutBuild'
import { getWeaponLabel } from '../lib/weaponDisplay'
import { useI18n } from '../i18n/I18nProvider'
import '../styles/FullLoadoutModal.css'

function TeamSection({
  teamKey,
  label,
  items,
  busy,
  onResetTeam,
  onResetSkin,
  t,
}) {
  return (
    <section
      className={
        teamKey === 'CT'
          ? 'full-loadout__team full-loadout__team--ct'
          : 'full-loadout__team full-loadout__team--t'
      }
    >
      <header className="full-loadout__team-head">
        <div>
          <span className="full-loadout__team-eyebrow">{label}</span>
          <h3 className="full-loadout__team-title">
            {t.fullLoadoutTeamTitle.replace('{team}', label)}
          </h3>
          <p className="full-loadout__team-count">
            {items.length === 0
              ? t.fullLoadoutTeamEmpty
              : t.fullLoadoutTeamCount.replace('{count}', String(items.length))}
          </p>
        </div>
        <button
          type="button"
          className="full-loadout__btn full-loadout__btn--danger"
          disabled={busy || items.length === 0}
          onClick={() => onResetTeam(teamKey)}
          title={t.resetTeamSkinsHint}
        >
          {t.resetTeamSkins}
        </button>
      </header>

      {items.length === 0 ? (
        <p className="full-loadout__empty">{t.fullLoadoutTeamEmpty}</p>
      ) : (
        <ul className="full-loadout__grid">
          {items.map(({ weapon, skinName, defindex, dbSkin }) => {
            const canResetSkin =
              defindex != null &&
              weapon.type !== 'gloves' &&
              weapon.type !== 'music' &&
              weapon.type !== 'pin' &&
              weapon.type !== 'agent' &&
              (weapon.category !== 'Knife' || skinIsCustomized(dbSkin))

            return (
            <li key={`${teamKey}-${weapon.name}-${defindex ?? 'x'}`} className="full-loadout__card">
              <img
                src={weapon.image}
                alt={getWeaponLabel(weapon.name)}
                className="full-loadout__img"
                draggable={false}
                loading="lazy"
              />
              <div className="full-loadout__meta">
                <strong>
                  {getWeaponLabel(weapon.name)}
                  {(weapon.type === 'music' || weapon.type === 'pin') && (
                    <span className="wp-beta-badge wp-beta-badge--inline">{t.betaBadge}</span>
                  )}
                </strong>
                {skinName ? <em>{skinName}</em> : null}
              </div>
              {canResetSkin && (
                <button
                  type="button"
                  className="full-loadout__btn full-loadout__btn--ghost"
                  disabled={busy}
                  onClick={() => onResetSkin(teamKey, defindex)}
                >
                  {t.resetSkin}
                </button>
              )}
              {weapon.type === 'gloves' && Number(weapon.paint) > 0 && (
                <span className="full-loadout__note">{t.fullLoadoutGlovesNote}</span>
              )}
              {(weapon.type === 'music' || weapon.type === 'pin') && (
                <span className="full-loadout__note">{t.fullLoadoutMusicPinNote}</span>
              )}
              {weapon.category === 'Knife' && !canResetSkin && (
                <span className="full-loadout__note">{t.fullLoadoutKnifeNote}</span>
              )}
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function FullLoadoutModal({ open, onClose, onChanged }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [itemsT, setItemsT] = useState([])
  const [itemsCT, setItemsCT] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [weaponsBase, skinMap, glovesJson, musicJson, pinsJson, agentsJson] =
        await Promise.all([
          fetchJsonCached('/weapons.json'),
          fetchJsonCached('/data/skins_en.json'),
          fetchJsonCached('/data/gloves_en.json'),
          fetchJsonCached('/data/music_en.json'),
          fetchJsonCached('/data/collectibles_en.json'),
          fetchJsonCached('/data/agents_en.json'),
        ])

      // One DB connection for T+CT (was 6 parallel PHP requests)
      const boot = await postApi(
        'skins.php',
        { action: 'bootstrap_both', team: 'T' },
        { ttlMs: 3000 },
      )
      if (boot?.errorDB) throw new Error(boot.errorDB)

      const glovesData = boot.gloves || { gloves_models: [], gloves_skins: [] }
      const rowsT = Array.isArray(boot.t?.skins) ? boot.t.skins : []
      const rowsCT = Array.isArray(boot.ct?.skins) ? boot.ct.skins : []

      setItemsT(
        buildTeamLoadout({
          weaponsBase,
          skinsRows: rowsT,
          skinMap,
          glovesJson,
          glovesData,
          knifeEquipped: boot.t?.knife || 'weapon_knife',
          team: 'T',
          musicJson,
          pinsJson,
          musicId: boot.t?.music_id ?? null,
          pinId: boot.t?.pin_id ?? null,
          agentModel: boot.agents?.agent_t ?? null,
          agentsJson,
        }),
      )
      setItemsCT(
        buildTeamLoadout({
          weaponsBase,
          skinsRows: rowsCT,
          skinMap,
          glovesJson,
          glovesData,
          knifeEquipped: boot.ct?.knife || 'weapon_knife',
          team: 'CT',
          musicJson,
          pinsJson,
          musicId: boot.ct?.music_id ?? null,
          pinId: boot.ct?.pin_id ?? null,
          agentModel: boot.agents?.agent_ct ?? null,
          agentsJson,
        }),
      )
    } catch (err) {
      console.error(err)
      setError(err.message || String(err))
      setItemsT([])
      setItemsCT([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    load()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (getConfirmState()) return
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, load, onClose])

  if (!open) return null

  const handleResetTeam = async (teamKey) => {
    const label = teamKey === 'CT' ? t.teamCtShort : t.teamTShort
    const ok = await askConfirm({
      title: t.resetTeamSkins,
      message: t.resetTeamSkinsConfirm.replace('{team}', label),
      confirmLabel: t.resetTeamSkins,
      cancelLabel: t.cancel,
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await postApi('skins.php', { action: 'reset_team', team: teamKey })
      invalidateApiCache('skins.php')
      await load()
      onChanged?.()
    } catch (err) {
      console.error(err)
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleResetBoth = async () => {
    const ok = await askConfirm({
      title: t.resetBothTeams,
      message: t.resetBothTeamsConfirm,
      confirmLabel: t.resetBothTeams,
      cancelLabel: t.cancel,
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await postApi('skins.php', { action: 'reset_both', team: 'T' })
      invalidateApiCache('skins.php')
      await load()
      onChanged?.()
    } catch (err) {
      console.error(err)
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleResetSkin = async (teamKey, defindex) => {
    const ok = await askConfirm({
      title: t.resetSkin,
      message: t.resetSkinConfirm,
      confirmLabel: t.resetSkin,
      cancelLabel: t.cancel,
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await postApi('skins.php', {
        action: 'reset',
        team: teamKey,
        weapon_defindex: String(defindex),
      })
      invalidateApiCache('skins.php')
      await load()
      onChanged?.()
    } catch (err) {
      console.error(err)
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const total = itemsT.length + itemsCT.length

  return (
    <div className="full-loadout" role="dialog" aria-modal="true" aria-label={t.fullLoadoutTitle}>
      <button type="button" className="full-loadout__backdrop" aria-label={t.close} onClick={onClose} />
      <div className="full-loadout__panel">
        <header className="full-loadout__head">
          <div>
            <p className="full-loadout__eyebrow">{t.fullLoadoutEyebrow}</p>
            <h2 className="full-loadout__title">{t.fullLoadoutTitle}</h2>
            <p className="full-loadout__hint">{t.fullLoadoutHint}</p>
          </div>
          <div className="full-loadout__head-actions">
            <button
              type="button"
              className="full-loadout__btn full-loadout__btn--danger-strong"
              disabled={busy || loading || total === 0}
              onClick={handleResetBoth}
              title={t.resetBothTeamsHint}
            >
              {t.resetBothTeams}
            </button>
            <button type="button" className="full-loadout__btn" onClick={onClose}>
              {t.close}
            </button>
          </div>
        </header>

        {error && <p className="full-loadout__error">{error}</p>}
        {loading ? (
          <p className="full-loadout__loading">{t.fullLoadoutLoading}</p>
        ) : (
          <div className="full-loadout__body">
            <TeamSection
              teamKey="T"
              label={t.teamTShort}
              items={itemsT}
              busy={busy}
              onResetTeam={handleResetTeam}
              onResetSkin={handleResetSkin}
              t={t}
            />
            <TeamSection
              teamKey="CT"
              label={t.teamCtShort}
              items={itemsCT}
              busy={busy}
              onResetTeam={handleResetTeam}
              onResetSkin={handleResetSkin}
              t={t}
            />
          </div>
        )}
      </div>
    </div>
  )
}
