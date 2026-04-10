/**
 * Evita vários processos Node a fazer listen na mesma porta (ex.: Hostinger a arrancar
 * o mesmo start várias vezes). Só o primeiro mantém-se; os outros saem com código 0.
 *
 * Em Linux, ignora zombies (/proc). **Não** usamos TCP em 127.0.0.1 para “confirmar” o
 * outro processo: em muitos painéis essa ligação falha mesmo com o servidor ativo, o que
 * fazia apagar o lock e arrancar **outra** instância → duas engines Prisma → PANIC
 * `timer has gone away`.
 */
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const LOCK_BASENAME = 'gestao-villa-lobos.node.lock'
/** Conteúdo completo do lock: só dígitos + newline (evita ler PID a meio do write). */
const LOCK_BODY = /^\d+\n$/

const MAX_ACQUIRE_ATTEMPTS = 48
/** Leituras seguidas com ficheiro vazio → provável lock abandonado, remover. */
const EMPTY_UNLINK_AFTER = 20

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
  let emptyReads = 0

  try {
    for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt++) {
      try {
        /**
         * Um único `writeFileSync` com `wx` reduz a janela face a open+write separados.
         * Com `openSync`+`writeSync`, outro processo podia ver `EEXIST`, ler ficheiro **vazio**
         * e fazer `unlink` antes do PID ser escrito → **duas** instâncias com `LISTENING`.
         */
        writeFileSync(lockPath, `${process.pid}\n`, { encoding: 'utf8', flag: 'wx' })
        /**
         * Não libertar o lock em SIGTERM/SIGINT: no redeploy o painel manda SIGTERM ao processo
         * antigo e arranca outro logo a seguir. Se apagarmos o lock aqui, o novo processo
         * obtém lock enquanto o antigo **ainda escuta** na porta → dois LISTENING → 503 no proxy.
         * O ficheiro fica com o PID até o processo morrer; o próximo arranque remove lock obsoleto.
         */
        return true
      } catch (e) {
        if (e?.code !== 'EEXIST') {
          console.error('[boot] aviso: lock de instância única:', e)
          return true
        }

        let raw = ''
        try {
          raw = readFileSync(lockPath, 'utf8')
        } catch {
          await sleep(25 + Math.floor(Math.random() * 55))
          continue
        }

        if (!LOCK_BODY.test(raw)) {
          if (raw.trim() === '') {
            emptyReads++
            if (emptyReads >= EMPTY_UNLINK_AFTER) {
              try {
                unlinkSync(lockPath)
              } catch {
                /* outro processo removeu */
              }
              emptyReads = 0
            }
          } else {
            emptyReads = 0
          }
          await sleep(25 + Math.floor(Math.random() * 55))
          continue
        }

        emptyReads = 0
        const pid = parseInt(raw.trim(), 10)
        if (!Number.isFinite(pid) || pid <= 0 || !pidIsLiveNonZombie(pid)) {
          try {
            unlinkSync(lockPath)
          } catch {
            /* outro processo removeu */
          }
          continue
        }

        console.log(
          `[boot] instância Node já em execução (pid ${pid}); esta cópia encerra para evitar vários listen e 2× Prisma.`,
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
