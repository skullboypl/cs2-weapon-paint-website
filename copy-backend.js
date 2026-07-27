import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendSrc = path.resolve(__dirname, 'backend')
const backendDest = path.resolve(__dirname, 'dist/api')

fse.removeSync(backendDest)

function shouldCopy(src) {
  const lower = src.toLowerCase()
  const base = path.basename(src).toLowerCase()
  if (lower.includes('.vscode')) return false
  if (lower.includes(`${path.sep}old`) || lower.endsWith(`${path.sep}old`)) return false
  if (base === 'config.php') return false
  if (
    (lower.includes(`${path.sep}storage${path.sep}sessions${path.sep}`) ||
      lower.includes(`${path.sep}storage${path.sep}cache${path.sep}`) ||
      lower.includes(`${path.sep}storage${path.sep}ratelimit${path.sep}`)) &&
    base !== '.gitignore' &&
    base !== 'cache_version' &&
    base !== 'CACHE_VERSION'
  ) {
    return false
  }
  return true
}

fse.copySync(backendSrc, backendDest, {
  overwrite: true,
  filter: shouldCopy,
})

fse.ensureDirSync(path.join(backendDest, 'storage', 'sessions'))
fse.ensureDirSync(path.join(backendDest, 'storage', 'cache'))
fse.ensureDirSync(path.join(backendDest, 'storage', 'ratelimit'))

console.log('Backend copied to dist/api (no config.php, no session files)')
