/**
 * Hostinger / Linux: EACCES no binário nativo do esbuild.
 * 1) chmod nos caminhos usuais
 * 2) npm rebuild esbuild --force (reinstala binário da plataforma)
 * 3) npx esbuild --version (validação)
 * 4) prisma generate
 *
 * Nota: @esbuild/linux-x64 não é dependência direta — vem de vite → esbuild (transitiva).
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const ESBUILD_LINUX_X64 = join(root, 'node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild')
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

const rebuild = spawnSync('npm', ['rebuild', 'esbuild', '--force'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
console.log(
  `[postinstall] npm rebuild esbuild --force → exit ${rebuild.status === null ? 'null' : rebuild.status}`,
)

const ver = spawnSync('npx', ['esbuild', '--version'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
console.log(
  `[postinstall] npx esbuild --version → exit ${ver.status === null ? 'null' : ver.status}`,
)

const r = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true })
process.exit(r.status === null ? 1 : r.status)
