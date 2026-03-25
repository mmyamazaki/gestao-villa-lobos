import { Link } from 'react-router-dom'
import { calcAgeYears } from '../domain/age'
import { formatSlotKeyLabel } from '../domain/schedule'
import { useSchool } from '../state/SchoolContext'

export function Alunos() {
  const { state, getTeacher, getCourse } = useSchool()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Alunos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Matrículas integradas à grade dos professores e ao financeiro.
          </p>
        </div>
        <Link
          to="/alunos/novo"
          aria-label="Ir para o cadastro de nova matrícula"
          className="inline-flex items-center justify-center rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
        >
          Nova matrícula
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Idade</th>
              <th className="px-4 py-3">Curso / Professor</th>
              <th className="px-4 py-3">Horários</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum aluno cadastrado.
                </td>
              </tr>
            )}
            {state.students.map((s) => {
              const age = calcAgeYears(s.dataNascimento)
              const en = s.enrollment
              const course = en ? getCourse(en.courseId) : undefined
              const teacher = en ? getTeacher(en.teacherId) : undefined
              return (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.nome}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{s.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">{age !== null ? `${age}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {course && teacher
                      ? `${course.instrumentLabel} · ${teacher.nome}`
                      : '—'}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">
                    {en?.slotKeys?.length
                      ? en.slotKeys.map((k) => formatSlotKeyLabel(k)).join('; ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/alunos/${s.id}`}
                      className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
