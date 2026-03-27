import type { Student } from './types'

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
