/** Plugin sticker format: id;schema;x;y;wear;scale;rotation */

export const STICKER_SLOT_COUNT = 5
export const EMPTY_STICKER_STRING = '0;0;0;0;0;0;0'

export function emptyStickerSlots() {
  return Array.from({ length: STICKER_SLOT_COUNT }, () => null)
}

/**
 * @returns {{ id: number, schema: number, x: number, y: number, wear: number, scale: number, rotation: number } | null}
 */
export function parseStickerString(val) {
  if (val == null || val === '' || val === EMPTY_STICKER_STRING) return null
  const parts = String(val).split(';')
  const id = Number.parseInt(parts[0], 10)
  if (!Number.isFinite(id) || id === 0) return null
  return {
    id,
    schema: Number(parts[1]) || 0,
    x: Number(parts[2]) || 0,
    y: Number(parts[3]) || 0,
    wear: Number(parts[4]) || 0,
    scale: parts[5] !== undefined && parts[5] !== '' ? Number(parts[5]) : 1,
    rotation: Number(parts[6]) || 0,
  }
}

/**
 * @param {{ id?: number, schema?: number, x?: number, y?: number, wear?: number, scale?: number, rotation?: number } | null | undefined} sticker
 */
export function serializeSticker(sticker) {
  if (!sticker) return EMPTY_STICKER_STRING
  const id = Number(sticker.id) || 0
  if (id <= 0) return EMPTY_STICKER_STRING
  const schema = Number(sticker.schema) || 0
  const x = Number(sticker.x) || 0
  const y = Number(sticker.y) || 0
  const wear = Number(sticker.wear) || 0
  const scale =
    sticker.scale === undefined || sticker.scale === null || sticker.scale === ''
      ? 1
      : Number(sticker.scale)
  const rotation = Number(sticker.rotation) || 0
  return `${id};${schema};${x};${y};${wear};${Number.isFinite(scale) ? scale : 1};${rotation}`
}

/** Normalize POST value: full string or bare id. */
export function coerceStickerInput(raw) {
  if (raw == null || raw === '') return EMPTY_STICKER_STRING
  const str = String(raw).trim()
  if (str.includes(';')) {
    const parsed = parseStickerString(str)
    return parsed ? serializeSticker(parsed) : EMPTY_STICKER_STRING
  }
  const id = Number.parseInt(str, 10)
  if (!Number.isFinite(id) || id <= 0) return EMPTY_STICKER_STRING
  return serializeSticker({ id, schema: 0, x: 0, y: 0, wear: 0, scale: 1, rotation: 0 })
}

/**
 * Merge DB placement with catalog sticker (name/image).
 * @param {ReturnType<typeof parseStickerString>} placement
 * @param {{ id: number|string, name?: string, image?: string } | null} catalog
 */
export function mergeStickerWithCatalog(placement, catalog) {
  if (!placement) return null
  return {
    ...placement,
    name: catalog?.name ?? `#${placement.id}`,
    image: catalog?.image ?? '',
  }
}
