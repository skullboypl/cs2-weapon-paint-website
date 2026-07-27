import { fetchJsonCached } from './dataCache'

const MANIFEST_URL = '/data/wp3d-available.json'

let manifestPromise = null

export function loadWp3dManifest() {
  if (!manifestPromise) {
    manifestPromise = fetchJsonCached(MANIFEST_URL).catch(() => null)
  }
  return manifestPromise
}

export function hasWp3dModel(manifest, key) {
  if (!manifest?.models || !key) return false
  return manifest.models.includes(String(key))
}

export function hasWp3dTexture(manifest, key, paint) {
  if (!manifest?.paints || !key) return false
  const paintId = String(paint ?? '')
  if (!paintId || paintId === '0') return false
  const list = manifest.paints[String(key)]
  return Array.isArray(list) && list.includes(paintId)
}

/** Preferred UV file extension from manifest (`png` | `webp`), else null. */
export function getWp3dTextureExt(manifest, key, paint) {
  const paintId = String(paint ?? '')
  if (!manifest || !key || !paintId) return null
  const fromFormats = manifest.formats?.[String(key)]?.[paintId]
  if (fromFormats === 'png' || fromFormats === 'webp') return fromFormats
  if (hasWp3dTexture(manifest, key, paintId)) return 'png'
  return null
}

function skin3dKey(skin, isGloves) {
  if (isGloves && skin?.weapon_defindex != null) return String(skin.weapon_defindex)
  if (skin?.weapon_name) return String(skin.weapon_name)
  if (skin?.weapon_defindex != null) return String(skin.weapon_defindex)
  return null
}

/** Skin has a paintable 3D preview on LielXD (model + UV for this paint). */
export function skinHas3dPreview(manifest, skin, { isGloves = false } = {}) {
  if (!manifest || !skin) return false
  const key = skin3dKey(skin, isGloves)
  if (!key) return false
  if (!hasWp3dModel(manifest, key) && !manifest.paints?.[key]) return false
  return hasWp3dTexture(manifest, key, skin.paint)
}
