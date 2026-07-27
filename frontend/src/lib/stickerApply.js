import * as THREE from 'three'
import ProjectedMaterial from 'three-projected-material'
import { STICKER_SLOT_COUNT } from './stickerFormat'
import { resolveSlotOffset } from './stickerSlotOffsets'

export function getStickerTargetMesh(root) {
  let best = null
  let bestScore = -Infinity

  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.material) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    const matName = mats
      .map((m) => String(m?.name || '').toLowerCase())
      .join(' ')
    if (matName.includes('scope') || matName.includes('bare_arm')) return

    obj.geometry.computeBoundingBox?.()
    const bb = obj.geometry.boundingBox
    if (!bb) return
    const size = new THREE.Vector3()
    bb.getSize(size)
    const score = size.x * size.y + size.x * size.z + size.y * size.z
    if (score > bestScore) {
      bestScore = score
      best = obj
    }
  })

  if (!best) {
    root.traverse((obj) => {
      if (best) return
      if (obj.isMesh && obj.geometry) best = obj
    })
  }
  return best
}

function disposeOverlay(overlay) {
  if (!overlay) return
  overlay.parent?.remove(overlay)
  overlay.geometry?.dispose?.()
  const mat = overlay.material
  if (mat) {
    mat.texture?.dispose?.()
    mat.dispose?.()
  }
}

/**
 * Apply up to 5 stickers via projected materials (LielXD approach).
 * @returns {{ overlays: Array, projectors: Array, clear: () => void }}
 */
export async function applyStickersToModel({
  modelRoot,
  weaponName,
  stickers = [],
  prevState = null,
}) {
  const sceneRoot = modelRoot
  if (!sceneRoot) return prevState

  const mesh = getStickerTargetMesh(sceneRoot)
  if (!mesh) return prevState

  const overlays = prevState?.overlays?.slice() || Array(STICKER_SLOT_COUNT).fill(null)
  const projectors =
    prevState?.projectors?.slice() || Array(STICKER_SLOT_COUNT).fill(null)

  const box = new THREE.Box3().setFromObject(mesh)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')

  for (let place = 0; place < STICKER_SLOT_COUNT; place++) {
    const slot = stickers[place]
    const imgsrc = slot?.image

    if (!imgsrc || !slot?.id) {
      disposeOverlay(overlays[place])
      overlays[place] = null
      projectors[place] = null
      continue
    }

    let stickerTex
    try {
      stickerTex = await loader.loadAsync(imgsrc)
    } catch {
      disposeOverlay(overlays[place])
      overlays[place] = null
      continue
    }
    stickerTex.colorSpace = THREE.SRGBColorSpace

    const base = resolveSlotOffset(weaponName, place, size)
    // Plugin x/y are small floats; treat as fraction of AABB + absolute nudge
    const ox = base.x + (Number(slot.x) || 0) * size.x
    const oy = base.y + (Number(slot.y) || 0) * size.y
    const distance = Math.max(base.distance, size.z * 0.3)

    const surfacePoint = center.clone().add(new THREE.Vector3(ox, oy, 0))
    let projector = projectors[place]
    if (!projector) {
      projector = new THREE.PerspectiveCamera(35, 1, 0.01, 20)
      projectors[place] = projector
    }

    const normalDir = new THREE.Vector3(0, 0, 1)
    projector.position.copy(surfacePoint.clone().add(normalDir.multiplyScalar(distance)))
    projector.lookAt(surfacePoint)
    // Rotation around projection axis (degrees)
    const rot = ((Number(slot.rotation) || 0) * Math.PI) / 180
    if (rot) {
      projector.rotateZ(rot)
    }
    projector.updateProjectionMatrix()
    projector.updateMatrixWorld(true)

    const scale = Number(slot.scale)
    const textureScale = Number.isFinite(scale) && scale > 0 ? 2.7 / scale : 2.7
    const wear = Math.min(1, Math.max(0, Number(slot.wear) || 0))
    const opacity = 1 - wear * 0.85

    if (overlays[place]) {
      const overlay = overlays[place]
      const mat = overlay.material
      mat.texture?.dispose?.()
      mat.texture = stickerTex
      mat.camera = projector
      mat.textureScale = textureScale
      mat.opacity = opacity
      mat.project(overlay)
      continue
    }

    const stickerMat = new ProjectedMaterial({
      camera: projector,
      texture: stickerTex,
      textureScale,
      transparent: true,
      opacity,
      backgroundOpacity: 0,
    })

    const overlayMesh = mesh.clone()
    overlayMesh.material = stickerMat
    mesh.parent.add(overlayMesh)
    overlayMesh.position.copy(mesh.position)
    overlayMesh.quaternion.copy(mesh.quaternion)
    overlayMesh.scale.copy(mesh.scale)
    overlayMesh.renderOrder = 10 + place
    stickerMat.project(overlayMesh)
    overlays[place] = overlayMesh
  }

  const clear = () => {
    for (let i = 0; i < STICKER_SLOT_COUNT; i++) {
      disposeOverlay(overlays[i])
      overlays[i] = null
      projectors[i] = null
    }
  }

  return { overlays, projectors, clear }
}
