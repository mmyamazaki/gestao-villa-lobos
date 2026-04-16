import { fetchWithTimeout } from './fetchWithTimeout'

/**
 * Enquanto o Prisma faz `$connect()` no arranque, o Express devolve 503 nestes corpos
 * (ver `prismaReadyGate` em `server/index.ts`). O browser não deve tratar como “API caída”.
 */
export function isPrismaBoot503(status: number, bodyText: string): boolean {
  if (status !== 503) return false
  return (
    bodyText.includes('Base de dados a iniciar') ||
    bodyText.includes('Servidor a iniciar')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type Init = RequestInit & { timeoutMs?: number; maxPrismaBootWaitMs?: number }

/** Prazo global (por pedido) para esperar o Prisma sair do 503 de arranque — rede lenta / cold start. */
const DEFAULT_MAX_PRISMA_BOOT_WAIT_MS = 180_000

/**
 * `fetchWithTimeout` com repetição enquanto a API responder 503 de arranque do Prisma.
 * Útil logo após deploy ou cold start na Hostinger.
 */
export async function fetchWithTimeoutPrismaBootRetry(
  input: RequestInfo | URL,
  init: Init = {},
): Promise<Response> {
  const { maxPrismaBootWaitMs = DEFAULT_MAX_PRISMA_BOOT_WAIT_MS, ...rest } = init
  const started = Date.now()
  let attempt = 0
  for (;;) {
    const r = await fetchWithTimeout(input, rest)
    const text = await r.text()
    if (!isPrismaBoot503(r.status, text)) {
      return new Response(text, { status: r.status, statusText: r.statusText, headers: r.headers })
    }
    const elapsed = Date.now() - started
    if (elapsed >= maxPrismaBootWaitMs) {
      return new Response(text, { status: r.status, statusText: r.statusText, headers: r.headers })
    }
    if (attempt === 0) {
      console.info(
        '[fetch] 503: servidor a ligar ao Postgres (Prisma); a aguardar e repetir o pedido…',
      )
    }
    attempt += 1
    const delay = Math.min(4_000, 400 + attempt * 280)
    await sleep(Math.min(delay, Math.max(0, maxPrismaBootWaitMs - elapsed)))
  }
}
