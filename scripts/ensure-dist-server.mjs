/**
 * Hostinger: se o painel só correr `vite build` ou o `tsc` falhar, falta dist-server/server/index.js
 * e o server.js quebra ao importar. Este prestart gera a API compilada se estiver em falta.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const target = join(process.cwd(), 'dist-server', 'server', 'index.js')

if (existsSync(target)) {
  console.log('[prestart] OK:', target)
  process.exit(0)
}

console.error(
  '[prestart] Em falta: dist-server/server/index.js — a correr npx tsc -p tsconfig.server.json …',
)

const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.server.json'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
})

if (r.status !== 0) {
  console.error(
    '[prestart] tsc falhou. No painel use Build: npm run build (Vite + tsc), não só vite build.',
  )
  process.exit(r.status ?? 1)
}

if (!existsSync(target)) {
  console.error('[prestart] Ainda não existe:', target)
  process.exit(1)
}

console.log('[prestart] Gerado:', target)
process.exit(0)
