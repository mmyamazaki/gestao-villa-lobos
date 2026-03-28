/**
 * Espera a API aceitar conexões em 127.0.0.1:API_PORT (lê .env na raiz).
 * Usado pelo npm run dev antes de subir o Vite.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const require = createRequire(import.meta.url)
const waitOn = require('wait-on')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })

function resolvePort() {
  const raw = process.env.API_PORT?.trim()
  if (!raw) return '3333'
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 65535) return '3333'
  return String(n)
}

const port = resolvePort()
const resource = `tcp:127.0.0.1:${port}`

try {
  await waitOn({
    resources: [resource],
    timeout: 120_000,
  })
  console.log(`[wait-api] ${resource} disponível`)
} catch (e) {
  console.error('[wait-api] Timeout ou erro ao esperar a API:', e)
  process.exit(1)
}
