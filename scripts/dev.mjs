import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const frontendDir = path.join(root, 'frontend')
const backendDir = path.join(root, 'backend')

const BACKEND_HOST = process.env.WP_BACKEND_HOST || '127.0.0.1'
const BACKEND_PORT = process.env.WP_BACKEND_PORT || '8080'
const isWin = process.platform === 'win32'

const children = []
let shuttingDown = false

function log(scope, message) {
  const stamp = new Date().toLocaleTimeString()
  console.log(`[${stamp}] [${scope}] ${message}`)
}

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function runCheck(command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      stdio: 'ignore',
      shell: true,
      windowsHide: true,
    })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

function phpBinary() {
  try {
    return execFileSync('php', ['-r', 'echo PHP_BINARY;'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim()
  } catch {
    return null
  }
}

function phpHasPdoMysql(bin, iniArgs = []) {
  try {
    const out = execFileSync(bin, [...iniArgs, '-m'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    return /(^|\n)pdo_mysql(\r?\n|$)/i.test(out)
  } catch {
    return false
  }
}

/**
 * Resolve PHP + absolute extension_dir so pdo_mysql always loads.
 * Relative extension_dir="ext" fails when cwd != PHP install.
 */
function resolvePhpRuntime() {
  const bin = phpBinary()
  if (!bin) return null

  const phpHome = path.dirname(bin)
  const candidates = [
    process.env.PHP_EXTENSION_DIR,
    path.join(phpHome, 'ext'),
    path.join(phpHome, 'extensions'),
  ].filter(Boolean)

  const extensionDir = candidates.find((dir) =>
    fs.existsSync(path.join(dir, isWin ? 'php_pdo_mysql.dll' : 'pdo_mysql.so')),
  )

  if (!extensionDir) {
    return { bin, phpHome, extensionDir: null, iniArgs: [] }
  }

  const iniArgs = ['-d', `extension_dir=${extensionDir}`]

  // Force-load only when not already enabled via php.ini (avoids "already loaded")
  if (!phpHasPdoMysql(bin, iniArgs)) {
    iniArgs.push('-d', 'extension=pdo_mysql')
    if (fs.existsSync(path.join(extensionDir, isWin ? 'php_mysqli.dll' : 'mysqli.so'))) {
      iniArgs.push('-d', 'extension=mysqli')
    }
  }

  return { bin, phpHome, extensionDir, iniArgs }
}

function freeBackendPort() {
  if (!isWin) return
  try {
    const out = execFileSync(
      'cmd',
      ['/c', `netstat -ano | findstr :${BACKEND_PORT} | findstr LISTENING`],
      { encoding: 'utf8', windowsHide: true },
    )
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/(\d+)\s*$/)
      if (m) pids.add(m[1])
    }
    for (const pid of pids) {
      log('dev', `Killing old process on :${BACKEND_PORT} (pid ${pid})`)
      try {
        execFileSync('taskkill', ['/pid', pid, '/f', '/t'], {
          stdio: 'ignore',
          windowsHide: true,
        })
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* nothing listening */
  }
}

function quote(arg) {
  if (!/\s|"/.test(arg)) return arg
  return `"${String(arg).replace(/"/g, '\\"')}"`
}

function start(label, commandLine, cwd, colorCode) {
  const child = spawn(commandLine, {
    cwd,
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  })

  children.push(child)

  const paint = (text) => `\x1b[${colorCode}m${text}\x1b[0m`

  const forward = (stream) => {
    stream.on('data', (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line.trim() === '') continue
        process.stdout.write(`${paint(`[${label}]`)} ${line}\n`)
      }
    })
  }

  forward(child.stdout)
  forward(child.stderr)

  child.on('error', (err) => {
    console.error(`[${label}] failed to start:`, err.message)
    shutdown(1)
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    log(label, `exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
    shutdown(code ?? 1)
  })

  return child
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  log('dev', 'Stopping frontend + backend...')

  for (const child of children) {
    if (!child.pid || child.killed || child.exitCode !== null) continue
    if (isWin) {
      spawn(`taskkill /pid ${child.pid} /f /t`, {
        stdio: 'ignore',
        shell: true,
        windowsHide: true,
      })
    } else {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => process.exit(exitCode), 400)
}

async function main() {
  if (!(await runCheck('php -v'))) {
    fail('PHP nie jest w PATH. Zainstaluj PHP 8+ albo dodaj go do PATH.')
  }
  if (!(await runCheck('pnpm -v'))) {
    fail('pnpm nie jest w PATH. Zainstaluj: npm i -g pnpm')
  }

  const runtime = resolvePhpRuntime()
  if (!runtime) fail('Nie znaleziono PHP_BINARY.')

  if (!runtime.extensionDir) {
    fail(
      `Nie znaleziono php_pdo_mysql w katalogu ext obok ${runtime.bin}. Doinstaluj PHP MySQL extensions.`,
    )
  }

  if (!phpHasPdoMysql(runtime.bin, runtime.iniArgs)) {
    fail(
      `Nie udało się załadować pdo_mysql (extension_dir=${runtime.extensionDir}).`,
    )
  }

  freeBackendPort()

  const { bumpCacheVersion } = await import('./bump-cache-version.mjs')
  bumpCacheVersion({ reason: 'dev restart' })

  const phpArgs = [
    ...runtime.iniArgs,
    '-d',
    `session.save_path=${path.join(backendDir, 'storage', 'sessions')}`,
    '-d',
    'session.gc_maxlifetime=2592000',
    '-S',
    `${BACKEND_HOST}:${BACKEND_PORT}`,
    '-t',
    backendDir,
  ]
  const backendCmd = [quote(runtime.bin), ...phpArgs.map(quote)].join(' ')

  log('dev', `PHP       → ${runtime.bin}`)
  log('dev', `ext dir   → ${runtime.extensionDir}`)
  log('dev', 'pdo_mysql → OK')
  log('dev', `Backend   → http://${BACKEND_HOST}:${BACKEND_PORT}`)
  log('dev', 'Frontend  → http://localhost:5173  (proxy /api → backend)')
  log('dev', 'Ctrl+C zatrzymuje oba procesy\n')

  // cwd = backendDir so relative paths in PHP are stable; ext dir is absolute via -d
  start('backend', backendCmd, backendDir, '36')
  start('frontend', 'pnpm run dev', frontendDir, '32')
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
