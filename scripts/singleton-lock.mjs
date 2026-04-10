/**
 * Evita vários processos Node a fazer listen na mesma porta (ex.: Hostinger a arrancar
 * o mesmo start várias vezes). Só o primeiro mantém-se; os outros saem com código 0.
 *
 * - Ignora zombies (Linux /proc).
 * - Se o PID do lock está “vivo” mas **nada aceita TCP em 127.0.0.1:PORT**, o lock é
 *   obsoleto (processo errado, rede, ou servidor antigo já morreu) — remove-se e continua.
 */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import net from 'node:net'
import { join } from 'node:path'

const LOCK_BASENAME = 'gestao-villa-lobos.node.lock'

function resolveBootPort() {
  const raw = process.env.PORT?.trim() || process.env.API_PORT?.trim() || '3000'
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : 3000
}

/** true = algo aceita ligação TCP em 127.0.0.1 (ex.: o nosso Express já em execução) */
function tcpAcceptsLocal(port) {
  return new Promise((resolve) => {
    const c = net.createConnection({ port, host: '127.0.0.1' })
    const done = (v) => {
      try {
        c.destroy()
      } catch {
        /* ignore */
      }
      resolve(v)
    }
    c.setTimeout(600, () => done(false))
    c.on('connect', () => done(true))
    c.on('error', () => done(false))
  })
}

/** Dá tempo ao outro processo chegar ao `listen` antes de tratar a porta como livre. */
async function tcpAcceptsLocalWithGrace(port) {
  const tries = 14
  const gapMs = 280
  for (let i = 0; i < tries; i++) {
    if (await tcpAcceptsLocal(port)) return true
    if (i < tries - 1) await new Promise((r) => setTimeout(r, gapMs))
  }
  return false
}

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

export async function acquireSingletonLock() {
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
            /* outro processo removeu */
          }
          continue
        }

        const port = resolveBootPort()
        const serving = await tcpAcceptsLocalWithGrace(port)
        if (!serving) {
          console.log(
            `[boot] lock indica pid ${pid} ativo mas 127.0.0.1:${port} não responde após espera — lock obsoleto, a retomar.`,
          )
          try {
            unlinkSync(lockPath)
          } catch {
            /* ignore */
          }
          continue
        }

        console.log(
          `[boot] instância já a servir em 127.0.0.1:${port} (pid ${pid}); esta cópia encerra.`,
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
