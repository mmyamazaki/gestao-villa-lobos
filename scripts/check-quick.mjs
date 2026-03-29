/**
 * Checagem rápida sem rede: chaves obrigatórias em process.env.
 * Exige apenas DATABASE_URL e API_PORT (servidor/Prisma). Variáveis VITE_* ausentes só geram
 * console.warn — o build segue e o Vite trata erros no `vite build`.
 * Se não houver `.env` na raiz, apenas avisa — o build segue.
 * Usada em `prebuild` / `prelint` (não mata processos nem testa Prisma).
 */
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHECK_QUICK_REQUIRED_KEYS, VITE_ENV_KEYS } from './lib/required-env.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')

if (existsSync(envPath)) {
  config({ path: envPath })
} else {
  console.warn(
    '[check-quick] Arquivo .env não encontrado na raiz; validando apenas process.env (variáveis do painel / CI).',
  )
}

console.log('[DEBUG] Chaves presentes no process.env:', Object.keys(process.env))

console.log('[check-quick] Validando variáveis obrigatórias (servidor):')
for (const k of CHECK_QUICK_REQUIRED_KEYS) {
  const ok = Boolean(process.env[k]?.trim())
  console.log(`[check-quick]   → ${k} ${ok ? '(definida)' : '(ausente ou vazia)'}`)
}

const missing = CHECK_QUICK_REQUIRED_KEYS.filter((k) => !process.env[k]?.trim())
if (missing.length > 0) {
  console.error(
    '[check-quick] Variáveis obrigatórias ausentes ou vazias:',
    missing.join(', '),
  )
  console.error(
    '[check-quick] Defina-as no painel do host ou crie um arquivo .env na raiz para desenvolvimento local.',
  )
  process.exit(1)
}

const apiPortRaw = process.env.API_PORT?.trim()
const p = apiPortRaw ? Number.parseInt(apiPortRaw, 10) : NaN
if (!Number.isFinite(p) || p < 1 || p > 65535) {
  console.error('[check-quick] API_PORT ausente ou inválida (use 1–65535).')
  process.exit(1)
}

const missingVite = VITE_ENV_KEYS.filter((k) => !process.env[k]?.trim())
if (missingVite.length > 0) {
  console.warn(
    '[check-quick] Variáveis Vite ausentes ou vazias (build continua; o Vite pode falhar em seguida):',
    missingVite.join(', '),
  )
} else {
  console.log('[check-quick] Variáveis Vite presentes:', VITE_ENV_KEYS.join(', '))
}

console.log('[check-quick] Variáveis de ambiente OK para este passo (servidor; sem Prisma).')
