import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DeleteTeacherDialog } from '../components/DeleteTeacherDialog'
import type { Student } from '../domain/types'
import { useSchool } from '../state/SchoolContext'
import { teacherDeleteBlockedAlertLines } from '../utils/teacherDeleteBlockedMessage'

function studentsWithTeacher(students: Student[], teacherId: string): Student[] {
  return students.filter((s) => s.enrollment?.teacherId === teacherId)
}

export function Professores() {
  const { state, deleteTeacher } = useSchool()
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nome: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const openDelete = (id: string, nome: string) => {
    const blocking = studentsWithTeacher(state.students, id)
    if (blocking.length > 0) {
      window.alert(teacherDeleteBlockedAlertLines(blocking))
      return
    }
    setConfirmDelete({ id, nome: nome || 'Professor sem nome' })
  }

  const runDelete = () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    void (async () => {
      try {
        await deleteTeacher(confirmDelete.id)
        setConfirmDelete(null)
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Não foi possível excluir o professor.')
      } finally {
        setIsDeleting(false)
      }
    })()
  }

  return (
    <div className="relative space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 pr-0 sm:pr-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Professores</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cadastro completo, instrumentos lecionados e grade de horários integrados às matrículas.
            Só é possível excluir um professor quando nenhum aluno estiver matriculado com ele — antes,
            transfira cada aluno para outro professor na aba Alunos.
          </p>
        </div>
        <div className="shrink-0 sm:pt-0.5">
          <Link
            to="/professores/novo"
            aria-label="Ir para o cadastro de novo professor"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#003366] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 sm:w-auto"
          >
            Novo professor
          </Link>
        </div>
      </header>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {state.teachers.map((t) => (
          <li key={t.id}>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Link
                to={`/professores/${t.id}`}
                className="min-w-0 flex-1 transition-colors hover:opacity-90"
              >
                <p className="font-medium text-slate-900">{t.nome || 'Professor sem nome'}</p>
                <p className="text-sm text-slate-500">{t.contatos || '—'}</p>
              </Link>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <Link
                  to={`/professores/${t.id}`}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openDelete(t.id, t.nome)
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <DeleteTeacherDialog
        open={Boolean(confirmDelete)}
        teacherNome={confirmDelete?.nome ?? ''}
        isDeleting={isDeleting}
        onCancel={() => !isDeleting && setConfirmDelete(null)}
        onConfirm={runDelete}
      />
    </div>
  )
}
