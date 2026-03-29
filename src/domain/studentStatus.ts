import type { Student } from './types'

/** Aluno ativo com matrícula (curso) mas sem professor correspondente na base (dados incompletos ou legado). */
export function studentNeedsTeacherReassignment(
  student: Student,
  teachers: { id: string }[],
): boolean {
  const en = student.enrollment
  if (!en) return false
  if (student.status !== 'ativo') return false
  const tid = typeof en.teacherId === 'string' ? en.teacherId.trim() : ''
  if (!tid) return true
  return !teachers.some((t) => t.id === tid)
}

/** Data ISO YYYY-MM-DD (comparação lexicográfica segura). */
export function isoDateOnly(s: string | undefined): string | undefined {
  if (!s || typeof s !== 'string') return undefined
  return s.slice(0, 10)
}

/**
 * O aluno deve aparecer como ocupando a grade semanal do professor nesta data de referência?
 * Inativo com cancelamento futuro: ainda ocupa até o dia anterior à data de cancelamento.
 */
export function shouldStudentOccupyScheduleSlot(student: Student, referenceDateIso: string): boolean {
  if (!student.enrollment) return false
  if (student.status !== 'inativo') return student.status === 'ativo'
  const dc = isoDateOnly(student.dataCancelamento)
  if (!dc) return false
  return referenceDateIso < dc
}

export function isStudentActiveEnrolled(s: Student): boolean {
  return s.status === 'ativo' && Boolean(s.enrollment)
}
