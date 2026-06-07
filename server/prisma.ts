import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { combineRawDatabaseUrlFromEnv } from './databaseUrlFromEnv.js'
import { sanitizeDatabaseUrlFromPanel } from './sanitizeDatabaseUrl.js'

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

    /** `db.*.supabase.co` é Postgres directo — nunca misturar com `pgbouncer=true` (evita PANIC no Prisma). */
    if (directDb) {
      params.delete('pgbouncer')
    }

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

const rawEnvMain = process.env.DATABASE_URL?.trim() ?? ''
const rawEnvAppend = process.env.DATABASE_URL_APPEND?.trim() ?? ''
const raw = combineRawDatabaseUrlFromEnv()
const prismaUrl = raw ? normalizeDatabaseUrlForPrisma(raw) : undefined

if (rawEnvMain && sanitizeDatabaseUrlFromPanel(rawEnvMain) !== rawEnvMain) {
  console.warn('[api] DATABASE_URL: removido aspas/BOM extra do valor do painel (formato comum no hPanel).')
}
if (rawEnvAppend) {
  console.log('[api] DATABASE_URL montada com DATABASE_URL_APPEND (URL longa / limite do painel).')
}

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

/**
 * Constrói a config do pool `pg` a partir da URL já normalizada.
 *
 * Sem engine Rust (`engineType = "client"`), a ligação é feita pelo driver `pg` (JS puro). Isto
 * elimina o `PANIC: timer has gone away` do engine nativo nos workers do LiteSpeed/LSAPI da Hostinger.
 *
 * `pg` não entende `pgbouncer`/`connection_limit` (parâmetros só do Prisma) → removem-se da URL;
 * o limite de ligações por worker passa a `max` no pool. SSL é tratado por opção explícita
 * (`rejectUnauthorized: false`) para o pooler do Supabase, evitando falhas de certificado.
 */
function buildPgPoolConfig(url: string): {
  connectionString: string
  max: number
  ssl?: { rejectUnauthorized: boolean }
  connectionTimeoutMillis: number
} {
  try {
    const forParse = url.replace(/^postgres(ql)?:/i, 'postgresql:')
    const u = new URL(forParse)
    const host = u.hostname.toLowerCase()
    const needsSsl = isSupabasePoolerHost(host) || isSupabaseDirectDbHost(host)
    const params = new URLSearchParams(u.search.replace(/^\?/, ''))
    const connectionLimit = Number.parseInt(params.get('connection_limit') ?? '', 10)
    params.delete('pgbouncer')
    params.delete('connection_limit')
    params.delete('sslmode')
    u.search = params.toString()
    const connectionString = u.toString().replace(/^postgresql:/i, 'postgres:')
    return {
      connectionString,
      max: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 1,
      connectionTimeoutMillis: 60_000,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    }
  } catch {
    return { connectionString: url, max: 1, connectionTimeoutMillis: 60_000 }
  }
}

function createPrismaClient(): PrismaClient {
  if (!prismaUrl) {
    /** Sem DATABASE_URL: cliente inerte. O gate de `/api` já bloqueia; evita crash no boot. */
    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error('DATABASE_URL ausente: Prisma indisponível.')
      },
    }) as PrismaClient
  }
  const adapter = new PrismaPg(buildPgPoolConfig(prismaUrl))
  return new PrismaClient({ adapter })
}

let prismaInstance = createPrismaClient()

/**
 * Proxy: após PANIC do query engine, `replacePrismaClientAfterEnginePanic()` troca a instância;
 * quem importou `prisma` continua a usar o mesmo objeto exportado.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const v = (prismaInstance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof v === 'function') {
      return (v as (...args: unknown[]) => unknown).bind(prismaInstance)
    }
    return v
  },
}) as PrismaClient

/**
 * Sem engine Rust (driver `pg`), o `PANIC: timer has gone away` deixa de ocorrer. Mantém-se esta
 * rotina para recriar o pool `pg` caso fique num estado mau (recriar o `PrismaClient` recria o pool).
 */
export async function replacePrismaClientAfterEnginePanic(): Promise<void> {
  console.warn('[api] Prisma: a recriar cliente/pool pg.')
  try {
    await prismaInstance.$disconnect()
  } catch {
    /* ignore */
  }
  prismaInstance = createPrismaClient()
}
