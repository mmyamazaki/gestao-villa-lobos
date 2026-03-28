/**
 * Verifica presença das variáveis esperadas no .env (não imprime valores).
 */
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_ENV_KEYS } from './lib/required-env.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k]?.trim())
if (missing.length > 0) {
  console.error('[verify-env] Ausente ou vazio no .env:', missing.join(', '))
  process.exit(1)
}

console.log('[verify-env] Variáveis obrigatórias presentes (valores não exibidos).')
