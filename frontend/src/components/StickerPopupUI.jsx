import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nProvider'
import StickerPlacementPanel from './StickerPlacementPanel'
import '../styles/AddonModal.css'

export default function StickerPopup({
  stickers,
  selectedStickers,
  onSelect,
  onChangeSlot,
  onResetSlot,
  onClose,
}) {
  const { t } = useI18n()
  const titleId = useId()
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')

  const normalizedQuery = searchTerm.toLowerCase().trim()
  const searchWords = normalizedQuery ? normalizedQuery.split(/\s+/) : []

  const filteredStickers = stickers.filter((sticker) => {
    if (!searchWords.length) return true
    const name = sticker.name.toLowerCase()
    return searchWords.every((word) => name.includes(word))
  })

  const maxLimit = 600
  const displayedStickers = filteredStickers.slice(0, maxLimit)

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

  return createPortal(
    <div className="addon-modal-root" role="presentation">
      <button
        type="button"
        className="addon-modal-backdrop"
        aria-label={t.close}
        onClick={onClose}
      />
      <div
        className="addon-modal addon-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="addon-modal__head">
          <h2 id={titleId} className="addon-modal__title">
            {t.chooseStickers}
          </h2>
          <button type="button" className="addon-modal__close-x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="addon-modal__body">
          <div className="sticker-slots" role="tablist" aria-label={t.stickerSlotsLabel}>
            {selectedStickers.map((sticker, i) => (
              <div
                key={i}
                role="tab"
                tabIndex={0}
                aria-selected={selectedSlot === i}
                className={selectedSlot === i ? 'sticker-slot is-active' : 'sticker-slot'}
                onClick={() => setSelectedSlot(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedSlot(i)
                  }
                }}
              >
                {i === 4 && (
                  <span className="wp-beta-badge--slot" title={t.betaFeatureHint}>
                    {t.betaBadge}
                  </span>
                )}
                {sticker?.image ? (
                  <>
                    <img src={sticker.image} alt={sticker.name || ''} draggable={false} />
                    <button
                      type="button"
                      className="sticker-slot__remove"
                      aria-label={t.removeSticker}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(i, null)
                      }}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span className="sticker-slot__empty">+</span>
                )}
              </div>
            ))}
          </div>

          <details className="addon-modal__placement">
            <summary className="addon-modal__placement-summary">
              <span>{t.stickerAdjustDropdown}</span>
              <span className="wp-beta-badge" title={t.betaFeatureHint}>
                {t.betaBadge}
              </span>
            </summary>
            <StickerPlacementPanel
              visible
              embedded
              stickers={selectedStickers}
              activeSlot={selectedSlot}
              onActiveSlotChange={setSelectedSlot}
              onChangeSlot={onChangeSlot}
              onResetSlot={onResetSlot}
            />
          </details>

          <input
            type="search"
            className="addon-modal__search"
            placeholder={t.findSticker}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />

          <div className="addon-modal__grid">
            {displayedStickers.map((st) => (
              <button
                key={st.id}
                type="button"
                className="addon-card"
                onClick={() => onSelect(selectedSlot, st)}
              >
                <img src={st.image} alt="" loading="lazy" draggable={false} />
                <span>{st.name}</span>
              </button>
            ))}
          </div>

          {filteredStickers.length > maxLimit && (
            <p className="addon-modal__hint">
              {t.stickerListLimited
                .replace('{shown}', String(maxLimit))
                .replace('{total}', String(filteredStickers.length))}
            </p>
          )}
        </div>

        <footer className="addon-modal__foot">
          <button type="button" className="addon-modal__btn addon-modal__btn--primary" onClick={onClose}>
            {t.done}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
