import { STICKER_SLOT_COUNT } from '../lib/stickerFormat'
import { useI18n } from '../i18n/I18nProvider'
import './../styles/StickerPlacement.css'

function FieldRow({ label, children }) {
  return (
    <div className="sticker-placement__field">
      <div className="sticker-placement__field-head">
        <span>{label}</span>
      </div>
      <div className="sticker-placement__field-controls">{children}</div>
    </div>
  )
}

export default function StickerPlacementPanel({
  stickers,
  activeSlot,
  onActiveSlotChange,
  onChangeSlot,
  onResetSlot,
  visible,
  embedded = false,
}) {
  const { t } = useI18n()
  if (!visible) return null

  const slot = stickers?.[activeSlot]
  const hasSticker = Boolean(slot?.id)

  const setField = (field, value) => {
    if (!hasSticker) return
    onChangeSlot(activeSlot, { ...slot, [field]: value })
  }

  const fields = hasSticker ? (
    <div className="sticker-placement__fields">
      <FieldRow label={t.stickerOffsetX}>
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.005}
          value={Number(slot.x) || 0}
          onChange={(e) => setField('x', Number(e.target.value))}
        />
        <input
          type="number"
          step={0.01}
          value={Number(slot.x) || 0}
          onChange={(e) => setField('x', Number(e.target.value))}
        />
      </FieldRow>
      <FieldRow label={t.stickerOffsetY}>
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.005}
          value={Number(slot.y) || 0}
          onChange={(e) => setField('y', Number(e.target.value))}
        />
        <input
          type="number"
          step={0.01}
          value={Number(slot.y) || 0}
          onChange={(e) => setField('y', Number(e.target.value))}
        />
      </FieldRow>
      <FieldRow label={t.stickerScale}>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.05}
          value={Number(slot.scale) || 1}
          onChange={(e) => setField('scale', Number(e.target.value))}
        />
        <input
          type="number"
          step={0.05}
          min={0.1}
          value={Number(slot.scale) || 1}
          onChange={(e) => setField('scale', Number(e.target.value))}
        />
      </FieldRow>
      <FieldRow label={t.stickerRotation}>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={Number(slot.rotation) || 0}
          onChange={(e) => setField('rotation', Number(e.target.value))}
        />
        <input
          type="number"
          step={1}
          value={Number(slot.rotation) || 0}
          onChange={(e) => setField('rotation', Number(e.target.value))}
        />
      </FieldRow>
      <FieldRow label={t.stickerWear}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={Number(slot.wear) || 0}
          onChange={(e) => setField('wear', Number(e.target.value))}
        />
        <input
          type="number"
          step={0.01}
          min={0}
          max={1}
          value={Number(slot.wear) || 0}
          onChange={(e) => setField('wear', Number(e.target.value))}
        />
      </FieldRow>
      <button
        type="button"
        className="sticker-placement__reset"
        onClick={() => onResetSlot(activeSlot)}
      >
        {t.stickerResetSlot}
      </button>
    </div>
  ) : (
    <p className="sticker-placement__empty">{t.stickerSlotEmpty}</p>
  )

  if (embedded) {
    return (
      <div className="sticker-placement sticker-placement--embedded">
        <p className="sticker-placement__hint">{t.stickerPlacementHint}</p>
        {fields}
      </div>
    )
  }

  return (
    <aside className="sticker-placement" aria-label={t.stickerPlacementTitle}>
      <div className="sticker-placement__title-row">
        <h3 className="sticker-placement__title">{t.stickerPlacementTitle}</h3>
        <span className="wp-beta-badge" title={t.betaFeatureHint}>
          {t.betaBadge}
        </span>
      </div>
      <p className="sticker-placement__hint">{t.stickerPlacementHint}</p>

      <div className="sticker-placement__slots" role="tablist">
        {Array.from({ length: STICKER_SLOT_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={activeSlot === i}
            className={
              activeSlot === i
                ? 'sticker-placement__slot is-active'
                : 'sticker-placement__slot'
            }
            onClick={() => onActiveSlotChange(i)}
          >
            {i === 4 && (
              <span className="wp-beta-badge wp-beta-badge--slot">{t.betaBadge}</span>
            )}
            {stickers?.[i]?.image ? (
              <img src={stickers[i].image} alt="" draggable={false} />
            ) : (
              <span className="sticker-placement__slot-num">{i + 1}</span>
            )}
          </button>
        ))}
      </div>

      {fields}
    </aside>
  )
}
