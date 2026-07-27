import fs from 'fs'
import path from 'path'

const assets = path.resolve('dist/assets')
const file = fs.readdirSync(assets).find((f) => f.startsWith('index-') && f.endsWith('.js'))
const s = fs.readFileSync(path.join(assets, file), 'utf8')
const idx = s.indexOf('function')
// Find getApiBase-ish: String("...")
const m = s.match(/String\("([^"]+)"\)\.replace\(\/\\\/\+\$\//)
console.log('bundle', file)
console.log('apiBase', m ? m[1] : 'NOT_FOUND')
console.log('YOUR_DOMAIN', s.includes('YOUR_DOMAIN'))
