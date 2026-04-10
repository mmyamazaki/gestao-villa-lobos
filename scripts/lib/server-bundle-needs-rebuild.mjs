/**
 * true se dist-server/server/index.js não existe ou algum .ts do servidor é mais novo.
 * Evita a Hostinger correr para sempre um bundle antigo quando o build do painel é só `vite build`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function maxMtimeTsRecursive(dir) {
  let max = 0
  function walk(d) {
    if (!existsSync(d)) return
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (ent.name.endsWith('.ts')) {
        try {
          max = Math.max(max, statSync(p).mtimeMs)
        } catch {
          /* ignore */
        }
      }
    }
  }
  walk(dir)
  return max
}

export function serverBundleNeedsRebuild(root = process.cwd()) {
  const target = join(root, 'dist-server', 'server', 'index.js')
  if (!existsSync(target)) return true
  const outM = statSync(target).mtimeMs
  let srcM = maxMtimeTsRecursive(join(root, 'server'))
  const typesTs = join(root, 'src', 'domain', 'types.ts')
  if (existsSync(typesTs)) {
    srcM = Math.max(srcM, statSync(typesTs).mtimeMs)
  }
  return srcM > outM
}
