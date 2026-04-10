/**
 * Evita vários processos Node a fazer listen na mesma porta (ex.: Hostinger a arrancar
 * o mesmo start várias vezes). Só o primeiro mantém-se; os outros saem com código 0.
 *
 * Em Linux, `kill(pid, 0)` ainda “vê” zombies — tratamos estado Z em /proc como lock obsoleto,
 * senão todas as novas instâncias saem e o proxy fica sem backend (503).
 */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'

const LOCK_BASENAME = 'gestao-villa-lobos.node.lock'

/** true = há processo real (não zombie) com este pid */
function pidIsLiveNonZombie(pid) {
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const rparen = stat.indexOf(')')
      if (rparen < 0) return false
      const state = stat[rparen + 2]
      if (state === 'Z') return false
    } catch {
      return false
    }
  }
  return true
}

export function acquireSingletonLock() {
  const lockPath = join(process.cwd(), LOCK_BASENAME)
  const release = () => {
    try {
      if (!existsSync(lockPath)) return
      const cur = readFileSync(lockPath, 'utf8').trim()
      if (cur === String(process.pid)) unlinkSync(lockPath)
    } catch {
      /* ignore */
    }
  }

  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const fd = openSync(lockPath, 'wx')
        writeSync(fd, `${process.pid}\n`, 'utf8')
        closeSync(fd)
        process.once('SIGTERM', release)
        process.once('SIGINT', release)
        return true
      } catch (e) {
        if (e?.code !== 'EEXIST') {
          console.error('[boot] aviso: lock de instância única:', e)
          return true
        }
        const raw = readFileSync(lockPath, 'utf8').trim()
        const pid = parseInt(raw, 10)
        if (!Number.isFinite(pid) || pid <= 0 || !pidIsLiveNonZombie(pid)) {
          try {
            unlinkSync(lockPath)
          } catch {
            /* outro processo removeu — voltar a tentar */
          }
          continue
        }
        console.log(
          `[boot] instância Node já em execução (pid ${pid}); esta cópia encerra para evitar vários listen na mesma porta.`,
        )
        return false
      }
    }
    console.error('[boot] aviso: não foi possível obter lock após várias tentativas; a continuar sem lock.')
    return true
  } catch (e) {
    console.error('[boot] aviso: lock de instância única indisponível:', e)
    return true
  }
}
