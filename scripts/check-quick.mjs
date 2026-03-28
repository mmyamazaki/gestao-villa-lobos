/**
 * Checagem rápida sem rede: .env existe, API_PORT presente, chaves obrigatórias não vazias.
 * Usada em `prebuild` / `prelint` (não mata processos nem testa Prisma).
 */
import { config } from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_ENV_KEYS } from './lib/required-env.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')

if (!existsSync(envPath)) {
  console.error('[check-quick] Falta o arquivo .env na raiz do projeto.')
  process.exit(1)
}

config({ path: envPath })

const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k]?.trim())
if (missing.length > 0) {
  console.error('[check-quick] .env incompleto. Ausente ou vazio:', missing.join(', '))
  process.exit(1)
}

const raw = readFileSync(envPath, 'utf8')
if (!/^API_PORT=/m.test(raw)) {
  console.error('[check-quick] Defina API_PORT no .env.')
  process.exit(1)
}

const p = Number.parseInt(process.env.API_PORT.trim(), 10)
if (!Number.isFinite(p) || p < 1 || p > 65535) {
  console.error('[check-quick] API_PORT inválida (use 1–65535).')
  process.exit(1)
}

console.log('[check-quick] .env OK (checagem local, sem Prisma).')
