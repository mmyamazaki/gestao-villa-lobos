/**
 * Cria um PrismaClient sem engine Rust (`engineType = "client"`), ligando via driver `pg` (JS puro).
 *
 * Mantém em sincronia com `server/prisma.ts#buildPgPoolConfig`. Usado pelos scripts de dev/CI
 * (seed, auditoria, validação, predev) — em produção o servidor usa `server/prisma.ts`.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { normalizeDatabaseUrlForPrisma } from './normalize-database-url.mjs'

function isSupabaseHost(host) {
  const h = host.toLowerCase()
  return (
    h === 'pooler.supabase.com' ||
    h.endsWith('.pooler.supabase.com') ||
    /^db\.[^.]+\.supabase\.co$/i.test(h)
  )
}

function buildPgPoolConfig(url) {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/i, 'postgresql:'))
    const needsSsl = isSupabaseHost(u.hostname)
    const params = new URLSearchParams(u.search.replace(/^\?/, ''))
    const connectionLimit = Number.parseInt(params.get('connection_limit') ?? '', 10)
    // `pg` não entende estes parâmetros (são só do Prisma) — removem-se da URL.
    params.delete('pgbouncer')
    params.delete('connection_limit')
    params.delete('sslmode')
    u.search = params.toString()
    return {
      connectionString: u.toString().replace(/^postgresql:/i, 'postgres:'),
      max: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 1,
      connectionTimeoutMillis: 60_000,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    }
  } catch {
    return { connectionString: url, max: 1, connectionTimeoutMillis: 60_000 }
  }
}

/** Lança erro claro se faltar DATABASE_URL (scripts precisam de ligação real ao Postgres). */
export function makePrismaClient() {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    throw new Error('DATABASE_URL ausente: defina no .env para usar este script.')
  }
  const adapter = new PrismaPg(buildPgPoolConfig(normalizeDatabaseUrlForPrisma(raw)))
  return new PrismaClient({ adapter })
}
