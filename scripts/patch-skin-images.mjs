/**
 * Podmienia URL obrazków w skins_*.json i gloves_*.json
 * z Nereziel GitHub (często 404 dla nowych paintów)
 * na oficjalne Steam CDN z ByMykel/CSGO-API.
 *
 * Usage:
 *   node scripts/patch-skin-images.mjs
 *   node scripts/patch-skin-images.mjs --check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'frontend', 'public', 'data')
const BYMYKEL_SKINS =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'

const checkOnly = process.argv.includes('--check')

function log(msg) {
  console.log(`[skin-images] ${msg}`)
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

/** Maps for weapons (weapon_name|paint) and gloves (defindex|paint + paint_name). */
function buildImageMaps(bymykelSkins) {
  const byWeaponPaint = new Map()
  const byDefPaint = new Map()
  const byName = new Map()

  for (const skin of bymykelSkins) {
    const image = skin.image
    if (!image) continue

    const weaponId = skin.weapon?.id
    const defindex = skin.weapon?.weapon_id
    const paint = skin.paint_index
    const name = skin.name

    if (weaponId != null && paint != null && paint !== '') {
      byWeaponPaint.set(`${weaponId}|${String(paint)}`, image)
    }
    if (defindex != null && paint != null && paint !== '') {
      byDefPaint.set(`${defindex}|${String(paint)}`, image)
    }
    if (name) {
      byName.set(name, image)
    }
  }

  return { byWeaponPaint, byDefPaint, byName }
}

function patchSkinsFile(filePath, maps) {
  const skins = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(skins)) throw new Error(`Expected array in ${filePath}`)

  let updated = 0
  let already = 0
  let unmatched = 0

  for (const skin of skins) {
    const key = `${skin.weapon_name}|${String(skin.paint)}`
    const next =
      maps.byWeaponPaint.get(key) ||
      maps.byName.get(skin.paint_name) ||
      null
    if (!next) {
      unmatched += 1
      continue
    }
    if (skin.image === next) {
      already += 1
      continue
    }
    skin.image = next
    updated += 1
  }

  if (!checkOnly && updated > 0) {
    fs.writeFileSync(filePath, `${JSON.stringify(skins, null, 4)}\n`, 'utf8')
  }

  return { updated, already, unmatched, total: skins.length }
}

function patchGlovesFile(filePath, maps) {
  const gloves = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!Array.isArray(gloves)) throw new Error(`Expected array in ${filePath}`)

  let updated = 0
  let already = 0
  let unmatched = 0

  for (const glove of gloves) {
    if (glove.paint == null || Number(glove.paint) === 0) {
      unmatched += 1
      continue
    }
    const key = `${glove.weapon_defindex}|${String(glove.paint)}`
    const next =
      maps.byDefPaint.get(key) ||
      maps.byName.get(glove.paint_name) ||
      null
    if (!next) {
      unmatched += 1
      continue
    }
    if (glove.image === next) {
      already += 1
      continue
    }
    glove.image = next
    updated += 1
  }

  if (!checkOnly && updated > 0) {
    fs.writeFileSync(filePath, `${JSON.stringify(gloves, null, 4)}\n`, 'utf8')
  }

  return { updated, already, unmatched, total: gloves.length }
}

async function main() {
  log('Pobieram ByMykel CSGO-API skins.json...')
  const bymykel = await fetchJson(BYMYKEL_SKINS)
  const maps = buildImageMaps(bymykel)
  log(
    `Mapy: weapon=${maps.byWeaponPaint.size} defindex=${maps.byDefPaint.size} name=${maps.byName.size}`,
  )

  const skinFiles = fs
    .readdirSync(dataDir)
    .filter((n) => /^skins_.*\.json$/i.test(n) && !n.includes('plugin'))
    .sort()

  for (const name of skinFiles) {
    const stats = patchSkinsFile(path.join(dataDir, name), maps)
    log(
      `${checkOnly ? 'CHECK' : 'OK'} ${name}: updated=${stats.updated} same=${stats.already} unmatched=${stats.unmatched} total=${stats.total}`,
    )
  }

  const gloveFiles = fs
    .readdirSync(dataDir)
    .filter((n) => /^gloves_.*\.json$/i.test(n) && !n.includes('plugin'))
    .sort()

  if (gloveFiles.length === 0) {
    log('Brak gloves_*.json do patcha.')
  }

  for (const name of gloveFiles) {
    const stats = patchGlovesFile(path.join(dataDir, name), maps)
    log(
      `${checkOnly ? 'CHECK' : 'OK'} ${name}: updated=${stats.updated} same=${stats.already} unmatched=${stats.unmatched} total=${stats.total}`,
    )
  }

  if (checkOnly) log('Tryb --check: nic nie zapisano.')
}

main().catch((err) => {
  console.error(`[skin-images] ${err.message}`)
  process.exit(1)
})
