/**
 * Manter em sincronia com `server/prisma.ts`.
 *
 * @param {string} raw
 * @returns {string}
 */
function isSupabasePoolerHost(host) {
  const h = host.toLowerCase()
  return h === 'pooler.supabase.com' || h.endsWith('.pooler.supabase.com')
}

function isSupabaseDirectDbHost(host) {
  return /^db\.[^.]+\.supabase\.co$/i.test(host)
}

export function normalizeDatabaseUrlForPrisma(raw) {
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
