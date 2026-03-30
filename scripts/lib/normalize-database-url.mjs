/**
 * Manter em sincronia com `server/prisma.ts`.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeDatabaseUrlForPrisma(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const postgresProto = /^postgres:\/\//i.test(trimmed)
  try {
    const forParse = postgresProto ? trimmed.replace(/^postgres:\/\//i, 'postgresql://') : trimmed
    const u = new URL(forParse)
    const port = u.port || '5432'
    const host = u.hostname.toLowerCase()
    const isSupabasePooler = host.endsWith('.pooler.supabase.com')

    if (isSupabasePooler && port === '6543') {
      u.port = '5432'
      const params = new URLSearchParams(u.search.replace(/^\?/, ''))
      params.delete('pgbouncer')
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
      u.search = params.toString()
      let out = u.toString()
      if (postgresProto) out = out.replace(/^postgresql:\/\//i, 'postgres://')
      return out
    }

    if (port === '6543') {
      const params = new URLSearchParams(u.search.replace(/^\?/, ''))
      if (!params.has('pgbouncer')) params.set('pgbouncer', 'true')
      if (!params.has('connection_limit')) params.set('connection_limit', '1')
      u.search = params.toString()
      let out = u.toString()
      if (postgresProto) out = out.replace(/^postgresql:\/\//i, 'postgres://')
      return out
    }

    return trimmed
  } catch {
    return trimmed
  }
}
