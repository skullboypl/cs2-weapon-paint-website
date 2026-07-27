import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { getHdriUrl, resolveWeapon3dAssets } from '../lib/weapon3dPaths'
import { applyStickersToModel } from '../lib/stickerApply'
import { applyWearSeedToPaintedMaterials } from '../lib/paintKitPreview'
import { useI18n } from '../i18n/I18nProvider'
import '../styles/Weapon3DPreview.css'

function centerMesh(weapon, center) {
  weapon.scene.position.x += weapon.scene.position.x - center.x
  weapon.scene.position.y += weapon.scene.position.y - center.y
  weapon.scene.position.z += weapon.scene.position.z - center.z
}

function disposeObject(root) {
  if (!root) return
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((mat) => {
        if (!mat) return
        ;['map', 'aoMap', 'metalnessMap', 'roughnessMap', 'normalMap'].forEach((key) => {
          if (mat[key]) mat[key].dispose()
        })
        mat.dispose()
      })
    }
  })
}

function applyPaintTextures(root, colorTex, metalTex) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return

    const mats = Array.isArray(child.material) ? child.material : [child.material]
    const nextMats = mats.map((mat) => {
      if (!mat) return mat
      const name = String(mat.name || '')
      if (name.includes('bare_arm') || name.includes('scope')) return mat

      const cloned = mat.clone()
      cloned.map = colorTex
      cloned.color = new THREE.Color(0xffffff)
      if (metalTex) {
        cloned.metalnessMap = metalTex
        if ('metalness' in cloned) cloned.metalness = 1
      } else {
        cloned.metalnessMap = null
      }
      cloned.needsUpdate = true
      return cloned
    })

    child.material = Array.isArray(child.material) ? nextMats : nextMats[0]
  })
}

/**
 * Interactive Three.js weapon preview.
 * @param {'inline'|'tour'} [variant]
 * @param {'rotate'|'pan'|'zoomIn'|'zoomOut'|null} [tourStep]
 */
export default function Weapon3DPreview({
  weaponName,
  defindex,
  paint,
  legacyModel = false,
  isGloves = false,
  isKnife = false,
  variant = 'inline',
  tourStep = null,
  onTourStepDone,
  skinLabel,
  onOpenTour,
  stickers = null,
  wear = 0,
  seed = 0,
  activeStickerSlot = 0,
  onStickerOffsetChange = null,
  stickerDragEnabled = false,
}) {
  const { t } = useI18n()
  const mountRef = useRef(null)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const modelRootRef = useRef(null)
  const stickerStateRef = useRef(null)
  const wearCleanupRef = useRef(null)
  const stickersRef = useRef(stickers)
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 })
  const baselineRef = useRef({
    distance: 0,
    az: 0,
    pol: 0,
    target: new THREE.Vector3(),
  })
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const isTour = variant === 'tour'

  stickersRef.current = stickers

  useEffect(() => {
    const el = mountRef.current
    if (!el) return undefined

    let cancelled = false
    let renderer
    let controls
    let scene
    let camera
    let modelRoot = null
    let animId = 0
    let resizeObs

    const blockPageScroll = (e) => {
      e.preventDefault()
    }
    const blockContextMenu = (e) => {
      e.preventDefault()
    }

    const cleanupScene = () => {
      if (animId) cancelAnimationFrame(animId)
      resizeObs?.disconnect()
      el.removeEventListener('wheel', blockPageScroll)
      if (renderer?.domElement) {
        renderer.domElement.removeEventListener('contextmenu', blockContextMenu)
      }
      controls?.dispose()
      controlsRef.current = null
      cameraRef.current = null
      stickerStateRef.current?.clear?.()
      stickerStateRef.current = null
      wearCleanupRef.current?.()
      wearCleanupRef.current = null
      modelRootRef.current = null
      if (modelRoot) {
        scene?.remove(modelRoot)
        disposeObject(modelRoot)
        modelRoot = null
      }
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement?.parentNode === el) {
          el.removeChild(renderer.domElement)
        }
      }
    }

    const run = async () => {
      setStatus('loading')
      setErrorMsg('')

      const assets = await resolveWeapon3dAssets({
        weaponName,
        defindex,
        paint,
        isGloves,
      })

      if (cancelled) return

      if (!assets.modelpath) {
        setStatus('missing')
        return
      }

      const box = el.getBoundingClientRect()
      const width = Math.max(box.width, 200)
      const height = Math.max(box.height, 220)

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
      cameraRef.current = camera
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      el.appendChild(renderer.domElement)

      // Keep wheel on canvas for OrbitControls zoom - never scroll the page
      el.addEventListener('wheel', blockPageScroll, { passive: false })

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.maxDistance = 80
      controls.rotateSpeed = 0.85
      controls.zoomSpeed = 1.65
      controls.enablePan = true
      controls.panSpeed = 0.9
      controls.screenSpacePanning = true
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }
      controls.minPolarAngle = 0.15
      controls.maxPolarAngle = Math.PI - 0.15
      // Keep context menu from blocking RMB pan
      renderer.domElement.addEventListener('contextmenu', blockContextMenu)
      controlsRef.current = controls

      try {
        const pmrem = new THREE.PMREMGenerator(renderer)
        const hdri = await new HDRLoader().loadAsync(getHdriUrl())
        if (!cancelled) {
          scene.environment = pmrem.fromEquirectangular(hdri).texture
          hdri.dispose()
          pmrem.dispose()
        }
      } catch {
        scene.add(new THREE.AmbientLight(0xffffff, 0.85))
        const dir = new THREE.DirectionalLight(0xffffff, 1.1)
        dir.position.set(4, 8, 6)
        scene.add(dir)
      }

      if (cancelled) return

      try {
        const gltf = await new GLTFLoader().loadAsync(assets.modelpath)
        if (cancelled) return

        const currentType = isGloves ? 'gloves' : isKnife ? 'knifes' : 'weapons'
        if (
          currentType !== 'knifes' &&
          currentType !== 'gloves' &&
          !String(assets.modelpath).includes('weapon_taser')
        ) {
          if (legacyModel === true && gltf.scene.children[1]) {
            gltf.scene.remove(gltf.scene.children[1])
          } else if (legacyModel === false && gltf.scene.children[0]) {
            gltf.scene.remove(gltf.scene.children[0])
          }
        }

        const bbox = new THREE.Box3().setFromObject(gltf.scene)
        const center = bbox.getCenter(new THREE.Vector3())
        centerMesh(gltf, center)

        const pivot = new THREE.Group()
        pivot.add(gltf.scene)
        pivot.rotation.y = Math.PI
        scene.add(pivot)
        modelRoot = pivot

        const size = bbox.getSize(new THREE.Vector3())
        const span = Math.max(size.length(), 0.01)
        camera.position.set(0, 5, span / 1.2)
        camera.lookAt(0, 0, 0)
        controls.minDistance = Math.max(span / 14, 0.08)
        controls.maxDistance = Math.max(span * 3.2, 12)
        controls.target.set(0, 0, 0)
        controls.update()

        const spherical = new THREE.Spherical().setFromVector3(
          camera.position.clone().sub(controls.target),
        )
        baselineRef.current = {
          distance: spherical.radius,
          az: spherical.theta,
          pol: spherical.phi,
          target: controls.target.clone(),
        }

        let painted = false
        if (assets.texturepath?.[0]) {
          const loader = new THREE.TextureLoader()
          loader.setCrossOrigin('anonymous')
          try {
            const colorTex = await loader.loadAsync(assets.texturepath[0])
            colorTex.colorSpace = THREE.SRGBColorSpace
            colorTex.wrapS = THREE.RepeatWrapping
            colorTex.wrapT = THREE.RepeatWrapping
            colorTex.flipY = false

            let metalTex = null
            if (assets.texturepath[1]) {
              try {
                metalTex = await loader.loadAsync(assets.texturepath[1])
                metalTex.colorSpace = THREE.NoColorSpace
                metalTex.wrapS = THREE.RepeatWrapping
                metalTex.wrapT = THREE.RepeatWrapping
                metalTex.flipY = false
              } catch {
                metalTex = null
              }
            }

            applyPaintTextures(gltf.scene, colorTex, metalTex)
            painted = true
          } catch (texErr) {
            console.warn('Weapon3DPreview texture failed', texErr)
            painted = false
          }
        }

        modelRootRef.current = gltf.scene
        if (!isGloves && !isKnife && stickersRef.current?.length) {
          try {
            stickerStateRef.current = await applyStickersToModel({
              modelRoot: gltf.scene,
              weaponName,
              stickers: stickersRef.current,
              prevState: null,
            })
          } catch (stErr) {
            console.warn('Weapon3DPreview stickers failed', stErr)
          }
        }

        const tick = () => {
          if (cancelled) return
          animId = requestAnimationFrame(tick)
          controls.update()
          renderer.render(scene, camera)
        }
        tick()

        resizeObs = new ResizeObserver(() => {
          const r = el.getBoundingClientRect()
          const w = Math.max(r.width, 100)
          const h = Math.max(r.height, 100)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        })
        resizeObs.observe(el)

        if (assets.textureMissing || (Number(paint) > 0 && !painted)) {
          setStatus('no-texture')
        } else {
          setStatus('ready')
        }
      } catch (err) {
        console.error('Weapon3DPreview', err)
        setErrorMsg(err?.message || 'Failed to load 3D model')
        setStatus('error')
      }
    }

    run()

    return () => {
      cancelled = true
      cleanupScene()
    }
  }, [weaponName, defindex, paint, legacyModel, isGloves, isKnife])

  // Live stickers + wear/seed updates without remounting the model
  useEffect(() => {
    const root = modelRootRef.current
    if (!root || status === 'loading' || status === 'missing' || status === 'error') {
      return undefined
    }

    let cancelled = false

    wearCleanupRef.current?.()
    wearCleanupRef.current = applyWearSeedToPaintedMaterials(root, { wear, seed })

    const runStickers = async () => {
      if (isGloves || isKnife) return
      try {
        const next = await applyStickersToModel({
          modelRoot: root,
          weaponName,
          stickers: stickers || [],
          prevState: stickerStateRef.current,
        })
        if (!cancelled) stickerStateRef.current = next
      } catch (err) {
        console.warn('sticker update failed', err)
      }
    }
    runStickers()

    return () => {
      cancelled = true
    }
  }, [stickers, wear, seed, weaponName, isGloves, isKnife, status])

  // Shift+drag to nudge active sticker x/y
  useEffect(() => {
    const el = mountRef.current
    if (!el || !stickerDragEnabled || !onStickerOffsetChange || isTour) return undefined

    const onDown = (e) => {
      if (!e.shiftKey || e.button !== 0) return
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY }
      if (controlsRef.current) controlsRef.current.enabled = false
      e.preventDefault()
    }
    const onMove = (e) => {
      if (!dragRef.current.active) return
      const dx = (e.clientX - dragRef.current.lastX) / 400
      const dy = -(e.clientY - dragRef.current.lastY) / 400
      dragRef.current.lastX = e.clientX
      dragRef.current.lastY = e.clientY
      onStickerOffsetChange(activeStickerSlot, dx, dy)
    }
    const onUp = () => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      if (controlsRef.current) controlsRef.current.enabled = true
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  }, [stickerDragEnabled, onStickerOffsetChange, activeStickerSlot, isTour])

  // Interactive tour: detect rotate / zoom gestures
  useEffect(() => {
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!controls || !camera || !tourStep || !onTourStepDone) return undefined

    const spherical = new THREE.Spherical()
    const read = () => {
      spherical.setFromVector3(camera.position.clone().sub(controls.target))
      return {
        distance: spherical.radius,
        az: spherical.theta,
        pol: spherical.phi,
        target: controls.target.clone(),
      }
    }

    // Reset baseline when step changes
    baselineRef.current = read()
    let done = false

    const onChange = () => {
      if (done) return
      const cur = read()
      const base = baselineRef.current

      if (tourStep === 'rotate') {
        const dAz = Math.abs(cur.az - base.az)
        const dPol = Math.abs(cur.pol - base.pol)
        if (dAz > 0.35 || dPol > 0.25) {
          done = true
          onTourStepDone('rotate')
        }
      } else if (tourStep === 'pan') {
        const dx = Math.abs(cur.target.x - base.target.x)
        const dy = Math.abs(cur.target.y - base.target.y)
        const dz = Math.abs(cur.target.z - base.target.z)
        if (dx + dy + dz > 0.35) {
          done = true
          onTourStepDone('pan')
        }
      } else if (tourStep === 'zoomIn') {
        if (cur.distance < base.distance * 0.82) {
          done = true
          onTourStepDone('zoomIn')
        }
      } else if (tourStep === 'zoomOut') {
        if (cur.distance > base.distance * 1.18) {
          done = true
          onTourStepDone('zoomOut')
        }
      }
    }

    controls.addEventListener('change', onChange)
    return () => controls.removeEventListener('change', onChange)
  }, [tourStep, onTourStepDone, status])

  return (
    <div
      className={
        isTour ? 'weapon-3d-preview weapon-3d-preview--tour' : 'weapon-3d-preview'
      }
    >
      {!isTour && (
        <div className="weapon-3d-toolbar">
          <span className="wp-beta-badge" title={t.betaFeatureHint}>
            {t.betaBadge}
          </span>
          <button
            type="button"
            className="weapon-3d-help-btn"
            onClick={() => onOpenTour?.()}
          >
            {t.preview3dHelpBtn}
          </button>
        </div>
      )}

      <div className="weapon-3d-stage">
        <div
          ref={mountRef}
          className={
            isTour ? 'weapon-3d-canvas weapon-3d-canvas--tour' : 'weapon-3d-canvas'
          }
          aria-label={skinLabel || '3D weapon preview'}
        />
        {status === 'loading' && <div className="weapon-3d-status">Loading 3D…</div>}
        {status === 'missing' && (
          <div className="weapon-3d-status weapon-3d-status--warn">
            No 3D model for this weapon
          </div>
        )}
        {status === 'no-texture' && (
          <div className="weapon-3d-status weapon-3d-status--warn">
            {t.preview3dNoTexture}
          </div>
        )}
        {status === 'error' && (
          <div className="weapon-3d-status weapon-3d-status--err">{errorMsg}</div>
        )}
      </div>
    </div>
  )
}

const TOUR_STEPS = ['rotate', 'pan', 'zoomIn', 'zoomOut', 'done']

export function Weapon3DTour({
  open,
  onClose,
  weaponName,
  defindex,
  paint,
  legacyModel,
  isGloves,
  isKnife,
  skinLabel,
  stickers = null,
  wear = 0,
  seed = 0,
}) {
  const { t } = useI18n()
  const titleId = useId()
  const [stepIndex, setStepIndex] = useState(0)
  const step = TOUR_STEPS[stepIndex]

  const handleStepDone = useCallback((doneStep) => {
    setStepIndex((s) => {
      const idx = TOUR_STEPS.indexOf(doneStep)
      if (idx >= 0 && idx === s) {
        return Math.min(s + 1, TOUR_STEPS.length - 1)
      }
      return s
    })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    setStepIndex(0)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const stepCopy = {
    rotate: {
      title: t.preview3dTourRotateTitle,
      body: t.preview3dTourRotateBody,
      hint: t.preview3dTourRotateHint,
    },
    pan: {
      title: t.preview3dTourPanTitle,
      body: t.preview3dTourPanBody,
      hint: t.preview3dTourPanHint,
    },
    zoomIn: {
      title: t.preview3dTourZoomInTitle,
      body: t.preview3dTourZoomInBody,
      hint: t.preview3dTourZoomInHint,
    },
    zoomOut: {
      title: t.preview3dTourZoomOutTitle,
      body: t.preview3dTourZoomOutBody,
      hint: t.preview3dTourZoomOutHint,
    },
    done: {
      title: t.preview3dTourDoneTitle,
      body: t.preview3dTourDoneBody,
      hint: t.preview3dTourDoneHint,
    },
  }[step]

  const progressDone = step === 'done' ? TOUR_STEPS.length : stepIndex

  return createPortal(
    <div className="weapon-3d-tour" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="weapon-3d-tour__backdrop" />
      <div className="weapon-3d-tour__shell">
        <header className="weapon-3d-tour__head">
          <div>
            <p className="weapon-3d-tour__kicker">
              {t.preview3dTourKicker}
              <span className="wp-beta-badge wp-beta-badge--inline">{t.betaBadge}</span>
            </p>
            <h2 id={titleId} className="weapon-3d-tour__title">
              {skinLabel || t.preview3dHelpTitle}
            </h2>
          </div>
          <button type="button" className="weapon-3d-tour__close" onClick={onClose}>
            {t.preview3dTourClose}
          </button>
        </header>

        <div className="weapon-3d-tour__stage">
          <Weapon3DPreview
            variant="tour"
            weaponName={weaponName}
            defindex={defindex}
            paint={paint}
            legacyModel={legacyModel}
            isGloves={isGloves}
            isKnife={isKnife}
            skinLabel={skinLabel}
            tourStep={step === 'done' ? null : step}
            onTourStepDone={handleStepDone}
            stickers={stickers}
            wear={wear}
            seed={seed}
          />
        </div>

        <footer className="weapon-3d-tour__coach">
          <div className="weapon-3d-tour__progress" aria-hidden>
            {TOUR_STEPS.map((id, i) => (
              <span
                key={id}
                className={
                  i < progressDone
                    ? 'weapon-3d-tour__dot is-done'
                    : i === stepIndex
                      ? 'weapon-3d-tour__dot is-active'
                      : 'weapon-3d-tour__dot'
                }
              />
            ))}
          </div>
          <p className="weapon-3d-tour__step-title">{stepCopy.title}</p>
          <p className="weapon-3d-tour__step-body">{stepCopy.body}</p>
          <p className="weapon-3d-tour__step-hint">{stepCopy.hint}</p>
          {step === 'done' ? (
            <button type="button" className="weapon-3d-tour__cta" onClick={onClose}>
              {t.preview3dTourFinish}
            </button>
          ) : (
            <p className="weapon-3d-tour__waiting">{t.preview3dTourWaiting}</p>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
