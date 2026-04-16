import { isSupabaseConfigured } from '../integrations/supabase/client'
import {
  fetchMensalidadesFromSupabase,
  upsertMensalidadeInSupabase,
} from '../services/mensalidadeSupabase'
import type { MensalidadeRegistrada } from '../domain/types'
import { apiUrl } from './apiBase'
import { fetchWithTimeoutPrismaBootRetry } from './apiPrismaBootWait'
import { fetchWithTimeout } from './fetchWithTimeout'

/**
 * Carrega parcelas: tenta GET /api/mensalidades; se falhar, resposta for HTML/JSON inválido
 * ou lista vazia com Supabase configurado, tenta SELECT direto em "Mensalidade" (mesmo Postgres).
 */
export async function fetchMensalidadesRemoteBestEffort(): Promise<MensalidadeRegistrada[]> {
  try {
    const mr = await fetchWithTimeoutPrismaBootRetry(apiUrl('/api/mensalidades'), {
      timeoutMs: 45_000,
    })
    const text = await mr.text()

    if (mr.ok) {
      try {
        const raw = JSON.parse(text) as unknown
        if (Array.isArray(raw) && raw.length > 0) {
          return raw as MensalidadeRegistrada[]
        }
      } catch {
        if (/<!DOCTYPE|<html/i.test(text)) {
          console.warn(
            '[mensalidades] /api/mensalidades devolveu HTML — o domínio do site provavelmente não tem API Node. Defina VITE_API_BASE_URL para o servidor Express ou execute prisma/sql/rls_anon_mensalidade.sql e use VITE_SUPABASE_*.',
          )
        } else {
          console.warn('[mensalidades] JSON inválido de /api/mensalidades:', text.slice(0, 100))
        }
      }
    } else {
      console.warn('[mensalidades] GET /api/mensalidades', mr.status, text.slice(0, 180))
    }
  } catch (e) {
    console.warn('[mensalidades] rede em /api/mensalidades', e)
  }

  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const rows = await fetchMensalidadesFromSupabase()
    if (rows.length > 0) {
      console.info('[mensalidades] carregadas via Supabase (fallback):', rows.length)
    }
    return rows
  } catch (e) {
    console.warn('[mensalidades] Supabase SELECT:', e instanceof Error ? e.message : e)
    return []
  }
}

/** @deprecated use fetchMensalidadesRemoteBestEffort */
export const fetchMensalidadesFromApiBestEffort = fetchMensalidadesRemoteBestEffort

/** Grava parcelas: PUT na API Node; em falha, upsert via Supabase se configurado e RLS permitir. */
export async function pushMensalidadesRemote(rows: MensalidadeRegistrada[]): Promise<void> {
  if (rows.length === 0) return

  const apiFailed: MensalidadeRegistrada[] = []

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
    const m = rows[i]!
    if (r.status === 'rejected') {
      console.warn('[mensalidadesApi] PUT rede', m.id, r.reason)
      apiFailed.push(m)
      continue
    }
    const res = r.value
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[mensalidadesApi] PUT HTTP', m.id, res.status, t.slice(0, 160))
      apiFailed.push(m)
    }
  }

  if (apiFailed.length === 0) return

  if (!isSupabaseConfigured()) {
    console.warn(
      '[mensalidadesApi] Parcelas não gravadas na API; Supabase (VITE_*) não configurado — outro PC não verá estes dados até a API responder.',
    )
    return
  }

  for (const m of apiFailed) {
    try {
      await upsertMensalidadeInSupabase(m)
      console.info('[mensalidadesApi] parcela gravada via Supabase', m.id)
    } catch (e) {
      console.warn('[mensalidadesApi] Supabase upsert', m.id, e instanceof Error ? e.message : e)
    }
  }
}

/** Alias histórico (salvar após matrícula / pagamento). */
export const pushMensalidadesToApi = pushMensalidadesRemote
