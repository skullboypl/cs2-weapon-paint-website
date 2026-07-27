/**
 * LielXD 3D assets (MIT) - streamed at runtime via GitHub raw / Vite /lielxd proxy.
 * Availability for badges + skip failed probes: /data/wp3d-available.json
 */

import {
  getWp3dTextureExt,
  hasWp3dModel,
  hasWp3dTexture,
  loadWp3dManifest,
} from './wp3dAvailability'

const GH_RAW =
  'https://raw.githubusercontent.com/LielXD/CS2-WeaponPaints-Website/refs/heads/main/src'

/** In Vite dev, same-origin proxy avoids CORS with GitHub raw. */
function assetBase() {
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    return '/lielxd'
  }
  return GH_RAW
}

/**
 * Model/texture key: weapon_name for guns/knives, defindex for gloves.
 */
export function resolveWeapon3dKey({ weaponName, defindex, isGloves }) {
  if (isGloves && defindex != null) return String(defindex)
  if (weaponName) return weaponName
  if (defindex != null) return String(defindex)
  return null
}

export function buildModelUrl(key) {
  if (!key) return null
  return `${assetBase()}/%5Bmodels%5D/${key}.glb`
}

export function buildTextureUrls(key, paint, ext = 'png') {
  if (!key || paint == null || paint === '' || Number(paint) === 0) {
    return [null, null]
  }
  const paintId = String(paint)
  const base = assetBase()
  return [
    `${base}/%5Btextures%5D/${key}/${paintId}.${ext}`,
    `${base}/%5Btextures%5D/${key}/${paintId}_metal.${ext}`,
  ]
}

export function getHdriUrl() {
  return `${assetBase()}/environment.hdr`
}

/** @deprecated use getHdriUrl() */
export const HDRI_URL = `${GH_RAW}/environment.hdr`

async function probeUrl(url) {
  if (!url) return false
  try {
    const sameOrigin = url.startsWith('/')
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      ...(sameOrigin ? { headers: { Range: 'bytes=0-0' } } : { mode: 'cors' }),
    })
    return res.ok || res.status === 206
  } catch {
    return false
  }
}

async function resolveTexturePair(key, paintId, preferredExt) {
  const order =
    preferredExt === 'webp' ? ['webp', 'png'] : ['png', 'webp']

  for (const ext of order) {
    const [color, metal] = buildTextureUrls(key, paintId, ext)
    if (await probeUrl(color)) {
      const metalOk = metal ? await probeUrl(metal) : false
      return {
        texturepath: [color, metalOk ? metal : null],
        textureMissing: false,
      }
    }
  }
  return { texturepath: null, textureMissing: true }
}

/**
 * Resolve model + texture paths from LielXD remote (streamed, not mirrored).
 * Uses manifest for badge/ext hint, then probes png/webp so webp-only paints work.
 */
export async function resolveWeapon3dAssets({
  weaponName,
  defindex,
  paint,
  isGloves = false,
}) {
  const key = resolveWeapon3dKey({ weaponName, defindex, isGloves })
  if (!key) return { modelpath: null, texturepath: null, key, textureMissing: false }

  const manifest = await loadWp3dManifest()
  const modelKnownMissing = manifest?.models && !hasWp3dModel(manifest, key)
  const modelpath = modelKnownMissing ? null : buildModelUrl(key)

  const paintId = paint ?? 0
  if (Number(paintId) === 0 || paintId === 'default') {
    return { modelpath, texturepath: null, key, textureMissing: false }
  }

  if (manifest?.paints && !hasWp3dTexture(manifest, key, paintId)) {
    return { modelpath, texturepath: null, key, textureMissing: true }
  }

  const preferredExt = getWp3dTextureExt(manifest, key, paintId)
  const tex = await resolveTexturePair(key, paintId, preferredExt)
  return { modelpath, key, ...tex }
}
