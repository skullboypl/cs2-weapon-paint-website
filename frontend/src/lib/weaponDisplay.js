/** Human-readable weapon labels. Technical id stays as subtitle. */

const WEAPON_LABELS = {
  ak47: 'AK-47',
  aug: 'AUG',
  awp: 'AWP',
  bayonet: 'Bayonet',
  bizon: 'PP-Bizon',
  ct_agent: 'CT Agent',
  ct_gloves: 'CT Gloves',
  ct_music: 'CT Music Kit',
  ct_pin: 'CT Pin',
  cz75a: 'CZ75-Auto',
  deagle: 'Desert Eagle',
  elite: 'Dual Berettas',
  famas: 'FAMAS',
  fiveseven: 'Five-SeveN',
  g3sg1: 'G3SG1',
  galilar: 'Galil AR',
  glock: 'Glock-18',
  hkp2000: 'P2000',
  knife: 'Default Knife',
  knife_butterfly: 'Butterfly Knife',
  knife_canis: 'Survival Knife',
  knife_cord: 'Paracord Knife',
  knife_css: 'Classic Knife',
  knife_falchion: 'Falchion Knife',
  knife_flip: 'Flip Knife',
  knife_gut: 'Gut Knife',
  knife_gypsy_jackknife: 'Navaja Knife',
  knife_karambit: 'Karambit',
  knife_kukri: 'Kukri Knife',
  knife_m9_bayonet: 'M9 Bayonet',
  knife_outdoor: 'Nomad Knife',
  knife_push: 'Shadow Daggers',
  knife_skeleton: 'Skeleton Knife',
  knife_stiletto: 'Stiletto Knife',
  knife_survival_bowie: 'Bowie Knife',
  knife_tactical: 'Huntsman Knife',
  knife_ursus: 'Ursus Knife',
  knife_widowmaker: 'Talon Knife',
  m249: 'M249',
  m4a1: 'M4A4',
  m4a1_silencer: 'M4A1-S',
  mac10: 'MAC-10',
  mag7: 'MAG-7',
  mp5sd: 'MP5-SD',
  mp7: 'MP7',
  mp9: 'MP9',
  negev: 'Negev',
  nova: 'Nova',
  p250: 'P250',
  p90: 'P90',
  revolver: 'R8 Revolver',
  sawedoff: 'Sawed-Off',
  scar20: 'SCAR-20',
  sg556: 'SG 553',
  ssg08: 'SSG 08',
  taser: 'Zeus x27',
  tec9: 'Tec-9',
  tt_agent: 'T Agent',
  tt_gloves: 'T Gloves',
  tt_music: 'T Music Kit',
  tt_pin: 'T Pin',
  ump45: 'UMP-45',
  usp_silencer: 'USP-S',
  xm1014: 'XM1014',
}

export const CATEGORY_ORDER = [
  'Loadout',
  'Rifle',
  'Sniper',
  'PM',
  'Shotgun',
  'Machine Gun',
  'Pistol',
  'Knife',
  'Other',
]

/** Representative thumbnails for category tiles */
export const CATEGORY_THUMB = {
  Loadout: '/weapons/weapon_knife_karambit.png',
  Rifle: '/weapons/weapon_ak47.png',
  Sniper: '/weapons/weapon_awp.png',
  PM: '/weapons/weapon_mp9.png',
  Shotgun: '/weapons/weapon_xm1014.png',
  'Machine Gun': '/weapons/weapon_negev.png',
  Pistol: '/weapons/weapon_deagle.png',
  Knife: '/weapons/weapon_knife_karambit.png',
  Other: '/others/tt_gloves.png',
}

export function normalizeWeaponKey(name = '') {
  return String(name)
    .replace(/^weapon_/, '')
    .trim()
}

export function getWeaponLabel(name) {
  const key = normalizeWeaponKey(name)
  if (WEAPON_LABELS[key]) return WEAPON_LABELS[key]
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getWeaponSubtitle(name) {
  return normalizeWeaponKey(name)
}

/** Positive CS2 weapon defindex from card / skin row (ignores null/0). */
export function resolveWeaponDefindex(weapon, skin = null) {
  const candidates = [
    weapon?.cs2_id,
    weapon?.defindex,
    weapon?.weapon_defindex,
    skin?.weapon_defindex,
  ]
  for (const raw of candidates) {
    if (raw == null || raw === '') continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

export function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

const CATEGORY_TO_SLUG = {
  Loadout: 'loadout',
  Rifle: 'rifle',
  Sniper: 'sniper',
  PM: 'smg',
  Shotgun: 'shotgun',
  'Machine Gun': 'lmg',
  Pistol: 'pistol',
  Knife: 'knife',
  Other: 'other',
}

const SLUG_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_TO_SLUG).map(([cat, slug]) => [slug, cat]),
)

export function categoryToSlug(category) {
  return CATEGORY_TO_SLUG[category] || 'rifle'
}

export function slugToCategory(slug) {
  if (!slug) return 'Rifle'
  return SLUG_TO_CATEGORY[String(slug).toLowerCase()] || 'Rifle'
}

export function teamToParam(team) {
  if (team === 'T' || team === 't') return 't'
  if (team === 'CT' || team === 'ct') return 'ct'
  return null
}

export function paramToTeam(param) {
  const p = String(param || '').toLowerCase()
  if (p === 't') return 'T'
  if (p === 'ct') return 'CT'
  return null
}

export function loadoutPath(team, category = 'Rifle') {
  const t = teamToParam(team)
  if (!t) return '/team'
  return `/${t}/${categoryToSlug(category)}`
}

