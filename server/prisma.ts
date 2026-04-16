import { PrismaClient } from '@prisma/client'

/**
 * Manter em sincronia com `scripts/lib/normalize-database-url.mjs`.
 *
 * Supabase: no host `db.<ref>.supabase.co`, a porta **5432** é a opção estável para Prisma.
 * No host `*.pooler.supabase.com`, manter **6543** e acrescentar parâmetros de PgBouncer.
 *
 * `db.*.supabase.co`:
 * - porta **5432**: ligação estável para Prisma (recomendado);
 * - porta **6543**: converter para **5432**.
 * `*.pooler.supabase.com`:
 * - manter porta de entrada (normalmente 6543) + `pgbouncer=true` + `connection_limit=1`.
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
      if (!params.has('pgbouncer')) params.set('pgbouncer', 'true')
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
    } else if (directDb && port === '6543') {
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
      if (!params.has('connect_timeout')) params.set('connect_timeout', '10')
      if (!params.has('pool_timeout')) params.set('pool_timeout', '10')
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
  const supabaseSessionSwitch = port6543 && /db\.[^.]+\.supabase\.co:6543/i.test(raw)
  const supabasePoolerNormalized = port6543 && /\.pooler\.supabase\.com:6543/i.test(raw)
  console.log(
    supabaseSessionSwitch
      ? '[api] DATABASE_URL: Supabase db.* 6543→5432 para Prisma.'
      : supabasePoolerNormalized
        ? '[api] DATABASE_URL: Supabase pooler 6543 com parâmetros PgBouncer para Prisma.'
        : port6543
          ? '[api] DATABASE_URL: ajustada (pooler 6543 / parâmetros).'
          : '[api] DATABASE_URL: ajustada (ssl, timeout ou connection_limit).',
  )
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient(
    prismaUrl ? { datasources: { db: { url: prismaUrl } } } : undefined,
  )
}

let prismaInstance = createPrismaClient()

/**
 * Proxy: após PANIC do query engine, `replacePrismaClientAfterEnginePanic()` troca a instância;
 * quem importou `prisma` continua a usar o mesmo objeto exportado.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const v = (prismaInstance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof v === 'function') {
      return (v as (...args: unknown[]) => unknown).bind(prismaInstance)
    }
    return v
  },
}) as PrismaClient

/**
 * Após `PANIC: timer has gone away`, o mesmo cliente fica corrompido — retentativas de `$connect`
 * no mesmo objeto não recuperam. Recria o engine com novo `PrismaClient`.
 */
export async function replacePrismaClientAfterEnginePanic(): Promise<void> {
  console.warn('[api] Prisma: PANIC no engine — a recriar cliente.')
  try {
    await prismaInstance.$disconnect()
  } catch {
    /* ignore */
  }
  prismaInstance = createPrismaClient()
}
