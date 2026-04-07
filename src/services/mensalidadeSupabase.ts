/**
 * Mensalidades via Supabase REST (mesmo Postgres que o Prisma), quando a API Node
 * não está acessível no browser (site estático, CORS, URL errada).
 * Requer políticas RLS em prisma/sql/rls_anon_mensalidade.sql (intranet / dev).
 */
import { getSupabase } from '../integrations/supabase/client'
import type { MensalidadeRegistrada, MensalidadeStatus } from '../domain/types'

function optNum(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function normStatus(st: unknown): MensalidadeStatus {
  if (st === 'cancelado' || st === 'pago' || st === 'pendente') return st
  return 'pendente'
}

export function mapSupabaseRowToMensalidade(row: Record<string, unknown>): MensalidadeRegistrada {
  const mf = row.manual_fine ?? row.manualFine
  const mi = row.manual_interest ?? row.manualInterest
  const an = row.adjustment_notes ?? row.adjustmentNotes
  const dp = row.discountPercent
  const disc = dp === 5 || dp === 10 ? dp : 0
  const paid =
    typeof row.paidAt === 'string' && row.paidAt.length >= 8 ? row.paidAt.slice(0, 10) : undefined
  return {
    id: String(row.id ?? ''),
    studentId: String(row.studentId ?? ''),
    studentNome: String(row.studentNome ?? ''),
    courseId: String(row.courseId ?? ''),
    courseLabel: String(row.courseLabel ?? ''),
    parcelNumber: typeof row.parcelNumber === 'number' ? row.parcelNumber : Number(row.parcelNumber) || 1,
    referenceMonth: String(row.referenceMonth ?? ''),
    dueDate: String(row.dueDate ?? '').slice(0, 10),
    baseAmount: Number(row.baseAmount ?? 0),
    discountPercent: disc as 0 | 5 | 10,
    liquidAmount: Number(row.liquidAmount ?? 0),
    generatedAt: String(row.generatedAt ?? ''),
    waivesLateFees: Boolean(row.waivesLateFees),
    paidAt: paid,
    status: normStatus(row.status),
    manualFine: optNum(mf),
    manualInterest: optNum(mi),
    adjustmentNotes: typeof an === 'string' && an.trim() ? an.trim() : undefined,
  }
}

export function mensalidadeToSupabaseRow(m: MensalidadeRegistrada): Record<string, unknown> {
  return {
    id: m.id,
    studentId: m.studentId,
    studentNome: m.studentNome ?? '',
    courseId: m.courseId,
    courseLabel: m.courseLabel ?? '',
    parcelNumber: m.parcelNumber,
    referenceMonth: m.referenceMonth ?? '',
    dueDate: m.dueDate ?? '',
    baseAmount: m.baseAmount,
    discountPercent: m.discountPercent,
    liquidAmount: m.liquidAmount,
    generatedAt: m.generatedAt ?? '',
    waivesLateFees: m.waivesLateFees,
    paidAt: m.paidAt ?? null,
    status: m.status,
    manual_fine: m.manualFine ?? null,
    manual_interest: m.manualInterest ?? null,
    adjustment_notes: m.adjustmentNotes ?? null,
  }
}

export async function fetchMensalidadesFromSupabase(): Promise<MensalidadeRegistrada[]> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const { data, error } = await sb
    .from('Mensalidade')
    .select('*')
    .order('studentId', { ascending: true })
    .order('parcelNumber', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => mapSupabaseRowToMensalidade(r as Record<string, unknown>))
}

export async function upsertMensalidadeInSupabase(m: MensalidadeRegistrada): Promise<void> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const { error } = await sb
    .from('Mensalidade')
    .upsert(mensalidadeToSupabaseRow(m), { onConflict: 'id' })

  if (error) {
    throw new Error(
      `Não foi possível salvar mensalidade no Supabase: ${error.message}. Confira RLS em "Mensalidade" (prisma/sql/rls_anon_mensalidade.sql) ou use a API Node.`,
    )
  }
}
