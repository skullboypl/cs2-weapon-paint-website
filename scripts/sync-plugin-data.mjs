/**
 * Pobiera / aktualizuje klon Nereziel/cs2-WeaponPaints w ./plugin
 * i synchronizuje dane JSON do frontend/public.
 *
 * Usage:
 *   node scripts/sync-plugin-data.mjs              # sync z istniejącego plugin/
 *   node scripts/sync-plugin-data.mjs --fetch       # tylko clone/pull
 *   node scripts/sync-plugin-data.mjs --fetch --sync # pull + sync (domyślne przy --fetch bez flag)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fse from 'fs-extra'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pluginDir = path.join(root, 'plugin')
const PLUGIN_REPO = 'https://github.com/Nereziel/cs2-WeaponPaints.git'

const args = new Set(process.argv.slice(2))
const doFetch = args.has('--fetch') || args.has('--update') || args.has('-u')
const doSync = args.has('--sync') || (!doFetch && !args.has('--fetch-only')) || args.has('--update')
const allLangs = args.has('--all-langs')

function run(commandLine, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandLine, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: 'inherit',
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed (${code}): ${commandLine}`))
    })
  })
}

function log(msg) {
  console.log(`[plugin-sync] ${msg}`)
}

async function fetchPlugin() {
  if (!fs.existsSync(path.join(pluginDir, '.git'))) {
    if (fs.existsSync(pluginDir)) {
      log('Usuwam uszkodzony katalog plugin/...')
      await fse.remove(pluginDir)
    }
    log(`Klonuję ${PLUGIN_REPO} (sparse, bez website/img)...`)
    await run(
      `git clone --depth 1 --filter=blob:none --sparse "${PLUGIN_REPO}" "${pluginDir}"`,
    )
    // --cone działa tylko z katalogami; pomijamy ciężkie website/img
    await run(
      'git sparse-checkout set --cone website/data website/class gamedata lang',
      pluginDir,
    )
  } else {
    log('Aktualizuję plugin/ (git pull)...')
    await run('git pull --ff-only', pluginDir)
  }
  const versionFile = path.join(pluginDir, 'VERSION')
  if (fs.existsSync(versionFile)) {
    log(`Plugin VERSION: ${fs.readFileSync(versionFile, 'utf8').trim()}`)
  }
}

/**
 * Mapowanie źródeł z pluginu → cele w frontend/public
 * (dopasowane do nazw używanych przez ten frontend).
 */
function buildCopyPlan() {
  const plan = []

  const dataSrc = path.join(pluginDir, 'website', 'data')
  const dataDest = path.join(root, 'frontend', 'public', 'data')

  if (fs.existsSync(dataSrc)) {
    for (const name of fs.readdirSync(dataSrc)) {
      if (!name.endsWith('.json')) continue
      // Domyślnie tylko EN (frontend); --all-langs kopiuje wszystkie locale
      if (!allLangs && !name.includes('_en.')) continue
      plan.push({
        from: path.join(dataSrc, name),
        to: path.join(dataDest, name),
        label: `data/${name}`,
      })
    }
  }

  // Pliki JSON w root pluginu (używane przez CSS plugin)
  const rootJsonMap = [
    ['skins.json', 'frontend/public/data/skins_plugin.json'],
    ['gloves.json', 'frontend/public/data/gloves_plugin.json'],
    ['agents.json', 'frontend/public/data/agents_plugin.json'],
    ['music.json', 'frontend/public/data/music_plugin.json'],
  ]

  for (const [srcName, destRel] of rootJsonMap) {
    const from = path.join(pluginDir, srcName)
    if (fs.existsSync(from)) {
      plan.push({
        from,
        to: path.join(root, destRel),
        label: srcName,
      })
    }
  }

  // gamedata → frontend (referencja)
  const gamedataSrc = path.join(pluginDir, 'gamedata')
  if (fs.existsSync(gamedataSrc)) {
    plan.push({
      from: gamedataSrc,
      to: path.join(root, 'frontend', 'public', 'gamedata'),
      label: 'gamedata/',
      isDir: true,
    })
  }

  return plan
}

async function syncData() {
  if (!fs.existsSync(pluginDir)) {
    throw new Error('Brak folderu plugin/. Uruchom: pnpm plugin:fetch')
  }

  const plan = buildCopyPlan()
  if (plan.length === 0) {
    log('Brak plików danych do skopiowania (sprawdź sparse-checkout / website/data).')
    return
  }

  for (const item of plan) {
    await fse.ensureDir(path.dirname(item.to))
    if (item.isDir) {
      await fse.copy(item.from, item.to, { overwrite: true })
    } else {
      await fse.copy(item.from, item.to, { overwrite: true })
    }
    log(`OK  ${item.label} → ${path.relative(root, item.to)}`)
  }

  log(`Zsynchronizowano ${plan.length} pozycji.`)

  // Nowe paint ID często nie mają PNG w Nereziel/website/img - uzupełnij Steam CDN (ByMykel)
  log('Patch obrazków skinów (ByMykel / Steam CDN)...')
  await run('node scripts/patch-skin-images.mjs', root)
}

async function main() {
  if (doFetch) await fetchPlugin()
  if (doSync) await syncData()
  if (!doFetch && !doSync) {
    log('Nic do zrobienia. Użyj --fetch i/lub --sync')
  }
}

main().catch((err) => {
  console.error(`[plugin-sync] ${err.message}`)
  process.exit(1)
})
