/**
 * Checagem rápida sem rede: chaves obrigatórias em process.env.
 * Se não houver `.env` na raiz, apenas avisa — o build segue e valida o ambiente (ex.: Hostinger).
 * Se o arquivo existir, carrega com dotenv para desenvolvimento local (sem ler arquivo inexistente).
 * Usada em `prebuild` / `prelint` (não mata processos nem testa Prisma).
 */
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_ENV_KEYS } from './lib/required-env.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')

if (existsSync(envPath)) {
  config({ path: envPath })
} else {
  console.warn(
    '[check-quick] Arquivo .env não encontrado na raiz; validando apenas process.env (variáveis do painel / CI).',
  )
}

const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k]?.trim())
if (missing.length > 0) {
  console.error(
    '[check-quick] Variáveis de ambiente ausentes ou vazias:',
    missing.join(', '),
  )
  console.error(
    '[check-quick] Defina-as no painel do host ou crie um arquivo .env na raiz para desenvolvimento local.',
  )
  process.exit(1)
}

const p = Number.parseInt(process.env.API_PORT.trim(), 10)
if (!Number.isFinite(p) || p < 1 || p > 65535) {
  console.error('[check-quick] API_PORT inválida (use 1–65535).')
  process.exit(1)
}

console.log('[check-quick] Variáveis de ambiente OK (checagem local, sem Prisma).')
