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

/** Grava parcelas no Postgres (via API Node). Usar após salvar matrícula para outros PCs verem o extrato. */
export async function pushMensalidadesToApi(rows: MensalidadeRegistrada[]): Promise<void> {
  const results = await Promise.allSettled(
    rows.map((m) =>
      fetchWithTimeout(apiUrl(`/api/mensalidades/${encodeURIComponent(m.id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
        timeoutMs: 90_000,
      }),
    ),
  )
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    const id = rows[i]!.id
    if (r.status === 'rejected') {
      console.warn('[mensalidadesApi] PUT falhou (rede)', id, r.reason)
      continue
    }
    const res = r.value
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[mensalidadesApi] PUT', id, res.status, t.slice(0, 160))
    }
  }
}
