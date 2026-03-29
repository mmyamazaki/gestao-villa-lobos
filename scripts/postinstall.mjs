/**
 * Hostinger / Linux: EACCES ao executar o binário nativo do esbuild.
 * Alvos exatos (Kodee / stack trace):
 *   node_modules/@esbuild/linux-x64/bin/esbuild
 *   node_modules/esbuild/bin/esbuild
 * Depois: prisma generate.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

/** Binário que aparece no erro TransformError / EACCES */
const ESBUILD_LINUX_X64 = join(root, 'node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild')

/** Wrapper do pacote esbuild (se existir) */
const ESBUILD_PACKAGE_BIN = join(root, 'node_modules', 'esbuild', 'bin', 'esbuild')

function chmod755IfExists(label, absolutePath) {
  if (!existsSync(absolutePath)) {
    console.log(`[postinstall] skip (missing): ${label}`)
    return
  }
  try {
    chmodSync(absolutePath, 0o755)
    console.log(`[postinstall] chmod 0o755 ok: ${label}`)
  } catch (e) {
    console.warn(`[postinstall] chmod failed: ${label}`, e instanceof Error ? e.message : e)
  }
}

chmod755IfExists(
  'node_modules/@esbuild/linux-x64/bin/esbuild',
  ESBUILD_LINUX_X64,
)
chmod755IfExists('node_modules/esbuild/bin/esbuild', ESBUILD_PACKAGE_BIN)

const r = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true })
process.exit(r.status === null ? 1 : r.status)
