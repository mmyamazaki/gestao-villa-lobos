import type { Student } from '../domain/types'

/** Texto para alerta quando há alunos matriculados com o professor a excluir. */
export function teacherDeleteBlockedAlertLines(blocking: Student[]): string {
  const n = blocking.length
  const names = blocking.map((s) => s.nome.trim() || 'Aluno sem nome').join(', ')
  return [
    `Este professor não pode ser excluído: há ${n} aluno(s) com matrícula vinculada a ele.`,
    '',
    'Na aba Alunos, use Editar matrícula em cada um, designe outro professor e os horários, e salve. Só depois será possível excluir este professor.',
    '',
    `Alunos: ${names}`,
  ].join('\n')
}
