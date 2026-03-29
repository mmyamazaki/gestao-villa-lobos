/**
 * Hostinger / Linux: binários esbuild podem vir sem execução (EACCES).
 * Depois: prisma generate (obrigatório no projeto).
 */
import { spawnSync } from 'node:child_process'
import { chmodSync } from 'node:fs'

const candidates = [
  'node_modules/@esbuild/linux-x64/bin/esbuild',
  'node_modules/esbuild/bin/esbuild',
]

for (const p of candidates) {
  try {
    chmodSync(p, 0o755)
  } catch {
    /* path pode não existir (outro OS) */
  }
}

const r = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true })
process.exit(r.status === null ? 1 : r.status)
