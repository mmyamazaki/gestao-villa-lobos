/**
 * Produção: garante Prisma client + dist-server, depois `await start()` no bundle Express.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const target = join(root, 'dist-server', 'server', 'index.js')
const prismaClientDir = join(root, 'node_modules', '.prisma', 'client')
const tscJs = join(root, 'node_modules', 'typescript', 'lib', 'tsc.js')

console.error('[start] cwd=', root)

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...opts,
  })
}

function ensurePrismaClient() {
  if (existsSync(prismaClientDir)) return true
  console.error('[start] Pasta .prisma/client ausente — a correr prisma generate…')
  const r = run('npx', ['prisma', 'generate'], { shell: true })
  if (r.status !== 0) {
    console.error(
      '[start] prisma generate falhou. Confirme rede no deploy e que "prisma" está em dependencies.',
    )
    return false
  }
  return true
}

function compileServer() {
  console.error('[start] Falta dist-server/server/index.js — a compilar servidor…')
  if (existsSync(tscJs)) {
    const r = run(process.execPath, [tscJs, '-p', 'tsconfig.server.json'])
    if (r.status === 0) return true
  }
  const r2 = run('npx', ['tsc', '-p', 'tsconfig.server.json'], { shell: true })
  return r2.status === 0
}

if (!ensurePrismaClient()) {
  process.exit(1)
}

if (!existsSync(target)) {
  if (!compileServer() || !existsSync(target)) {
    console.error(
      '[start] Build do servidor em falta. No painel: npm run build (Vite + tsc), ou npm install com scripts ativos.',
    )
    process.exit(1)
  }
}

console.log('[prod] iniciando produção')

const mod = await import('../dist-server/server/index.js')
const start = mod.start || mod.default?.start

if (typeof start !== 'function') {
  console.error('[prod] export start() não encontrado em dist-server/server/index.js')
  process.exit(1)
}

await start()
console.log('[prod] start() executado com sucesso')
