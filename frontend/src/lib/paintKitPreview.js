/**
 * Paint-kit wear/seed preview (Phase 2 POC).
 *
 * Real CS2 finish styles need VRF-extracted pattern/wear atlases + per-style shaders
 * (see Skinshotter / CS.Money). Until kits exist under /data/paint-kits/, we apply a
 * lightweight approximation on the LielXD UV map:
 * - seed → UV offset (deterministic)
 * - wear → darken / contrast toward metal (approx scratches)
 *
 * When a kit JSON + textures are present, prefer those maps.
 */

import * as THREE from 'three'

const KIT_BASE = '/data/paint-kits'

export function paintKitManifestUrl(weaponKey, paintId) {
  if (!weaponKey || paintId == null) return null
  return `${KIT_BASE}/${weaponKey}/${paintId}.json`
}

export async function tryLoadPaintKit(weaponKey, paintId) {
  const url = paintKitManifestUrl(weaponKey, paintId)
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Deterministic UV nudge from pattern seed (0-1000). */
export function seedToUvOffset(seed) {
  const s = ((Number(seed) || 0) % 1001) / 1000
  return {
    u: (s * 1.6180339887) % 1,
    v: (s * 2.7182818284) % 1,
  }
}

/**
 * Apply live wear/seed to materials that already have a color map (LielXD UV fallback).
 * Returns a dispose/cleanup fn for uniforms if needed.
 */
export function applyWearSeedToPaintedMaterials(root, { wear = 0, seed = 0 } = {}) {
  if (!root) return () => {}

  const w = Math.min(1, Math.max(0, Number(wear) || 0))
  const { u, v } = seedToUvOffset(seed)
  const touched = []

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach((mat) => {
      if (!mat?.map) return
      const name = String(mat.name || '')
      if (name.includes('bare_arm') || name.includes('scope')) return

      mat.map.offset.set(u * 0.08, v * 0.08)
      mat.map.needsUpdate = true

      // Approximate wear: push color toward darker / less saturated
      if (!mat.userData._wpBaseColor) {
        mat.userData._wpBaseColor = mat.color?.clone?.() || new THREE.Color(0xffffff)
      }
      const base = mat.userData._wpBaseColor
      const worn = base.clone().lerp(new THREE.Color(0x3a3a3a), w * 0.55)
      mat.color.copy(worn)
      if ('roughness' in mat) {
        if (mat.userData._wpBaseRough == null) mat.userData._wpBaseRough = mat.roughness ?? 0.5
        mat.roughness = Math.min(1, mat.userData._wpBaseRough + w * 0.35)
      }
      mat.needsUpdate = true
      touched.push(mat)
    })
  })

  return () => {
    touched.forEach((mat) => {
      if (mat.map) {
        mat.map.offset.set(0, 0)
        mat.map.needsUpdate = true
      }
      if (mat.userData._wpBaseColor) mat.color.copy(mat.userData._wpBaseColor)
      if (mat.userData._wpBaseRough != null && 'roughness' in mat) {
        mat.roughness = mat.userData._wpBaseRough
      }
      mat.needsUpdate = true
    })
  }
}
