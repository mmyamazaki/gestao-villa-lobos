/**
 * Entrada de produção: garante dist-server antes de carregar a API.
 * Alguns painéis ignoram npm lifecycle (prestart) — isto evita 503 silencioso.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const target = join(process.cwd(), 'dist-server', 'server', 'index.js')

function compileServer() {
  console.error('[start] Falta dist-server/server/index.js — a correr tsc…')
  const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.server.json'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  })
  return r.status === 0
}

if (!existsSync(target)) {
  if (!compileServer() || !existsSync(target)) {
    console.error(
      '[start] Build do servidor em falta. No painel use: npm run build (Vite + tsc), não só vite build.',
    )
    process.exit(1)
  }
}

await import(pathToFileURL(target).href)
