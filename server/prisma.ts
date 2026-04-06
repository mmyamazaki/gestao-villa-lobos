import { PrismaClient } from '@prisma/client'

/**
 * Manter em sincronia com `scripts/lib/normalize-database-url.mjs`.
 *
 * Supabase: pooler na **6543** é modo transação (PgBouncer) — o Query Engine do Prisma costuma
 * entrar em PANIC ("timer has gone away"). O mesmo *hostname* na **5432** é pooler em modo
 * sessão, compatível com Prisma, sem mudar user/password no painel.
 *
 * `db.*.supabase.co` (ligação direta): reforça `sslmode=require` e `connect_timeout` (PaaS / IPv6).
 * Pooler: `host === "pooler.supabase.com"` também é tratado (além de `*.pooler.supabase.com`).
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
  const sessionSwitch = /\.pooler\.supabase\.com/i.test(raw) && /:6543(\/|\?|#|$)/.test(raw)
  console.log(
    sessionSwitch
      ? '[api] DATABASE_URL: Supabase pooler sessão (5432) para Prisma — evita PANIC do modo transação (6543).'
      : '[api] DATABASE_URL ajustada (pgbouncer + connection_limit) para pooler na porta 6543.',
  )
}

export const prisma = new PrismaClient(
  prismaUrl ? { datasources: { db: { url: prismaUrl } } } : undefined,
)
