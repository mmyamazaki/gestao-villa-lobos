/**
 * URL para chamadas à API.
 * - Com `VITE_API_BASE_URL`: usa essa base (API noutro host).
 * - Sem isso: caminho relativo `/api/...` (mesmo domínio que o site — correto para Express + SPA no mesmo processo).
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  const base = typeof fromEnv === 'string' ? fromEnv.trim().replace(/\/$/, '') : ''
  if (base) return `${base}${normalized}`
  return normalized
}
