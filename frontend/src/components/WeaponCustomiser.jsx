import React, { useEffect, useState, useCallback, useDeferredValue, useMemo } from 'react'
import './../styles/WeaponCustomizer.css'
import StickerPopup from './StickerPopupUI'
import KeychainPopup from './KeychainPopup'
import StickerPlacementPanel from './StickerPlacementPanel'
import Weapon3DPreview, { Weapon3DTour } from './Weapon3DPreview'
import { useI18n } from '../i18n/I18nProvider'
import { getWeaponLabel, resolveWeaponDefindex } from '../lib/weaponDisplay'
import { loadWp3dManifest, skinHas3dPreview } from '../lib/wp3dAvailability'
import {
  emptyStickerSlots,
  mergeStickerWithCatalog,
  STICKER_SLOT_COUNT,
} from '../lib/stickerFormat'
import { loadSiteConfig } from '../lib/siteConfig'
import { askConfirm } from '../lib/dialogs'
import '../styles/Weapon3DPreview.css'

export default function WeaponCustomizer({ weapon, onClose, onSave, onReset }) {
  const { t } = useI18n()
  const [skins, setSkins] = useState([])
  const [selectedSkin, setSelectedSkin] = useState(null)
  const [wear, setWear] = useState(0)
  const [seed, setSeed] = useState(0)
  const [nametag, setNametag] = useState('')
  const [statTrakEnabled, setStatTrakEnabled] = useState(false)
  const [statTrakKills, setStatTrakKills] = useState(0)
  const [keychains, setKeychains] = useState([])
  const [keychainId, setKeychainId] = useState('')
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [offsetZ, setOffsetZ] = useState(0)
  const [keychainSeed, setKeychainSeed] = useState(0)
  const [applyBothTeams, setApplyBothTeams] = useState(true)
  const [stickers, setStickers] = useState([])
  const [selectedStickers, setSelectedStickers] = useState(() => emptyStickerSlots())
  const [activeStickerSlot, setActiveStickerSlot] = useState(0)
  const [showStickerPopup, setShowStickerPopup] = useState(false)
  const [showKeychainPopup, setShowKeychainPopup] = useState(false)
  const [previewMode, setPreviewMode] = useState('2d')
  const [wp3d, setWp3d] = useState(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [beta3d, setBeta3d] = useState(false)
  const [skinSearch, setSkinSearch] = useState('')
  const deferredSkinSearch = useDeferredValue(skinSearch)

  const isKnife = weapon.name.includes('knife') || weapon.name.includes('bayonet')
  const isAgent = weapon.name.includes('agent')
  const isGloves = weapon.name.includes('gloves')
  const isMusic = weapon.name.includes('music')
  const isPin = weapon.name.includes('pin')
  const isCustom = weapon.category === 'Other'

  useEffect(() => {
    let cancelled = false
    loadSiteConfig().then((cfg) => {
      if (!cancelled) setBeta3d(Boolean(cfg.beta_3d))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadWp3dManifest().then((data) => {
      if (!cancelled) setWp3d(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setPreviewMode('2d')
    setSkinSearch('')
    if (isMusic || isPin) setApplyBothTeams(true)
  }, [weapon, isMusic, isPin])

  useEffect(() => {
    if (!beta3d && previewMode === '3d') {
      setPreviewMode('2d')
    }
  }, [beta3d, previewMode])

  useEffect(() => {
    if (!isCustom) return
    if (isAgent) {
      weapon.custom = 'agent'
    } else if (isGloves) {
      weapon.custom = 'gloves'
    } else if (isMusic) {
      weapon.custom = 'music'
    } else if (isPin) {
      weapon.custom = 'pin'
    } else {
      weapon.custom = 'other'
    }
  }, [weapon, isCustom, isAgent, isGloves, isMusic, isPin])

  useEffect(() => {
    if (isCustom) return
    fetch('/data/skins_en.json')
      .then((res) => res.json())
      .then((data) => {
        const matchingSkins = data.filter((s) => s.weapon_name.endsWith(weapon.name))
        matchingSkins.forEach((skin, index) => {
          skin.key = `skin_${skin.paint}_${index}`
        })
        setSkins(matchingSkins)
        const selected = matchingSkins.find(
          (skin) => Number(skin.paint) === Number(weapon.savedPaint),
        )
        setSelectedSkin(selected || null)
      })

    fetch('/data/keychains_en.json')
      .then((res) => res.json())
      .then(setKeychains)

    fetch('/data/stickers_en.json')
      .then((res) => res.json())
      .then(setStickers)
  }, [weapon, isCustom])

  useEffect(() => {
    if (isCustom) return
    setWear(weapon.savedWear ?? 0)
    setSeed(weapon.savedSeed ?? 0)
    setNametag(weapon.savedNametag ?? '')
    setStatTrakEnabled(weapon.savedStatTrakEnabled ?? false)
    setStatTrakKills(weapon.savedStatTrakKills ?? 0)
    setKeychainId(weapon.savedKeychainId ?? '')
    setOffsetX(weapon.savedKeychainOffsetX ?? 0)
    setOffsetY(weapon.savedKeychainOffsetY ?? 0)
    setOffsetZ(weapon.savedKeychainOffsetZ ?? 0)
    setKeychainSeed(weapon.savedKeychainSeed ?? 0)
  }, [weapon, isCustom])

  useEffect(() => {
    if (isCustom) return
    if (!stickers.length) return
    const saved = weapon.savedStickers
    if (!saved || !Array.isArray(saved)) {
      setSelectedStickers(emptyStickerSlots())
      return
    }
    const converted = Array.from({ length: STICKER_SLOT_COUNT }, (_, i) => {
      const placement = saved[i]
      if (!placement) return null
      const catalog = stickers.find((st) => Number(st.id) === Number(placement.id))
      return mergeStickerWithCatalog(
        typeof placement === 'object' && placement.id
          ? placement
          : { id: placement, schema: 0, x: 0, y: 0, wear: 0, scale: 1, rotation: 0 },
        catalog,
      )
    })
    setSelectedStickers(converted)
  }, [stickers, weapon, isCustom])

  useEffect(() => {
    if (isCustom) return
    if (!isKnife) {
      setKeychainId(weapon.savedKeychainId ?? '')
      setOffsetX(weapon.savedKeychainOffsetX ?? 0)
      setOffsetY(weapon.savedKeychainOffsetY ?? 0)
      setOffsetZ(weapon.savedKeychainOffsetZ ?? 0)
      setKeychainSeed(weapon.savedKeychainSeed ?? 0)
    }
  }, [weapon, isCustom, isKnife])

  useEffect(() => {
    if (!isCustom) return
    let name = weapon.name
    if (name.includes('ct_agent')) {
      weapon.customname = 'Agent | Default'
      weapon.team = 3
    }
    if (name.includes('tt_agent')) {
      weapon.customname = 'Agent | Default'
      weapon.team = 2
    }
    if (weapon.image) {
      setSelectedSkin({
        paint_name: name,
        image: weapon.image,
        model: weapon.model ? weapon.model : 'Default Model',
      })
    }
  }, [weapon, isCustom])

  useEffect(() => {
    if (!isCustom || !isAgent) return
    const team = weapon.team ?? '3'
    fetch('/data/agents_en.json')
      .then((res) => res.json())
      .then((data) => {
        const filteredSkins = data.filter((skin) => skin.team === team)
        const filteredSkinsNoIMG = filteredSkins.filter(
          (skin) => skin.image && skin.image.trim() !== '',
        )
        let i = 0
        filteredSkinsNoIMG.forEach((skin) => {
          skin.key = `agent_${i}`
          skin.paint_name = skin.agent_name || 'Default Agent'
          i += 1
        })
        setSelectedSkin({
          paint_name: weapon.agent_name || 'Default Agent',
          image: weapon.image,
          model: weapon.model ? weapon.model : 'Default Model',
        })
        setSkins(filteredSkinsNoIMG)
      })
  }, [weapon, isCustom, isAgent])

  useEffect(() => {
    if (!isCustom || !isGloves) return
    const team = weapon.team ?? '3'
    setWear(weapon.wear ?? 0)
    setSeed(weapon.seed ?? 0)
    fetch('/data/gloves_en.json')
      .then((res) => res.json())
      .then((data) => {
        const matchingSkins = data
        matchingSkins.forEach((skin) => {
          if (!skin.image || skin.image.trim() === '') {
            skin.image =
              Number(team) === 2 ? '/others/tt_gloves.png' : '/others/ct_gloves.png'
          }
          skin.key = `${skin.weapon_defindex}_${skin.paint}`
        })
        const selected = matchingSkins.find(
          (glove) =>
            glove.weapon_defindex === weapon.defindex &&
            Number(glove.paint) === Number(weapon.paint),
        )
        setSelectedSkin(selected || null)
        setSkins(matchingSkins)
      })
  }, [weapon, isCustom, isGloves])

  useEffect(() => {
    if (!isCustom || (!isMusic && !isPin)) return
    const url = isMusic ? '/data/music_en.json' : '/data/collectibles_en.json'
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const list = (data || []).map((row, index) => ({
          ...row,
          key: `${isMusic ? 'music' : 'pin'}_${row.id}_${index}`,
          paint_name: row.name,
          paint: row.id,
        }))
        setSkins(list)
        const selectedId = isMusic ? weapon.musicId : weapon.pinId
        const selected =
          list.find((row) => String(row.id) === String(selectedId)) || null
        setSelectedSkin(selected)
      })
  }, [weapon, isCustom, isMusic, isPin])

  const handleSave = async () => {
    if (isCustom) {
      if (isAgent) {
        await onSave({
          type: 'custom',
          other: weapon.custom,
          model: selectedSkin?.model || 'Default Model',
          team: selectedSkin?.team || null,
          name_main: weapon.name || 'NONE',
          image: selectedSkin?.image || null,
        })
        return
      }
      if (isGloves) {
        await onSave({
          type: 'custom',
          other: weapon.custom,
          paint: selectedSkin?.paint ?? 0,
          team: weapon.team || null,
          defindex: selectedSkin?.weapon_defindex || 0,
          image: selectedSkin?.image || null,
          paint_name: selectedSkin?.paint_name || selectedSkin?.name || null,
          name_main: weapon.name || 'NONE',
          wear: Math.min(1, Math.max(0, Number(wear) || 0)),
          seed: Math.min(1000, Math.max(0, Math.round(Number(seed) || 0))),
        })
        return
      }
      if (isMusic) {
        await onSave({
          type: 'custom',
          other: 'music',
          music_id: selectedSkin?.id ? Number(selectedSkin.id) : 0,
          image: selectedSkin?.image || null,
          name_main: weapon.name || 'NONE',
          both_teams: applyBothTeams,
        })
        return
      }
      if (isPin) {
        await onSave({
          type: 'custom',
          other: 'pin',
          pin_id: selectedSkin?.id ? Number(selectedSkin.id) : 0,
          image: selectedSkin?.image || null,
          name_main: weapon.name || 'NONE',
          both_teams: applyBothTeams,
        })
        return
      }
    }
    const defindex = resolveWeaponDefindex(weapon, selectedSkin)
    if (defindex == null) {
      console.error('Cannot save skin: missing weapon_defindex', weapon)
      return
    }
    await onSave({
      weapon_defindex: defindex,
      paint: selectedSkin?.paint ?? 0,
      wear: Math.min(1, Math.max(0, Number(wear) || 0)),
      seed: Math.min(1000, Math.max(0, Math.round(Number(seed) || 0))),
      nametag: (nametag || '').slice(0, 20),
      statTrak: statTrakEnabled
        ? Math.min(999999999, Math.max(0, Math.round(Number(statTrakKills) || 0)))
        : null,
      keychainId: isKnife ? null : keychainId,
      offsetX: isKnife ? 0 : offsetX,
      offsetY: isKnife ? 0 : offsetY,
      offsetZ: isKnife ? 0 : offsetZ,
      keychainSeed: isKnife ? 0 : keychainSeed,
      stickers: isKnife
        ? emptyStickerSlots()
        : selectedStickers.map((s) =>
            s
              ? {
                  id: s.id,
                  schema: s.schema ?? 0,
                  x: s.x ?? 0,
                  y: s.y ?? 0,
                  wear: s.wear ?? 0,
                  scale: s.scale ?? 1,
                  rotation: s.rotation ?? 0,
                }
              : null,
          ),
      image: selectedSkin?.image ?? null,
      type: weapon.type ? weapon.type : '_',
    })
  }

  const handleReset = async () => {
    if (isAgent) return

    if (isMusic || isPin) {
      const ok = await askConfirm({
        title: t.resetSkin,
        message: t.resetSkinConfirm,
        confirmLabel: t.resetSkin,
        cancelLabel: t.cancel,
        danger: true,
      })
      if (!ok) return
      setSelectedSkin(null)
      await onSave?.({
        type: 'custom',
        other: isMusic ? 'music' : 'pin',
        music_id: 0,
        pin_id: 0,
        image: null,
        name_main: weapon.name || 'NONE',
        both_teams: applyBothTeams,
      })
      return
    }

    const ok = await askConfirm({
      title: t.resetSkin,
      message: t.resetSkinConfirm,
      confirmLabel: t.resetSkin,
      cancelLabel: t.cancel,
      danger: true,
    })
    if (!ok) return

    const defindex = resolveWeaponDefindex(weapon, selectedSkin)
    if (defindex == null) {
      console.error('Cannot reset skin: missing weapon_defindex', weapon)
      return
    }

    // Clear local editor state immediately
    const vanilla =
      skins.find((s) => Number(s.paint) === 0) ||
      skins.find((s) => String(s.paint_name || '').toLowerCase().includes('vanilla')) ||
      null
    setSelectedSkin(vanilla)
    setWear(0)
    setSeed(0)
    setNametag('')
    setStatTrakEnabled(false)
    setStatTrakKills(0)
    setKeychainId('')
    setOffsetX(0)
    setOffsetY(0)
    setOffsetZ(0)
    setKeychainSeed(0)
    setSelectedStickers(emptyStickerSlots())
    setPreviewMode('2d')

    await onReset?.({
      weapon_defindex: defindex,
      isGloves,
      isKnife,
      name_main: weapon.name,
    })
  }

  const updateStickerSlot = useCallback((slot, next) => {
    setSelectedStickers((prev) => {
      const updated = [...prev]
      while (updated.length < STICKER_SLOT_COUNT) updated.push(null)
      updated[slot] = next
      return updated
    })
  }, [])

  const resetStickerSlot = useCallback((slot) => {
    setSelectedStickers((prev) => {
      const updated = [...prev]
      const cur = updated[slot]
      if (!cur) return prev
      updated[slot] = {
        ...cur,
        schema: 0,
        x: 0,
        y: 0,
        wear: 0,
        scale: 1,
        rotation: 0,
      }
      return updated
    })
  }, [])

  const nudgeStickerOffset = useCallback((slot, dx, dy) => {
    setSelectedStickers((prev) => {
      const updated = [...prev]
      const cur = updated[slot]
      if (!cur) return prev
      updated[slot] = {
        ...cur,
        x: Math.max(-0.5, Math.min(0.5, (Number(cur.x) || 0) + dx)),
        y: Math.max(-0.5, Math.min(0.5, (Number(cur.y) || 0) + dy)),
      }
      return updated
    })
  }, [])

  const isSkinSelected = (skin) => {
    if (isAgent) {
      return (
        selectedSkin?.model === skin.model ||
        selectedSkin?.agent_name === skin.agent_name ||
        selectedSkin?.image === skin.image
      )
    }
    if (isGloves) {
      return (
        Number(selectedSkin?.paint) === Number(skin.paint) &&
        String(selectedSkin?.weapon_defindex) === String(skin.weapon_defindex)
      )
    }
    if (isMusic || isPin) {
      return String(selectedSkin?.id) === String(skin.id)
    }
    return Number(selectedSkin?.paint) === Number(skin.paint)
  }

  const show3dToggle = beta3d && !isAgent && !isMusic && !isPin
  const selectedHas3d =
    show3dToggle &&
    Boolean(selectedSkin) &&
    skinHas3dPreview(wp3d, selectedSkin, { isGloves })

  const filteredSkins = useMemo(() => {
    const q = deferredSkinSearch.toLowerCase().trim()
    if (!q) return skins
    const words = q.split(/\s+/).filter(Boolean)
    return skins.filter((skin) => {
      const hay = `${skin.paint_name || ''} ${skin.paint ?? ''} ${skin.weapon_name || ''}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [skins, deferredSkinSearch])

  useEffect(() => {
    if (previewMode === '3d' && selectedSkin && !selectedHas3d) {
      setPreviewMode('2d')
    }
  }, [previewMode, selectedSkin, selectedHas3d])

  return (
    <div className="weapon-customizer-container">
      <div className="weapon-customizer-header">
        <div className="weapon-customizer-header__inner">
          <span>{getWeaponLabel(weapon.name)}</span>
          <button type="button" onClick={onClose}>
            {t.changeWeapon}
          </button>
        </div>
      </div>

      <div className="weapon-customizer-body">
        <div className="weapon-customizer-body__inner">
        {!isCustom && (
          <>
            {showStickerPopup && (
              <StickerPopup
                stickers={stickers}
                selectedStickers={selectedStickers}
                onSelect={(slot, sticker) => {
                  if (!sticker) {
                    updateStickerSlot(slot, null)
                    return
                  }
                  updateStickerSlot(slot, {
                    id: sticker.id,
                    name: sticker.name,
                    image: sticker.image,
                    schema: 0,
                    x: 0,
                    y: 0,
                    wear: 0,
                    scale: 1,
                    rotation: 0,
                  })
                  setActiveStickerSlot(slot)
                }}
                onChangeSlot={(slot, next) => {
                  updateStickerSlot(slot, next)
                  setActiveStickerSlot(slot)
                }}
                onResetSlot={resetStickerSlot}
                onClose={() => setShowStickerPopup(false)}
              />
            )}
            {showKeychainPopup && (
              <KeychainPopup
                keychains={keychains}
                selectedKeychainId={keychainId}
                offsetX={offsetX}
                offsetY={offsetY}
                offsetZ={offsetZ}
                seed={keychainSeed}
                onSelect={(id, x, y, z = 0, s = 0) => {
                  setKeychainId(id)
                  setOffsetX(x)
                  setOffsetY(y)
                  setOffsetZ(z)
                  setKeychainSeed(s)
                }}
                onClose={() => setShowKeychainPopup(false)}
              />
            )}
          </>
        )}

        <section className="wc-hero">
          {show3dToggle && (
            <div className="preview-mode-toggle" role="group" aria-label={t.previewMode}>
              <button
                type="button"
                className={previewMode === '2d' ? 'active' : ''}
                onClick={() => setPreviewMode('2d')}
              >
                {t.preview2d}
              </button>
              <button
                type="button"
                className={previewMode === '3d' ? 'active' : ''}
                onClick={() => setPreviewMode('3d')}
                disabled={!selectedSkin || !selectedHas3d}
                title={
                  selectedSkin && !selectedHas3d ? t.preview3dUnavailable : t.betaFeatureHint
                }
              >
                {t.preview3d}
                <span className="wp-beta-badge wp-beta-badge--inline">{t.betaBadge}</span>
              </button>
            </div>
          )}

          <div className="wc-hero__stage-row">
            <div className="wc-hero__stage">
              {previewMode === '3d' && selectedSkin && show3dToggle && selectedHas3d ? (
                <Weapon3DPreview
                  weaponName={selectedSkin.weapon_name || weapon.name}
                  defindex={selectedSkin.weapon_defindex ?? weapon.cs2_id ?? weapon.defindex}
                  paint={selectedSkin.paint}
                  legacyModel={Boolean(selectedSkin.legacy_model)}
                  isGloves={isGloves}
                  isKnife={isKnife}
                  skinLabel={selectedSkin.paint_name}
                  onOpenTour={() => setTourOpen(true)}
                  stickers={isKnife || isGloves ? null : selectedStickers}
                  wear={wear}
                  seed={seed}
                  activeStickerSlot={activeStickerSlot}
                  stickerDragEnabled={!isKnife && !isGloves}
                  onStickerOffsetChange={nudgeStickerOffset}
                />
              ) : selectedSkin ? (
                <img
                  src={selectedSkin.image}
                  alt={selectedSkin.paint_name}
                  className="wc-hero__image"
                  draggable={false}
                />
              ) : (
                <div className="wc-hero__empty">{t.selectSkin}</div>
              )}
            </div>
            {!isKnife && !isGloves && !isCustom && previewMode === '3d' && selectedHas3d && (
              <StickerPlacementPanel
                visible
                stickers={selectedStickers}
                activeSlot={activeStickerSlot}
                onActiveSlotChange={setActiveStickerSlot}
                onChangeSlot={updateStickerSlot}
                onResetSlot={resetStickerSlot}
              />
            )}
          </div>

          <div className="wc-hero__meta">
            <h2 className="wc-hero__title">
              {selectedSkin?.paint_name || getWeaponLabel(weapon.name)}
              {(isMusic || isPin) && (
                <span className="wp-beta-badge wp-beta-badge--inline" title={t.betaFeatureHint}>
                  {t.betaBadge}
                </span>
              )}
            </h2>
            {selectedSkin && (!isCustom || isGloves) && (
              <p className="wc-hero__sub">
                {[
                  !isGloves && nametag ? `Nametag: ${nametag}` : null,
                  `Wear ${wear}`,
                  `Seed ${seed}`,
                  !isGloves && statTrakEnabled ? `ST ${statTrakKills}` : null,
                ]
                  .filter(Boolean)
                  .join(' - ')}
              </p>
            )}
            {isAgent && selectedSkin?.model && (
              <p className="wc-hero__sub">Model: {selectedSkin.model}</p>
            )}
          </div>
        </section>

        {(!isCustom || isGloves) && (
          <section className="wc-options" aria-label={t.optionsLabel}>
            <div className="wc-options__row">
              <label className="wc-opt wc-opt--wear">
                <span className="wc-opt__label-row">
                  <span>{t.wear}</span>
                  <em className="wc-opt__wear-val">
                    {Number(wear).toFixed(6).replace(/\.?0+$/, '') || '0'}
                  </em>
                </span>
                <input
                  type="range"
                  className="wc-opt__range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={Number.isFinite(Number(wear)) ? Number(wear) : 0}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) {
                      setWear(0)
                      return
                    }
                    setWear(Math.min(1, Math.max(0, n)))
                  }}
                  aria-label={t.wear}
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.000001}
                  inputMode="decimal"
                  value={wear}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) {
                      setWear(0)
                      return
                    }
                    setWear(Math.min(1, Math.max(0, n)))
                  }}
                  onBlur={() =>
                    setWear((w) => {
                      const n = Number(w)
                      if (!Number.isFinite(n)) return 0
                      return Math.min(1, Math.max(0, Number(n.toFixed(6))))
                    })
                  }
                />
              </label>
              <label className="wc-opt">
                <span>{t.seed}</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                  value={seed}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value))
                    if (!Number.isFinite(n)) {
                      setSeed(0)
                      return
                    }
                    setSeed(Math.min(1000, Math.max(0, n)))
                  }}
                />
              </label>
              {!isGloves && (
                <>
                  <label className="wc-opt wc-opt--grow">
                    <span>{t.nametag}</span>
                    <input
                      type="text"
                      maxLength={20}
                      value={nametag}
                      onChange={(e) => setNametag(e.target.value.slice(0, 20))}
                      placeholder={t.nametagPlaceholder}
                    />
                  </label>
                  <label className="wc-opt wc-opt--check">
                    <span>{t.statTrak}</span>
                    <input
                      type="checkbox"
                      checked={statTrakEnabled}
                      onChange={(e) => setStatTrakEnabled(e.target.checked)}
                    />
                  </label>
                  {statTrakEnabled && (
                    <label className="wc-opt">
                      <span>{t.kills}</span>
                      <input
                        type="number"
                        min={0}
                        max={999999999}
                        step={1}
                        inputMode="numeric"
                        value={statTrakKills}
                        onChange={(e) => {
                          const n = Math.round(Number(e.target.value))
                          if (!Number.isFinite(n)) {
                            setStatTrakKills(0)
                            return
                          }
                          setStatTrakKills(Math.min(999999999, Math.max(0, n)))
                        }}
                      />
                    </label>
                  )}
                </>
              )}
              {!isKnife && !isGloves && (
                <div className="wc-opt-actions">
                  <button type="button" onClick={() => setShowStickerPopup(true)}>
                    {t.stickers}
                    {selectedStickers.some((s) => s?.id) && (
                      <span className="wc-opt-count">
                        {selectedStickers.filter((s) => s?.id).length}
                      </span>
                    )}
                  </button>
                  <button type="button" onClick={() => setShowKeychainPopup(true)}>
                    {t.keychain}
                    {keychainId ? (
                      <img
                        className="wc-opt-thumb"
                        src={keychains.find((k) => String(k.id) === String(keychainId))?.image}
                        alt=""
                        draggable={false}
                      />
                    ) : null}
                  </button>
                </div>
              )}
            </div>
            {previewMode === '3d' && show3dToggle && (
              <p className="wc-wear-seed-3d-hint">{t.wearSeedNotIn3d}</p>
            )}
            {!isKnife && !isGloves && selectedStickers.some((s) => s?.id) && (
              <div className="wc-sticker-chips" aria-label={t.stickers}>
                {selectedStickers.map((sticker, i) =>
                  sticker?.image ? (
                    <button
                      key={i}
                      type="button"
                      className="wc-sticker-chip"
                      title={sticker.name}
                      onClick={() => setShowStickerPopup(true)}
                    >
                      {i === 4 && (
                        <span className="wp-beta-badge wp-beta-badge--slot">{t.betaBadge}</span>
                      )}
                      <img src={sticker.image} alt="" draggable={false} />
                    </button>
                  ) : null,
                )}
              </div>
            )}
          </section>
        )}

        <section className="wc-skins" aria-label={t.skinListLabel}>
          <div className="wc-skins__toolbar">
            <h3 className="wc-skins__title">{t.skinListLabel}</h3>
            <input
              type="search"
              className="wc-skins__search"
              placeholder={t.findSkin}
              value={skinSearch}
              onChange={(e) => setSkinSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={t.findSkin}
            />
          </div>
          {skinSearch.trim() && (
            <p className="wc-skins__count">
              {t.skinSearchCount
                .replace('{shown}', String(filteredSkins.length))
                .replace('{total}', String(skins.length))}
            </p>
          )}
          <div className="skin-list">
            {filteredSkins.length === 0 ? (
              <p className="wc-skins__empty">{t.skinSearchEmpty}</p>
            ) : (
              filteredSkins.map((skin) => {
              const has3d =
                show3dToggle && skinHas3dPreview(wp3d, skin, { isGloves })
              return (
                <button
                  key={skin.key}
                  type="button"
                  className={
                    isSkinSelected(skin) ? 'skin-button selected' : 'skin-button'
                  }
                  onClick={() => setSelectedSkin(skin)}
                  title={skin.paint_name}
                >
                  {has3d && (
                    <span className="skin-badge-3d" title={t.preview3dAvailable}>
                      3D
                    </span>
                  )}
                  <img
                    src={skin.image}
                    alt={skin.paint_name}
                    className="skin-thumb"
                    draggable={false}
                    loading="lazy"
                  />
                  <span className="skin-button__name">{skin.paint_name}</span>
                </button>
              )
            })
            )}
          </div>
        </section>

        <section className="wc-settings">
          {(isMusic || isPin) && (
            <label className="wc-opt wc-opt--check wc-opt--both-teams">
              <input
                type="checkbox"
                checked={applyBothTeams}
                onChange={(e) => setApplyBothTeams(e.target.checked)}
              />
              <span>
                {t.applyBothTeams}
                <em className="wc-opt__hint">{t.applyBothTeamsHint}</em>
              </span>
            </label>
          )}
          <div className="buttons">
            {!isAgent && (
              <button
                type="button"
                className="wc-btn wc-btn--danger"
                onClick={handleReset}
              >
                {t.resetSkin}
              </button>
            )}
            <button type="button" className="wc-btn wc-btn--muted" onClick={onClose}>
              {t.cancel}
            </button>
            <button type="button" className="wc-btn wc-btn--primary" onClick={handleSave}>
              {t.save}
            </button>
          </div>
        </section>
        </div>
      </div>

      {selectedSkin && (
        <Weapon3DTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
          weaponName={selectedSkin.weapon_name || weapon.name}
          defindex={selectedSkin.weapon_defindex ?? weapon.cs2_id ?? weapon.defindex}
          paint={selectedSkin.paint}
          legacyModel={Boolean(selectedSkin.legacy_model)}
          isGloves={isGloves}
          isKnife={isKnife}
          skinLabel={selectedSkin.paint_name}
          stickers={isKnife || isGloves ? null : selectedStickers}
          wear={wear}
          seed={seed}
        />
      )}
    </div>
  )
}
