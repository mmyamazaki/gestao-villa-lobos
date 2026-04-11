import { isSupabaseConfigured } from '../integrations/supabase/client'
import type { ClassSessionLog } from '../domain/types'
import {
  fetchLessonLogsFromSupabase,
  upsertLessonLogInSupabase,
} from '../services/lessonLogSupabase'
import { apiUrl } from './apiBase'
import { fetchWithTimeout } from './fetchWithTimeout'

/**
 * Carrega registos de aula: GET /api/lesson-logs; em falha, tenta Supabase se configurado.
 */
export async function fetchLessonLogsRemoteBestEffort(): Promise<ClassSessionLog[]> {
  try {
    const r = await fetchWithTimeout(apiUrl('/api/lesson-logs'), { timeoutMs: 45_000 })
    const text = await r.text()

    if (r.ok) {
      try {
        const raw = JSON.parse(text) as unknown
        if (Array.isArray(raw)) {
          return raw as ClassSessionLog[]
        }
      } catch {
        if (/<!DOCTYPE|<html/i.test(text)) {
          console.warn(
            '[lessonLogs] /api/lesson-logs devolveu HTML — defina VITE_API_BASE_URL para o Express ou use Supabase com RLS (prisma/sql/rls_anon_lesson_log.sql).',
          )
        } else {
          console.warn('[lessonLogs] JSON inválido de /api/lesson-logs:', text.slice(0, 100))
        }
      }
    } else {
      console.warn('[lessonLogs] GET /api/lesson-logs', r.status, text.slice(0, 180))
    }
  } catch (e) {
    console.warn('[lessonLogs] rede em /api/lesson-logs', e)
  }

  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const rows = await fetchLessonLogsFromSupabase()
    if (rows.length > 0) {
      console.info('[lessonLogs] carregados via Supabase (fallback):', rows.length)
    }
    return rows
  } catch (e) {
    console.warn('[lessonLogs] Supabase SELECT:', e instanceof Error ? e.message : e)
    return []
  }
}

/** Grava um registo de aula: PUT na API Node; em falha, upsert via Supabase se permitido. */
export async function pushLessonLogRemote(l: ClassSessionLog): Promise<void> {
  try {
    const res = await fetchWithTimeout(apiUrl(`/api/lesson-logs/${encodeURIComponent(l.id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(l),
      timeoutMs: 90_000,
    })
    if (res.ok) return
    const t = await res.text().catch(() => '')
    console.warn('[lessonLogsApi] PUT HTTP', l.id, res.status, t.slice(0, 160))
  } catch (e) {
    console.warn('[lessonLogsApi] PUT rede', l.id, e)
  }

  if (!isSupabaseConfigured()) {
    console.warn(
      '[lessonLogsApi] Registo não gravado na API; Supabase (VITE_*) não configurado — outro dispositivo não verá este registo até a API responder.',
    )
    return
  }

  try {
    await upsertLessonLogInSupabase(l)
    console.info('[lessonLogsApi] registo gravado via Supabase', l.id)
  } catch (e) {
    console.warn('[lessonLogsApi] Supabase upsert', l.id, e instanceof Error ? e.message : e)
  }
}
