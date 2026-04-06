import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'emvl_admin_session'

const PAYLOAD_VERSION = 1
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Comprimento mínimo de ADMIN_SESSION_SECRET (variável de ambiente do servidor). */
export const ADMIN_SESSION_SECRET_MIN_LEN = 8

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET?.trim()
  if (s && s.length >= ADMIN_SESSION_SECRET_MIN_LEN) return s
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[adminSession] ADMIN_SESSION_SECRET ausente ou curto; usando segredo só para desenvolvimento.',
    )
    return 'dev-admin-session-secret-min-8-chars!!'
  }
  throw new Error(
    `ADMIN_SESSION_SECRET deve estar definido (mín. ${ADMIN_SESSION_SECRET_MIN_LEN} caracteres) em produção.`,
  )
}

export function signAdminSessionToken(email: string, maxAgeMs = ADMIN_SESSION_MAX_AGE_MS): string {
  const exp = Date.now() + maxAgeMs
  const body = JSON.stringify({ v: PAYLOAD_VERSION, email, exp })
  const bodyB64 = Buffer.from(body, 'utf8').toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(bodyB64).digest('base64url')
  return `${bodyB64}.${sig}`
}

export function verifyAdminSessionToken(token: string): { email: string } | null {
  let secret: string
  try {
    secret = getSecret()
  } catch {
    return null
  }
  try {
    const dot = token.indexOf('.')
    if (dot < 1) return null
    const bodyB64 = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = createHmac('sha256', secret).update(bodyB64).digest('base64url')
    const a = Buffer.from(sig, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const body = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as {
      v?: number
      email?: string
      exp?: number
    }
    if (body.v !== PAYLOAD_VERSION || typeof body.email !== 'string' || typeof body.exp !== 'number')
      return null
    if (Date.now() > body.exp) return null
    return { email: body.email }
  } catch {
    return null
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k === name) {
      try {
        return decodeURIComponent(v)
      } catch {
        return v
      }
    }
  }
  return undefined
}
