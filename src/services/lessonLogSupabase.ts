/**
 * Registos de aula via Supabase REST quando a API Node não está acessível no browser.
 * Requer políticas RLS em prisma/sql/rls_anon_lesson_log.sql (intranet / dev).
 */
import { getSupabase } from '../integrations/supabase/client'
import type { ClassSessionLog } from '../domain/types'

export function mapSupabaseRowToLessonLog(row: Record<string, unknown>): ClassSessionLog {
  return {
    id: String(row.id ?? ''),
    teacherId: String(row.teacherId ?? ''),
    studentId: String(row.studentId ?? ''),
    lessonDate: String(row.lessonDate ?? '').slice(0, 10),
    slotKey: String(row.slotKey ?? ''),
    present: Boolean(row.present),
    content: typeof row.content === 'string' ? row.content : '',
    updatedAt: String(row.updatedAt ?? ''),
  }
}

function lessonLogToSupabaseRow(l: ClassSessionLog): Record<string, unknown> {
  return {
    id: l.id,
    teacherId: l.teacherId,
    studentId: l.studentId,
    lessonDate: l.lessonDate.slice(0, 10),
    slotKey: l.slotKey,
    present: l.present,
    content: l.content ?? '',
    updatedAt: l.updatedAt,
  }
}

export async function fetchLessonLogsFromSupabase(): Promise<ClassSessionLog[]> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const { data, error } = await sb
    .from('LessonLog')
    .select('*')
    .order('lessonDate', { ascending: false })
    .order('updatedAt', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => mapSupabaseRowToLessonLog(r as Record<string, unknown>))
}

export async function upsertLessonLogInSupabase(l: ClassSessionLog): Promise<void> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const { error } = await sb
    .from('LessonLog')
    .upsert(lessonLogToSupabaseRow(l), { onConflict: 'id' })

  if (error) {
    throw new Error(
      `Não foi possível salvar registo de aula no Supabase: ${error.message}. Confira RLS em "LessonLog" (prisma/sql/rls_anon_lesson_log.sql) ou use a API Node.`,
    )
  }
}
