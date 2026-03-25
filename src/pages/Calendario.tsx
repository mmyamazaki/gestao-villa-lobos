import { useMemo } from 'react'
import { formatSlotKeyLabel } from '../domain/schedule'
import { useSchool } from '../state/SchoolContext'
import { FormActions } from '../components/FormActions'

export function Calendario() {
  const { state } = useSchool()

  const rows = useMemo(() => {
    const out: {
      teacher: string
      student: string
      slot: string
      course?: string
    }[] = []
    for (const t of state.teachers) {
      for (const [key, cell] of Object.entries(t.schedule)) {
        if (cell.status !== 'busy') continue
        const st = state.students.find((s) => s.id === cell.studentId)
        const courseId = st?.enrollment?.courseId
        const course = courseId ? state.courses.find((c) => c.id === courseId) : undefined
        out.push({
          teacher: t.nome,
          student: cell.studentName,
          slot: formatSlotKeyLabel(key),
          course: course ? `${course.instrumentLabel} ${course.stage}º` : undefined,
        })
      }
    }
    return out.sort((a, b) => a.slot.localeCompare(b.slot, 'pt-BR'))
  }, [state.teachers, state.students, state.courses])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Calendário</h2>
        <p className="mt-1 text-sm text-slate-600">
          Visão consolidada dos horários ocupados (dados integrados professores + alunos).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Horário</th>
              <th className="px-3 py-3">Professor</th>
              <th className="px-3 py-3">Aluno</th>
              <th className="px-3 py-3">Curso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  Nenhum horário ocupado.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.teacher}-${r.slot}-${i}`} className="hover:bg-slate-50/80">
                <td className="px-3 py-3 font-medium text-slate-900">{r.slot}</td>
                <td className="px-3 py-3 text-slate-600">{r.teacher}</td>
                <td className="px-3 py-3 text-slate-600">{r.student}</td>
                <td className="px-3 py-3 text-slate-600">{r.course ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormActions onCancel={() => undefined} onSave={() => undefined} />
    </div>
  )
}
