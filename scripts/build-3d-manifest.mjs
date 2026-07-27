/**
 * Builds a tiny JSON of paints that have UV textures on LielXD (MIT).
 * Does NOT download textures - only lists what exists remotely for 3D badges / fallbacks.
 *
 * Format per paint: "1207.png" | "1207.webp" (preferred extension from repo).
 *
 * Usage:
 *   node scripts/build-3d-manifest.mjs
 *   pnpm textures:manifest
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fse from 'fs-extra'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outPath = path.join(root, 'frontend/public/data/wp3d-available.json')

const TREE_URL =
  'https://api.github.com/repos/LielXD/CS2-WeaponPaints-Website/git/trees/main?recursive=1'

function log(msg) {
  console.log(`[3d-manifest] ${msg}`)
}

async function main() {
  log('Pobieram drzewo plików LielXD (GitHub API)...')
  const res = await fetch(TREE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'weapon-paints-website-manifest',
    },
  })
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`)
  const data = await res.json()
  if (data.truncated) {
    log('UWAGA: drzewo truncated - wynik może być niekompletny')
  }

  /** @type {Record<string, Record<string, 'png'|'webp'>>} */
  const paints = {}
  /** @type {Set<string>} */
  const models = new Set()

  for (const item of data.tree || []) {
    if (item.type !== 'blob' || typeof item.path !== 'string') continue
    const p = item.path

    const modelMatch = p.match(/^src\/\[models\]\/([^/]+)\.glb$/)
    if (modelMatch) {
      models.add(modelMatch[1])
      continue
    }

    // skip metal maps
    if (p.includes('_metal.')) continue

    const texMatch = p.match(
      /^src\/\[textures\]\/([^/]+)\/(\d+)\.(png|webp)$/,
    )
    if (!texMatch) continue

    const key = texMatch[1]
    const paint = texMatch[2]
    const ext = texMatch[3]
    if (!paints[key]) paints[key] = {}
    // Prefer png when both exist
    if (!paints[key][paint] || (ext === 'png' && paints[key][paint] === 'webp')) {
      paints[key][paint] = ext
    }
  }

  /** @type {Record<string, string[]>} paintId list (compat) + formats map */
  const paintIds = {}
  /** @type {Record<string, Record<string, string>>} */
  const formats = {}
  for (const key of Object.keys(paints).sort()) {
    const ids = Object.keys(paints[key]).sort((a, b) => Number(a) - Number(b))
    paintIds[key] = ids
    formats[key] = paints[key]
  }

  const paintCount = Object.values(paintIds).reduce((n, arr) => n + arr.length, 0)
  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'https://github.com/LielXD/CS2-WeaponPaints-Website',
    license: 'MIT',
    note:
      'UV paint IDs + preferred file extension on LielXD. App streams at runtime - do not sync locally.',
    models: [...models].sort(),
    paints: paintIds,
    formats,
    totals: {
      models: models.size,
      weaponsWithTextures: Object.keys(paintIds).length,
      paints: paintCount,
    },
  }

  await fse.ensureDir(path.dirname(outPath))
  await fs.promises.writeFile(outPath, `${JSON.stringify(payload)}\n`, 'utf8')
  const kb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024)
  log(
    `OK models=${models.size} paintKeys=${Object.keys(paintIds).length} paints=${paintCount} (~${kb} KB)`,
  )
  log(`Zapisano ${path.relative(root, outPath)}`)
}

main().catch((err) => {
  console.error(`[3d-manifest] ${err.message}`)
  process.exit(1)
})
