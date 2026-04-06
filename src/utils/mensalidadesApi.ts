import type { MensalidadeRegistrada } from '../domain/types'
import { apiUrl } from './apiBase'
import { fetchWithTimeout } from './fetchWithTimeout'

/** Lista remota de parcelas; falha silenciosa → [] (evita ruído quando a API ignora sincronismo). */
export async function fetchMensalidadesFromApiBestEffort(): Promise<MensalidadeRegistrada[]> {
  try {
    const mr = await fetchWithTimeout(apiUrl('/api/mensalidades'), { timeoutMs: 45_000 })
    if (!mr.ok) return []
    const raw: unknown = await mr.json()
    return Array.isArray(raw) ? (raw as MensalidadeRegistrada[]) : []
  } catch {
    return []
  }
}
