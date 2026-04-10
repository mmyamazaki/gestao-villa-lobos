/**
 * Uma única instância Node a fazer listen (Hostinger dispara vários arranques).
 *
 * Lock em **diretório** (`mkdir`): atómico no POSIX; evita corrida do lock em ficheiro
 * (outro processo via `EEXIST` + ficheiro vazio → dois `LISTENING` → 503).
 *
 * Migração: se existir o lock **legado** (ficheiro com o mesmo nome), respeita-se o PID
 * até o processo morrer; depois o caminho passa a ser pasta.
 */
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const LOCK_BASENAME = 'gestao-villa-lobos.node.lock'
const PID_FILENAME = 'pid'
/** Conteúdo completo: só dígitos + newline */
const LOCK_BODY = /^\d+\n$/

const MAX_ATTEMPTS = 80
const EMPTY_PID_UNLINK_AFTER = 35

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

function readPidFromFile(pidPath) {
  try {
    return readFileSync(pidPath, 'utf8')
  } catch {
    return null
  }
}

export async function acquireSingletonLock() {
  const lockPath = join(process.cwd(), LOCK_BASENAME)
  const pidFile = join(lockPath, PID_FILENAME)
  let emptyPidReads = 0

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let st = null
      try {
        st = statSync(lockPath)
      } catch {
        st = null
      }

      /* --- Lock legado: ficheiro plano (versões antigas) --- */
      if (st?.isFile()) {
        const raw = readFileSync(lockPath, 'utf8')
        if (LOCK_BODY.test(raw)) {
          const pid = parseInt(raw.trim(), 10)
          if (Number.isFinite(pid) && pid > 0 && pidIsLiveNonZombie(pid)) {
            console.log(
              `[boot] instância Node já em execução (pid ${pid}); esta cópia encerra para evitar vários listen e 2× Prisma.`,
            )
            return false
          }
        }
        try {
          unlinkSync(lockPath)
        } catch {
          /* outro processo alterou */
        }
        await sleep(20 + Math.floor(Math.random() * 40))
        continue
      }

      /* --- Lock novo: diretório --- */
      if (st?.isDirectory()) {
        const raw = readPidFromFile(pidFile)
        if (raw === null) {
          emptyPidReads++
          if (emptyPidReads >= EMPTY_PID_UNLINK_AFTER) {
            try {
              rmSync(lockPath, { recursive: true, force: true })
            } catch {
              /* ignore */
            }
            emptyPidReads = 0
          }
          await sleep(25 + Math.floor(Math.random() * 55))
          continue
        }

        if (!LOCK_BODY.test(raw)) {
          emptyPidReads = 0
          await sleep(25 + Math.floor(Math.random() * 55))
          continue
        }

        emptyPidReads = 0
        const pid = parseInt(raw.trim(), 10)
        if (!Number.isFinite(pid) || pid <= 0 || !pidIsLiveNonZombie(pid)) {
          try {
            rmSync(lockPath, { recursive: true, force: true })
          } catch {
            /* ignore */
          }
          continue
        }

        console.log(
          `[boot] instância Node já em execução (pid ${pid}); esta cópia encerra para evitar vários listen e 2× Prisma.`,
        )
        return false
      }

      /* --- Criar diretório de lock (atómico) --- */
      try {
        mkdirSync(lockPath)
      } catch (e) {
        if (e?.code === 'EEXIST') {
          await sleep(25 + Math.floor(Math.random() * 55))
          continue
        }
        console.error('[boot] aviso: lock mkdir:', e)
        return true
      }

      try {
        writeFileSync(pidFile, `${process.pid}\n`, { encoding: 'utf8', flag: 'wx' })
        /**
         * Não libertar lock em SIGTERM: redeploy com processo antigo a escutar + novo com lock
         * causava dois LISTENING. O lock só deixa de valer quando o PID morre.
         */
        return true
      } catch (e) {
        try {
          rmSync(lockPath, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
        if (e?.code === 'EEXIST') {
          await sleep(25 + Math.floor(Math.random() * 55))
          continue
        }
        console.error('[boot] aviso: lock pid file:', e)
        return true
      }
    }

    console.error('[boot] aviso: não foi possível obter lock; a continuar sem lock.')
    return true
  } catch (e) {
    console.error('[boot] aviso: lock de instância única indisponível:', e)
    return true
  }
}
