/**
 * Evita vários processos Node a fazer listen na mesma porta (ex.: Hostinger a arrancar
 * o mesmo start várias vezes). Só o primeiro mantém-se; os outros saem com código 0.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCK_BASENAME = 'gestao-villa-lobos.node.lock'

export function acquireSingletonLock() {
  const lockPath = join(process.cwd(), LOCK_BASENAME)
  try {
    if (existsSync(lockPath)) {
      const raw = readFileSync(lockPath, 'utf8').trim()
      const pid = parseInt(raw, 10)
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, 0)
          console.log(
            `[boot] instância Node já em execução (pid ${pid}); esta cópia encerra para evitar vários listen na mesma porta.`,
          )
          return false
        } catch {
          /* lock obsoleto */
        }
      }
      unlinkSync(lockPath)
    }
    writeFileSync(lockPath, `${process.pid}\n`, 'utf8')
    const release = () => {
      try {
        if (!existsSync(lockPath)) return
        const cur = readFileSync(lockPath, 'utf8').trim()
        if (cur === String(process.pid)) unlinkSync(lockPath)
      } catch {
        /* ignore */
      }
    }
    process.once('SIGTERM', release)
    process.once('SIGINT', release)
    return true
  } catch (e) {
    console.error('[boot] aviso: lock de instância única indisponível:', e)
    return true
  }
}
