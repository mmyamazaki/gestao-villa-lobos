/**
 * Aulas de reposição via Supabase REST quando a API Node não está acessível no browser.
 * Requer políticas RLS em prisma/sql/rls_anon_replacement_class.sql (intranet / dev).
 */
import { getSupabase } from '../integrations/supabase/client'
import type { ReplacementClass, ReplacementClassStatus } from '../domain/types'

function normStatus(s: unknown): ReplacementClassStatus {
  if (s === 'realizada' || s === 'faltou') return s
  return 'agendada'
}

export function mapSupabaseRowToReplacementClass(row: Record<string, unknown>): ReplacementClass {
  const r = row
  return {
    id: String(r.id ?? ''),
    studentId: String(r.studentId ?? ''),
    studentNome: String(r.studentNome ?? r.studentName ?? ''),
    teacherId: String(r.teacherId ?? ''),
    teacherNome: String(r.teacherNome ?? r.teacherName ?? ''),
    date: String(row.date ?? '').slice(0, 10),
    startTime: String(row.startTime ?? '').slice(0, 5),
    duration: row.duration === 60 || Number(row.duration) === 60 ? 60 : 30,
    status: normStatus(row.status),
    content: typeof row.content === 'string' ? row.content : '',
    present: typeof row.present === 'boolean' ? row.present : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
  }
}

function replacementClassToSupabaseRow(r: ReplacementClass): Record<string, unknown> {
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: r.studentNome ?? '',
    teacherId: r.teacherId,
    teacherName: r.teacherNome ?? '',
    date: r.date.slice(0, 10),
    startTime: r.startTime.slice(0, 5),
    duration: r.duration === 60 ? 60 : 30,
    status: r.status,
    content: r.content ?? '',
    present: typeof r.present === 'boolean' ? r.present : null,
    updatedAt:
      typeof r.updatedAt === 'string' && r.updatedAt.trim()
        ? r.updatedAt
        : new Date().toISOString(),
  }
}

export async function fetchReplacementClassesFromSupabase(): Promise<ReplacementClass[]> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const { data, error } = await sb
    .from('ReplacementClass')
    .select('*')
    .order('date', { ascending: false })
    .order('updatedAt', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => mapSupabaseRowToReplacementClass(r as Record<string, unknown>))
}

export async function upsertReplacementClassInSupabase(r: ReplacementClass): Promise<void> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const { error } = await sb
    .from('ReplacementClass')
    .upsert(replacementClassToSupabaseRow(r), { onConflict: 'id' })

  if (error) {
    throw new Error(
      `Não foi possível salvar reposição no Supabase: ${error.message}. Confira RLS em "ReplacementClass" (prisma/sql/rls_anon_replacement_class.sql) ou use a API Node.`,
    )
  }
}
