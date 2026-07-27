import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nProvider'
import '../styles/AddonModal.css'

export default function KeychainPopup({
  keychains,
  selectedKeychainId,
  offsetX,
  offsetY,
  offsetZ = 0,
  seed = 0,
  onSelect,
  onClose,
}) {
  const { t } = useI18n()
  const titleId = useId()
  const [searchTerm, setSearchTerm] = useState('')
  const [localOffsetX, setLocalOffsetX] = useState(offsetX)
  const [localOffsetY, setLocalOffsetY] = useState(offsetY)
  const [localOffsetZ, setLocalOffsetZ] = useState(offsetZ)
  const [localSeed, setLocalSeed] = useState(seed)

  const filteredKeychains = keychains.filter((kc) =>
    kc.name.toLowerCase().includes(searchTerm.toLowerCase().trim()),
  )

  const selected = keychains.find((k) => String(k.id) === String(selectedKeychainId))

  const emit = (id, x, y, z, s) => {
    onSelect(id, x, y, z, s)
  }

  useEffect(() => {
    setLocalOffsetX(offsetX)
    setLocalOffsetY(offsetY)
    setLocalOffsetZ(offsetZ)
    setLocalSeed(seed)
  }, [offsetX, offsetY, offsetZ, seed])

  useEffect(() => {
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
  }, [onClose])

  const applyAndClose = () => {
    emit(selectedKeychainId || '', localOffsetX, localOffsetY, localOffsetZ, localSeed)
    onClose()
  }

  const pick = (id) => {
    emit(id, localOffsetX, localOffsetY, localOffsetZ, localSeed)
  }

  return createPortal(
    <div className="addon-modal-root" role="presentation">
      <button
        type="button"
        className="addon-modal-backdrop"
        aria-label={t.close}
        onClick={applyAndClose}
      />
      <div
        className="addon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="addon-modal__head">
          <h2 id={titleId} className="addon-modal__title">
            {t.chooseKeychain}
          </h2>
          <button type="button" className="addon-modal__close-x" onClick={applyAndClose}>
            ×
          </button>
        </header>

        <div className="addon-modal__body">
          {selected ? (
            <div className="keychain-selected">
              <img src={selected.image} alt="" draggable={false} />
              <div>
                <p>{selected.name}</p>
                <span>
                  X: {localOffsetX} - Y: {localOffsetY} - Z: {localOffsetZ} - Seed:{' '}
                  {localSeed}
                </span>
              </div>
            </div>
          ) : (
            <p className="addon-modal__hint">{t.noKeychainSelected}</p>
          )}

          <div className="keychain-offsets">
            <label>
              {t.keychainOffsetX}
              <input
                type="number"
                step="any"
                value={localOffsetX}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setLocalOffsetX(v)
                  emit(selectedKeychainId || '', v, localOffsetY, localOffsetZ, localSeed)
                }}
              />
            </label>
            <label>
              {t.keychainOffsetY}
              <input
                type="number"
                step="any"
                value={localOffsetY}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setLocalOffsetY(v)
                  emit(selectedKeychainId || '', localOffsetX, v, localOffsetZ, localSeed)
                }}
              />
            </label>
            <label>
              {t.keychainOffsetZ}
              <input
                type="number"
                step="any"
                value={localOffsetZ}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setLocalOffsetZ(v)
                  emit(selectedKeychainId || '', localOffsetX, localOffsetY, v, localSeed)
                }}
              />
            </label>
            <label>
              {t.keychainSeed}
              <input
                type="number"
                step={1}
                value={localSeed}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value) || 0)
                  setLocalSeed(v)
                  emit(selectedKeychainId || '', localOffsetX, localOffsetY, localOffsetZ, v)
                }}
              />
            </label>
          </div>

          <input
            type="search"
            className="addon-modal__search"
            placeholder={t.findKeychain}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />

          <div className="addon-modal__grid addon-modal__grid--keychains">
            <button
              type="button"
              className={
                !selectedKeychainId || selectedKeychainId === '0' || selectedKeychainId === ''
                  ? 'addon-modal__none is-selected'
                  : 'addon-modal__none'
              }
              onClick={() => pick('')}
            >
              {t.none}
            </button>
            {filteredKeychains.map((kc) => (
              <button
                key={kc.id}
                type="button"
                className={
                  String(kc.id) === String(selectedKeychainId)
                    ? 'addon-card is-selected'
                    : 'addon-card'
                }
                onClick={() => pick(kc.id)}
              >
                <img src={kc.image} alt="" loading="lazy" draggable={false} />
                <span>{kc.name}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="addon-modal__foot">
          <button type="button" className="addon-modal__btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="addon-modal__btn addon-modal__btn--primary"
            onClick={applyAndClose}
          >
            {t.done}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
