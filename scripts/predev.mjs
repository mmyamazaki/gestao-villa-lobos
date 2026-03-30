/**
 * Antes de `npm run dev`: libera API_PORT, alinha .env, valida variáveis e testa Prisma.
 * Unix/macOS: encerra processos que escutam na porta desejada (evita dois servidores).
 */
import { config } from 'dotenv'
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeDatabaseUrlForPrisma } from './lib/normalize-database-url.mjs'
import { REQUIRED_ENV_KEYS } from './lib/required-env.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')

function ensureEnvFile() {
  if (!existsSync(envPath)) {
    if (existsSync(examplePath)) {
      copyFileSync(examplePath, envPath)
      console.warn('[predev] Criado .env a partir de .env.example — preencha DATABASE_URL e chaves do Supabase.')
      process.exit(1)
    }
    console.error('[predev] Falta o arquivo .env e .env.example.')
    process.exit(1)
  }
}

function loadEnv() {
  config({ path: envPath })
}

function resolvePortNumber() {
  const raw = process.env.API_PORT?.trim()
  if (!raw) return 3333
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 65535) return 3333
  return n
}

function setApiPortInEnv(newPort) {
  let text = readFileSync(envPath, 'utf8')
  const line = `API_PORT=${newPort}`
  if (/^API_PORT=/m.test(text)) {
    text = text.replace(/^API_PORT=.*$/m, line)
  } else {
    text = text.trimEnd() + `\n\n${line}\n`
  }
  writeFileSync(envPath, text, 'utf8')
  process.env.API_PORT = String(newPort)
  console.log(`[predev] API_PORT gravada no .env: ${newPort}`)
}

function ensureApiPortLine() {
  const text = readFileSync(envPath, 'utf8')
  if (!/^API_PORT=/m.test(text)) {
    setApiPortInEnv(3333)
  }
}

function verifyRequired() {
  const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k]?.trim())
  if (missing.length > 0) {
    console.error('[predev] Variáveis obrigatórias ausentes ou vazias no .env:', missing.join(', '))
    console.error('[predev] Preencha conforme .env.example (não é possível inventar segredos automaticamente).')
    process.exit(1)
  }
}

/** Unix: encerra PIDs que escutam em TCP:port (LISTEN). */
function killListenersOnPort(port) {
  if (process.platform === 'win32') {
    console.log(
      '[predev] Windows: encerramento automático de processo por porta não está implementado; se EADDRINUSE, mude API_PORT no .env.',
    )
    return
  }
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!out) return
    const pids = [...new Set(out.split(/\s+/).filter(Boolean))]
    for (const pid of pids) {
      console.log(`[predev] Encerrando processo na porta ${port} (PID ${pid})…`)
      try {
        execSync(`kill -15 ${pid}`, { stdio: 'ignore' })
      } catch {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* nenhum processo */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** true se conseguimos fazer bind em 127.0.0.1:port (porta livre para nossa API). */
function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true))
    })
  })
}

async function pickUsableApiPort(startPort) {
  killListenersOnPort(startPort)
  await sleep(450)
  let p = startPort
  for (let i = 0; i < 40; i++) {
    if (await isPortFree(p)) {
      if (p !== startPort) {
        setApiPortInEnv(p)
      }
      return p
    }
    killListenersOnPort(p)
    await sleep(200)
    p += 1
  }
  console.error('[predev] Não foi possível obter uma porta livre para a API (3333–3362).')
  process.exit(1)
}

async function checkPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  const raw = process.env.DATABASE_URL?.trim()
  const prisma = new PrismaClient(
    raw ? { datasources: { db: { url: normalizeDatabaseUrlForPrisma(raw) } } } : undefined,
  )
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`
    console.log('[predev] Prisma: conexão com o banco (DATABASE_URL) OK.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  console.log('[predev] Verificando ambiente…')
  ensureEnvFile()
  loadEnv()
  ensureApiPortLine()
  loadEnv()
  verifyRequired()

  const wanted = resolvePortNumber()
  const port = await pickUsableApiPort(wanted)

  await checkPrisma()

  console.log(`[predev] Pronto. API usará 127.0.0.1:${port} (proxy Vite / wait-api leem API_PORT do .env).`)
}

main().catch((e) => {
  console.error('[predev] Falha:', e)
  process.exit(1)
})
