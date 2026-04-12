/**
 * Uma única instância Node a fazer `listen` (Hostinger dispara vários arranques em paralelo).
 *
 * Lock **atómico**: `openSync(caminho, 'wx')` — no POSIX só um processo cria o ficheiro.
 * O lock antigo (pasta + `pid`) deixava janelas em que vários processos chegavam a `LISTENING`
 * → LiteSpeed aproximava-se do socket errado → **503**.
 */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

/** Nome do ficheiro de lock (sincronizar com `server/index.ts` → BOOT_LOCK_FILENAME). */
const LOCK_FILENAME = '.gestao-villa-lobos.run.lock'

/** Pasta legada (mkdir + pid); removida se o PID já não existir. */
const LEGACY_LOCK_DIR = 'gestao-villa-lobos.node.lock'

const STRICT_LOCK = process.env.NODE_ENV === 'production'
const MAX_ATTEMPTS = 100

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

function resolveLockBaseDir() {
  try {
    return realpathSync(process.cwd())
  } catch {
    return process.cwd()
  }
}

/** Liberta lock em diretório antigo para não competir com o ficheiro novo. */
function cleanupLegacyDirLock(baseDir) {
  const p = join(baseDir, LEGACY_LOCK_DIR)
  try {
    if (!existsSync(p)) return
    const st = statSync(p)
    if (!st.isDirectory()) return
    const pidPath = join(p, 'pid')
    const raw = existsSync(pidPath) ? readFileSync(pidPath, 'utf8') : ''
    const pid = parseInt(raw.trim(), 10)
    if (Number.isFinite(pid) && pid > 0 && pidIsLiveNonZombie(pid)) return
    rmSync(p, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

export async function acquireSingletonLock() {
  const base = resolveLockBaseDir()
  cleanupLegacyDirLock(base)

  const lockFile = join(base, LOCK_FILENAME)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const fd = openSync(lockFile, 'wx', 0o644)
      try {
        writeSync(fd, Buffer.from(`${process.pid}\n`, 'utf8'))
      } finally {
        closeSync(fd)
      }
      return true
    } catch (e) {
      if (e?.code !== 'EEXIST') {
        console.error('[boot] lock open (wx):', e)
        return STRICT_LOCK ? false : true
      }

      let ownerPid = null
      let canRead = false
      try {
        const raw = readFileSync(lockFile, 'utf8').trim()
        const pid = parseInt(raw, 10)
        if (Number.isFinite(pid) && pid > 0) {
          ownerPid = pid
          canRead = true
        }
      } catch {
        canRead = false
      }

      if (canRead && ownerPid != null && pidIsLiveNonZombie(ownerPid)) {
        console.log(
          `[boot] instância Node já em execução (pid ${ownerPid}); esta cópia encerra para evitar vários listen e 2× Prisma.`,
        )
        return false
      }

      try {
        unlinkSync(lockFile)
      } catch {
        /* outro processo alterou */
      }
      await sleep(12 + Math.floor(Math.random() * 40))
    }
  }

  console.error(
    `[boot] não foi possível obter lock após ${MAX_ATTEMPTS} tentativas.` +
      (STRICT_LOCK ? ' Produção: a encerrar (evita dois LISTENING → 503).' : ' Dev: a continuar sem lock.'),
  )
  return STRICT_LOCK ? false : true
}
