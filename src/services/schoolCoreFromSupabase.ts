/**
 * Carrega o “core” da escola via Supabase REST (anon key) — só funciona se RLS permitir SELECT a `anon`.
 * Em produção segura (ver prisma/sql/rls_secure_production.sql) este fallback falha de propósito:
 * use sempre a API Node (`/api/school/core`).
 */
import { getSupabase } from '../integrations/supabase/client'
import type { Course, Student, Teacher } from '../domain/types'
import type { ScheduleMap } from '../domain/types'

function mapCourse(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    instrument: String(row.instrument),
    instrumentLabel: String(row.instrumentLabel ?? ''),
    levelLabel: String(row.levelLabel ?? ''),
    monthlyPrice: Number(row.monthlyPrice),
  }
}

function mapTeacher(row: Record<string, unknown>): Teacher {
  const schedule = row.schedule
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    dataNascimento: String(row.dataNascimento ?? ''),
    naturalidade: String(row.naturalidade ?? ''),
    filiacao: String(row.filiacao ?? ''),
    rg: String(row.rg ?? ''),
    cpf: String(row.cpf ?? ''),
    endereco: String(row.endereco ?? ''),
    contatos: String(row.contatos ?? ''),
    email: String(row.email ?? ''),
    celular: String(row.celular ?? ''),
    login: String(row.login ?? ''),
    senha: String(row.senha ?? ''),
    instrumentSlugs: Array.isArray(row.instrumentSlugs) ? [...row.instrumentSlugs] as string[] : [],
    schedule: (schedule && typeof schedule === 'object' ? schedule : {}) as ScheduleMap,
  }
}

function mapStudent(row: Record<string, unknown>): Student {
  const status = row.status === 'inativo' ? 'inativo' : 'ativo'
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ''),
    nome: String(row.nome ?? ''),
    dataNascimento: String(row.dataNascimento ?? ''),
    rg: String(row.rg ?? ''),
    cpf: String(row.cpf ?? ''),
    filiacao: String(row.filiacao ?? ''),
    endereco: String(row.endereco ?? ''),
    telefone: String(row.telefone ?? ''),
    email: String(row.email ?? ''),
    login: String(row.login ?? ''),
    senha: String(row.senha ?? ''),
    responsavel: row.responsavel as Student['responsavel'],
    enrollment: row.enrollment as Student['enrollment'],
    status,
    dataCancelamento: row.dataCancelamento != null ? String(row.dataCancelamento) : undefined,
    observacoesCancelamento:
      row.observacoesCancelamento != null ? String(row.observacoesCancelamento) : undefined,
  }
}

export async function fetchSchoolCoreFromSupabase(): Promise<{
  courses: Course[]
  teachers: Teacher[]
  students: Student[]
}> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const [cRes, tRes, sRes] = await Promise.all([
    sb.from('Course').select('*').order('id'),
    sb.from('Teacher').select('*').order('nome'),
    sb.from('Student').select('*').order('nome'),
  ])

  const errs = [cRes.error, tRes.error, sRes.error].filter(Boolean)
  if (errs.length > 0) {
    const msg = errs.map((e) => e!.message).join('; ')
    throw new Error(
      `Supabase: ${msg}. Crie políticas RLS (SELECT para anon) em Course, Teacher e Student, ou use API Node.`,
    )
  }

  const courses = (cRes.data ?? []).map((r) => mapCourse(r as Record<string, unknown>))
  const teachers = (tRes.data ?? []).map((r) => mapTeacher(r as Record<string, unknown>))
  const students = (sRes.data ?? []).map((r) => mapStudent(r as Record<string, unknown>))

  return { courses, teachers, students }
}
