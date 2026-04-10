import { PrismaClient } from '@prisma/client'

/**
 * Manter em sincronia com `scripts/lib/normalize-database-url.mjs`.
 *
 * Supabase: pooler na **6543** é modo transação (PgBouncer) — o Query Engine do Prisma costuma
 * entrar em PANIC ("timer has gone away"). O mesmo *hostname* na **5432** é pooler em modo
 * sessão, compatível com Prisma, sem mudar user/password no painel.
 *
 * `db.*.supabase.co`:
 * - porta **5432**: ligação direta / modo sessão — reforça `sslmode=require` e `connect_timeout`;
 * - porta **6543**: mesmo host, pooler **modo transação** — Prisma entra em PANIC; trocar para **5432**
 *   e remover `pgbouncer=true` (equivale ao modo sessão no Supabase).
 * Pooler dedicado: `*.pooler.supabase.com` (e `pooler.supabase.com`).
 *
 * Outros provedores na 6543: acrescenta `pgbouncer=true` e `connection_limit=1`.
 */
function isSupabasePoolerHost(host: string): boolean {
  const h = host.toLowerCase()
  return h === 'pooler.supabase.com' || h.endsWith('.pooler.supabase.com')
}

function isSupabaseDirectDbHost(host: string): boolean {
  return /^db\.[^.]+\.supabase\.co$/i.test(host)
}

function normalizeDatabaseUrlForPrisma(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const postgresProto = /^postgres:\/\//i.test(trimmed)
  try {
    const forParse = postgresProto ? trimmed.replace(/^postgres:\/\//i, 'postgresql://') : trimmed
    const u = new URL(forParse)
    const host = u.hostname.toLowerCase()
    let port = u.port || '5432'
    const pooler = isSupabasePoolerHost(host)
    const directDb = isSupabaseDirectDbHost(host)

    const params = new URLSearchParams(u.search.replace(/^\?/, ''))

    if (pooler && port === '6543') {
      u.port = '5432'
      port = '5432'
      params.delete('pgbouncer')
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
    } else if (directDb && port === '6543') {
      // Painel Supabase: "Pooler settings" em host db.* com :6543 + ?pgbouncer=true — incompatível com Prisma.
      u.port = '5432'
      port = '5432'
      params.delete('pgbouncer')
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
    } else if (port === '6543') {
      if (!params.has('pgbouncer')) params.set('pgbouncer', 'true')
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
    }

    if (pooler || directDb) {
      if (!params.has('sslmode')) params.set('sslmode', 'require')
      if (!params.has('connect_timeout')) params.set('connect_timeout', '60')
    }

    if (pooler) {
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
    } else if (port === '6543' && !params.has('connection_limit')) {
      params.set('connection_limit', '1')
    }

    u.search = params.toString()
    let out = u.toString()
    if (postgresProto) out = out.replace(/^postgresql:\/\//i, 'postgres://')
    return out
  } catch {
    return trimmed
  }
}

const raw = process.env.DATABASE_URL?.trim()
const prismaUrl = raw ? normalizeDatabaseUrlForPrisma(raw) : undefined

if (prismaUrl && raw && prismaUrl !== raw) {
  const port6543 = /:6543(\/|\?|#|$)/.test(raw)
  const supabaseSessionSwitch =
    port6543 &&
    (/db\.[^.]+\.supabase\.co:6543/i.test(raw) || /\.pooler\.supabase\.com:6543/i.test(raw))
  console.log(
    supabaseSessionSwitch
      ? '[api] DATABASE_URL: Supabase 6543→5432 (modo sessão) para Prisma — evita PANIC no pooler transação.'
      : port6543
        ? '[api] DATABASE_URL: ajustada (pooler 6543 / parâmetros).'
        : '[api] DATABASE_URL: ajustada (ssl, timeout ou connection_limit).',
  )
}

const prismaOptions = prismaUrl ? { datasources: { db: { url: prismaUrl } } } : undefined

function isPrismaTransientOrPanicError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const low = msg.toLowerCase()
  return (
    low.includes('panic') ||
    low.includes('timer has gone away') ||
    low.includes('connection closed') ||
    low.includes('server has closed the connection') ||
    low.includes("can't reach database server") ||
    low.includes('too many connections') ||
    low.includes('query engine exited')
  )
}

let currentClient = new PrismaClient(prismaOptions)
let resetInFlight: Promise<void> | null = null

async function resetClient(reason: string) {
  if (resetInFlight) {
    await resetInFlight
    return
  }
  resetInFlight = (async () => {
    const old = currentClient
    try {
      await old.$disconnect()
    } catch {
      /* noop */
    }
    currentClient = new PrismaClient(prismaOptions)
    console.warn(`[api][prisma] cliente reiniciado após erro transitório: ${reason}`)
  })()
  try {
    await resetInFlight
  } finally {
    resetInFlight = null
  }
}

async function runWithRetry<T>(opName: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  try {
    return await fn(currentClient)
  } catch (e) {
    if (!isPrismaTransientOrPanicError(e)) throw e
    await resetClient(opName)
    return fn(currentClient)
  }
}

function wrapDelegate(delegateName: string) {
  return new Proxy(
    {},
    {
      get(_target, operation) {
        const op = String(operation)
        return (...args: unknown[]) =>
          runWithRetry(`${delegateName}.${op}`, async (client) => {
            const delegate = Reflect.get(client as object, delegateName) as Record<string, unknown>
            const method = Reflect.get(delegate, op)
            if (typeof method !== 'function') return method
            return Reflect.apply(method, delegate, args) as Promise<unknown>
          })
      },
    },
  )
}

/**
 * Proxy resiliente: em PANIC/transiente, reinicia PrismaClient e tenta 1x novamente.
 * Evita indisponibilidade prolongada em produção por quedas momentâneas de conexão/engine.
 */
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const name = String(prop)
      // Delegates de modelos (course, teacher, student, etc.)
      const delegate = Reflect.get(currentClient as object, prop)
      if (delegate && typeof delegate === 'object') {
        return wrapDelegate(name)
      }
      return (...args: unknown[]) =>
        runWithRetry(name, async (client) => {
          const method = Reflect.get(client as object, prop)
          if (typeof method !== 'function') return method
          return Reflect.apply(method, client, args) as Promise<unknown>
        })
    },
  },
) as unknown as PrismaClient
