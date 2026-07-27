import { randomBytes } from 'node:crypto'
import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const cacheDir = path.join(root, 'backend', 'storage', 'cache')
const rateDir = path.join(root, 'backend', 'storage', 'ratelimit')
const versionFile = path.join(cacheDir, 'CACHE_VERSION')

/**
 * Bump API cache build id and wipe PHP read/rate cache files.
 * Called on `pnpm dev` / `pnpm release` so stale SQL skip caches cannot survive restarts.
 */
export function bumpCacheVersion({ clear = true, reason = '' } = {}) {
  fse.ensureDirSync(cacheDir)
  fse.ensureDirSync(rateDir)

  const version = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  fse.writeFileSync(versionFile, `${version}\n`, 'utf8')

  let removed = 0
  if (clear) {
    for (const dir of [cacheDir, rateDir]) {
      if (!fse.existsSync(dir)) continue
      for (const name of fse.readdirSync(dir)) {
        if (name === '.gitignore' || name === 'CACHE_VERSION') continue
        fse.removeSync(path.join(dir, name))
        removed += 1
      }
    }
  }

  const tag = reason ? ` (${reason})` : ''
  console.log(
    `Cache version${tag}: ${version}` + (clear ? ` — cleared ${removed} file(s)` : ''),
  )
  return version
}

export function readCacheVersion() {
  try {
    return fse.readFileSync(versionFile, 'utf8').trim()
  } catch {
    return null
  }
}

export function writeCacheVersionTo(destDir, version = readCacheVersion()) {
  if (!version) return null
  fse.ensureDirSync(destDir)
  fse.writeFileSync(path.join(destDir, 'CACHE_VERSION'), `${version}\n`, 'utf8')
  return version
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isDirectRun) {
  bumpCacheVersion({ reason: 'cli' })
}
