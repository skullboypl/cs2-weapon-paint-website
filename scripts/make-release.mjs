import { spawnSync } from 'child_process'
import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { bumpCacheVersion, writeCacheVersionTo } from './bump-cache-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const releasesDir = path.join(root, 'releases')
const newestDir = path.join(releasesDir, 'newest-release')
const legacyNewestDir = path.join(root, 'newest-release')

function run(command, args, opts = {}) {
  const res = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...opts.env },
  })
  if (res.status !== 0) {
    // On Windows, pnpm/npm often need shell
    if (process.platform === 'win32') {
      const retry = spawnSync(command, args, {
        cwd: root,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, ...opts.env },
      })
      if (retry.status !== 0) process.exit(retry.status ?? 1)
      return
    }
    process.exit(res.status ?? 1)
  }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}`
  )
}

function stageExtras() {
  fse.copySync(path.join(root, 'scripts', 'release-INSTALL.txt'), path.join(distDir, 'INSTALL.txt'))
  fse.copySync(path.join(root, 'README.md'), path.join(distDir, 'README.md'))
  const shots = path.join(root, 'readme')
  if (fse.existsSync(shots)) {
    fse.copySync(shots, path.join(distDir, 'readme'), { overwrite: true })
  }
  // Never ship secrets
  const leaked = path.join(distDir, 'api', 'config.php')
  if (fse.existsSync(leaked)) fse.removeSync(leaked)
}

function mirrorNewest() {
  fse.ensureDirSync(releasesDir)
  // Old path was repo-root/newest-release - drop leftover if present
  if (fse.existsSync(legacyNewestDir)) fse.removeSync(legacyNewestDir)
  fse.removeSync(newestDir)
  fse.copySync(distDir, newestDir, { overwrite: true })
}

/** Optional stamped archive under releases/ (upload target is releases/newest-release/). */
function makeOptionalZip() {
  if (process.env.RELEASE_ZIP !== '1') return

  fse.ensureDirSync(releasesDir)
  const name = `weapon-paints-website-${stamp()}.zip`
  const stampedZip = path.join(releasesDir, name)
  if (fse.existsSync(stampedZip)) fse.removeSync(stampedZip)

  const tarArgs = ['-a', '-cf', stampedZip, '-C', newestDir, '.']
  const tar = spawnSync('tar', tarArgs, { cwd: root, stdio: 'inherit' })
  if (tar.status !== 0) {
    const ps = `
      Compress-Archive -Path (Join-Path '${newestDir.replace(/'/g, "''")}' '*') -DestinationPath '${stampedZip.replace(/'/g, "''")}' -CompressionLevel Optimal -Force
    `
    const p = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
      cwd: root,
      stdio: 'inherit',
    })
    if (p.status !== 0) {
      console.error('Failed to create zip (tar and Compress-Archive both failed)')
      process.exit(1)
    }
  }

  const mb = (fse.statSync(stampedZip).size / (1024 * 1024)).toFixed(2)
  console.log(`Zip: ${path.relative(root, stampedZip)} (${mb} MB)`)
}

console.log('Bumping cache version…')
bumpCacheVersion({ reason: 'release' })

console.log('Building frontend + api…')
run('pnpm', ['--dir', 'frontend', 'exec', 'vite', 'build', '--emptyOutDir'])
run('node', ['copy-backend.js'])
writeCacheVersionTo(path.join(distDir, 'api', 'storage', 'cache'))

console.log('Staging INSTALL / README / screenshots…')
stageExtras()

console.log('Mirroring to releases/newest-release/…')
mirrorNewest()

makeOptionalZip()

console.log('')
console.log('Release ready (local only):')
console.log(`  upload this folder: ${path.relative(root, newestDir)}/`)
console.log('  (optional zip: set RELEASE_ZIP=1)')
