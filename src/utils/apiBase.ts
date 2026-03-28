/**
 * URL absoluta da API. Em dev, caminhos relativos (`/api/...`) usam o proxy do Vite.
 * Em produção: `VITE_API_BASE_URL` se definido; senão `window.location.origin` (mesmo host que o SPA).
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  const base = typeof fromEnv === 'string' ? fromEnv.trim().replace(/\/$/, '') : ''
  if (base) return `${base}${normalized}`
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return `${window.location.origin}${normalized}`
  }
  return normalized
}
