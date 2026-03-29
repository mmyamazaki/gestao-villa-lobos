/**
 * Hostinger / Linux partilhado: binário do esbuild pode vir sem bit de execução (EACCES).
 * Sugestão suporte — equivalente a: chmod +x node_modules/@esbuild/linux-x64/bin/esbuild || true
 */
import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const p = join('node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild')
if (existsSync(p)) {
  try {
    chmodSync(p, 0o755)
  } catch {
    /* ignorar */
  }
}
