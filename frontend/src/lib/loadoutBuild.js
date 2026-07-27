import { CATEGORY_ORDER } from './weaponDisplay'

export function toWeaponKnifeId(name) {
  const raw = String(name || '').trim()
  if (!raw || raw === 'knife' || raw === 'weapon_knife') return 'weapon_knife'
  return raw.startsWith('weapon_') ? raw : `weapon_${raw}`
}

export function knifeMatches(equipped, weaponName) {
  return toWeaponKnifeId(equipped) === toWeaponKnifeId(weaponName)
}

function stickerSlotHasId(val) {
  if (val == null || val === '') return false
  if (val === '0' || val === 0) return false
  const id = Number.parseInt(String(val).split(';')[0], 10)
  return Number.isFinite(id) && id > 0
}

function keychainHasId(val) {
  if (val == null || val === '' || val === '0;0;0;0;0') return false
  const id = Number.parseInt(String(val).split(';')[0], 10)
  return Number.isFinite(id) && id > 0
}

export function skinIsCustomized(dbSkin) {
  if (!dbSkin) return false
  if (Number(dbSkin.weapon_paint_id) > 0) return true
  if (Number(dbSkin.weapon_stattrak) === 1) return true
  if (Number(dbSkin.weapon_wear) > 0) return true
  if (Number(dbSkin.weapon_seed) > 0) return true
  if (dbSkin.weapon_nametag) return true
  if (keychainHasId(dbSkin.weapon_keychain)) return true
  return [0, 1, 2, 3, 4].some((i) => stickerSlotHasId(dbSkin[`weapon_sticker_${i}`]))
}

export function weaponBelongsToTeamView(weapon, team) {
  if (
    weapon.name === 'ct_gloves' ||
    weapon.name === 'ct_agent' ||
    weapon.name === 'ct_music' ||
    weapon.name === 'ct_pin'
  ) {
    return team === 'CT'
  }
  if (
    weapon.name === 'tt_gloves' ||
    weapon.name === 'tt_agent' ||
    weapon.name === 'tt_music' ||
    weapon.name === 'tt_pin'
  ) {
    return team === 'T'
  }
  return true
}

export function formatSkinPaintLabel(paintName) {
  if (!paintName) return null
  const raw = String(paintName).trim()
  if (!raw) return null
  const pipe = raw.indexOf('|')
  const label = (pipe >= 0 ? raw.slice(pipe + 1) : raw).trim()
  if (!label || /^default$/i.test(label)) return null
  return label
}

export function resolveCardSkinName(weapon, dbSkin, paintNameByKey) {
  if (
    weapon?.type === 'gloves' ||
    weapon?.type === 'music' ||
    weapon?.type === 'pin' ||
    weapon?.type === 'agent'
  ) {
    return formatSkinPaintLabel(weapon.paintLabel) || weapon.paintLabel || null
  }
  const paint = Number(dbSkin?.weapon_paint_id)
  if (!Number.isFinite(paint) || paint <= 0) return null
  const def = Number(dbSkin.weapon_defindex)
  if (!Number.isFinite(def)) return null
  return formatSkinPaintLabel(paintNameByKey.get(`${def}:${paint}`))
}

export function buildPaintNameMap(skinMap) {
  const pMap = new Map()
  for (const s of skinMap || []) {
    pMap.set(`${Number(s.weapon_defindex)}:${Number(s.paint)}`, s.paint_name)
  }
  return pMap
}

function catalogRowById(list, id) {
  if (id == null || Number(id) <= 0) return null
  return (list || []).find((row) => Number(row.id) === Number(id)) || null
}

/**
 * Build loadout weapon cards for one team
 * (changed skins + equipped knife + painted gloves + music/pin/agent when set).
 */
export function buildTeamLoadout({
  weaponsBase,
  skinsRows,
  skinMap,
  glovesJson,
  glovesData,
  knifeEquipped,
  team,
  musicJson = [],
  pinsJson = [],
  musicId = null,
  pinId = null,
  agentModel = null,
  agentsJson = [],
}) {
  const paintNameByKey = buildPaintNameMap(skinMap)
  const knifeId = toWeaponKnifeId(knifeEquipped)

  const mergedGloves = (glovesData?.gloves_models || []).map((model) => {
    const skin = glovesData.gloves_skins?.find(
      (s) => Number(s.weapon_team) === Number(model.weapon_team),
    )
    return {
      team: model.weapon_team,
      defindex: model.weapon_defindex,
      paint_id: skin?.weapon_paint_id ?? 0,
      wear: skin?.weapon_wear ?? 0,
      seed: skin?.weapon_seed ?? 0,
    }
  })

  const buildGloves = (teamId) => {
    const base = mergedGloves.find((g) => Number(g.team) === Number(teamId))
    if (!base) return null
    const skin = (glovesJson || []).find(
      (g) =>
        Number(g.weapon_defindex) === Number(base.defindex) &&
        Number(g.paint) === Number(base.paint_id ?? 0),
    )
    return {
      team: teamId,
      defindex: base.defindex,
      paint: base.paint_id ?? 0,
      wear: base.wear ?? 0,
      seed: base.seed ?? 0,
      image: skin?.image || `/others/${teamId === 2 ? 'tt' : 'ct'}_gloves.png`,
      name: skin?.name || skin?.paint_name || null,
    }
  }

  const glovesT = buildGloves(2)
  const glovesCT = buildGloves(3)
  const musicRow = catalogRowById(musicJson, musicId)
  const pinRow = catalogRowById(pinsJson, pinId)
  const agentRow =
    agentModel && agentModel !== 'null'
      ? (agentsJson || []).find((a) => a.model === agentModel) || null
      : null

  const filtered = (weaponsBase || []).filter(
    (w) => w.team === 'Both' || w.team === team,
  )

  const withImages = filtered.map((w) => {
    const dbSkin = skinsRows.find(
      (s) => Number(s.weapon_defindex) === Number(w.cs2_id),
    )
    if (dbSkin) {
      const matchedSkin = (skinMap || []).find(
        (s) =>
          Number(s.weapon_defindex) === Number(dbSkin.weapon_defindex) &&
          Number(s.paint) === Number(dbSkin.weapon_paint_id),
      )
      if (matchedSkin?.image) return { ...w, image: matchedSkin.image }
    }
    return { ...w }
  })

  const weapons = withImages.map((w) => {
    if (w.name === 'tt_gloves') {
      return {
        ...w,
        image: glovesT?.image || '/others/tt_gloves.png',
        type: 'gloves',
        team: 2,
        defindex: glovesT?.defindex || 0,
        paint: glovesT?.paint || 0,
        wear: glovesT?.wear || 0,
        seed: glovesT?.seed || 0,
        paintLabel: glovesT?.name || null,
      }
    }
    if (w.name === 'ct_gloves') {
      return {
        ...w,
        image: glovesCT?.image || '/others/ct_gloves.png',
        type: 'gloves',
        team: 3,
        defindex: glovesCT?.defindex || 0,
        paint: glovesCT?.paint || 0,
        wear: glovesCT?.wear || 0,
        seed: glovesCT?.seed || 0,
        paintLabel: glovesCT?.name || null,
      }
    }
    if (w.name === 'ct_music' || w.name === 'tt_music') {
      return {
        ...w,
        type: 'music',
        team: w.name === 'ct_music' ? 3 : 2,
        musicId: musicId != null ? Number(musicId) : null,
        image: musicRow?.image || w.image,
        paintLabel: musicRow?.name || null,
      }
    }
    if (w.name === 'ct_pin' || w.name === 'tt_pin') {
      return {
        ...w,
        type: 'pin',
        team: w.name === 'ct_pin' ? 3 : 2,
        pinId: pinId != null ? Number(pinId) : null,
        image: pinRow?.image || w.image,
        paintLabel: pinRow?.name || null,
      }
    }
    if (w.name === 'ct_agent' || w.name === 'tt_agent') {
      return {
        ...w,
        type: 'agent',
        team: w.name === 'ct_agent' ? 3 : 2,
        model: agentRow?.model || agentModel || 'null',
        image:
          agentRow?.image ||
          (w.name === 'ct_agent' ? '/agents/ct_sas.png' : '/agents/tt_phoenix.png'),
        paintLabel: agentRow?.agent_name || agentRow?.name || null,
      }
    }
    return w
  })

  const items = weapons
    .filter((w) => {
      if (w.name === 'knife') return false
      if (!weaponBelongsToTeamView(w, team)) return false
      if (w.category === 'Knife') {
        return knifeMatches(knifeId, w.name)
      }
      if (w.type === 'music' && Number(w.musicId) > 0) return true
      if (w.type === 'pin' && Number(w.pinId) > 0) return true
      if (w.type === 'agent' && w.model && w.model !== 'null') return true
      const def = Number(w.cs2_id ?? w.defindex)
      const dbSkin = Number.isFinite(def)
        ? skinsRows.find((s) => Number(s.weapon_defindex) === def)
        : null
      if (skinIsCustomized(dbSkin)) return true
      if (w.type === 'gloves' && Number(w.paint) > 0) return true
      return false
    })
    .map((w) => {
      const def = Number(w.cs2_id ?? w.defindex)
      const dbSkin = Number.isFinite(def)
        ? skinsRows.find((s) => Number(s.weapon_defindex) === def)
        : null
      return {
        weapon: w,
        dbSkin,
        skinName: resolveCardSkinName(w, dbSkin, paintNameByKey),
        defindex: Number.isFinite(def) && def > 0 ? def : null,
      }
    })
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.weapon.category)
      const ib = CATEGORY_ORDER.indexOf(b.weapon.category)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

  return items
}
