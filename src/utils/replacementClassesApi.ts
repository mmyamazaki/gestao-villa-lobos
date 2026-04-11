import { isSupabaseConfigured } from '../integrations/supabase/client'
import type { ReplacementClass } from '../domain/types'
import {
  fetchReplacementClassesFromSupabase,
  upsertReplacementClassInSupabase,
} from '../services/replacementClassSupabase'
import { apiUrl } from './apiBase'
import { fetchWithTimeout } from './fetchWithTimeout'

/**
 * Carrega reposições: GET /api/replacement-classes; em falha, tenta Supabase se configurado.
 */
export async function fetchReplacementClassesRemoteBestEffort(): Promise<ReplacementClass[]> {
  try {
    const r = await fetchWithTimeout(apiUrl('/api/replacement-classes'), { timeoutMs: 45_000 })
    const text = await r.text()

    if (r.ok) {
      try {
        const raw = JSON.parse(text) as unknown
        if (Array.isArray(raw)) {
          return raw as ReplacementClass[]
        }
      } catch {
        if (/<!DOCTYPE|<html/i.test(text)) {
          console.warn(
            '[replacementClasses] /api/replacement-classes devolveu HTML — defina VITE_API_BASE_URL para o Express ou use Supabase com RLS (prisma/sql/rls_anon_replacement_class.sql).',
          )
        } else {
          console.warn(
            '[replacementClasses] JSON inválido de /api/replacement-classes:',
            text.slice(0, 100),
          )
        }
      }
    } else {
      console.warn('[replacementClasses] GET /api/replacement-classes', r.status, text.slice(0, 180))
    }
  } catch (e) {
    console.warn('[replacementClasses] rede em /api/replacement-classes', e)
  }

  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const rows = await fetchReplacementClassesFromSupabase()
    if (rows.length > 0) {
      console.info('[replacementClasses] carregadas via Supabase (fallback):', rows.length)
    }
    return rows
  } catch (e) {
    console.warn('[replacementClasses] Supabase SELECT:', e instanceof Error ? e.message : e)
    return []
  }
}

/** Grava uma reposição: PUT na API Node; em falha, upsert via Supabase se permitido. */
export async function pushReplacementClassRemote(r: ReplacementClass): Promise<void> {
  try {
    const res = await fetchWithTimeout(apiUrl(`/api/replacement-classes/${encodeURIComponent(r.id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(r),
      timeoutMs: 90_000,
    })
    if (res.ok) return
    const t = await res.text().catch(() => '')
    console.warn('[replacementClassesApi] PUT HTTP', r.id, res.status, t.slice(0, 160))
  } catch (e) {
    console.warn('[replacementClassesApi] PUT rede', r.id, e)
  }

  if (!isSupabaseConfigured()) {
    console.warn(
      '[replacementClassesApi] Reposição não gravada na API; Supabase (VITE_*) não configurado — outro dispositivo não verá este registo até a API responder.',
    )
    return
  }

  try {
    await upsertReplacementClassInSupabase(r)
    console.info('[replacementClassesApi] reposição gravada via Supabase', r.id)
  } catch (e) {
    console.warn('[replacementClassesApi] Supabase upsert', r.id, e instanceof Error ? e.message : e)
  }
}
