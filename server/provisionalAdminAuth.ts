import { timingSafeEqual } from 'node:crypto'

/** Alinhar com regra mínima de senha admin no projeto. */
const MIN_LEN = 8

/**
 * Senha de emergência só no servidor (nunca VITE_*). Se definida:
 * - permite login como alternativa ao hash em `admins`;
 * - se não existir linha em `admins` e o e-mail for o de bootstrap, cria o primeiro admin.
 * Remover a variável no painel após definir senha definitiva em Configurações.
 */
export function readProvisionalPasswordEnv(): string | undefined {
  const s = process.env.ADMIN_PROVISIONAL_PASSWORD?.trim()
  if (!s || s.length < MIN_LEN) return undefined
  return s
}

export function provisionalPasswordMatches(supplied: string, expected: string | undefined): boolean {
  if (!expected) return false
  if (supplied.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(supplied, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

/** E-mail permitido para criar o primeiro admin (igual ao do painel / seed). */
export function bootstrapAdminEmailLower(): string | null {
  const raw =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
    process.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()
  return raw || null
}
