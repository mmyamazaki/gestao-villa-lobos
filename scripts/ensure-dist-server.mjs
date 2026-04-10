/**
 * prestart: garante dist-server/server/index.js e que não está **desatualizado** face ao TS.
 * Sem isto, um `vite build` no painel deixa o bundle da API antigo para sempre → “correções”
 * no Git nunca chegam ao Node em produção.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { serverBundleNeedsRebuild } from './lib/server-bundle-needs-rebuild.mjs'

const target = join(process.cwd(), 'dist-server', 'server', 'index.js')

if (!serverBundleNeedsRebuild(process.cwd())) {
  console.log('[prestart] OK (bundle alinhado com o TS):', target)
  process.exit(0)
}

if (existsSync(target)) {
  console.error('[prestart] Fontes server/*.ts mais novas que o bundle — a correr tsc…')
} else {
  console.error('[prestart] Em falta dist-server/server/index.js — a correr tsc…')
}

const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.server.json'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
})

if (r.status !== 0) {
  console.error(
    '[prestart] tsc falhou. No painel use Build: npm run build, ou garanta typescript em dependencies.',
  )
  process.exit(r.status ?? 1)
}

if (!existsSync(target)) {
  console.error('[prestart] Ainda não existe:', target)
  process.exit(1)
}

console.log('[prestart] Bundle API atualizado:', target)
process.exit(0)
