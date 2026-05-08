import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { daysLateAfterDueDate, effectiveDueDateForLateFees } from '../domain/finance'
import { isStudentActiveEnrolled } from '../domain/studentStatus'
import { useSchool } from '../state/SchoolContext'
import { FormActions } from '../components/FormActions'

function addDaysIso(isoDate: string, days: number) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function Dashboard() {
  const { state } = useSchool()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const horizon = addDaysIso(today, 30)

  const stats = useMemo(() => {
    const matriculadosAtivos = state.students.filter(isStudentActiveEnrolled).length
    const inativos = state.students.filter((s) => s.status === 'inativo').length
    const cursos = state.courses.length
    return [
      { label: 'Alunos cadastrados', value: String(state.students.length) },
      { label: 'Com matrícula ativa (aluno ativo)', value: String(matriculadosAtivos) },
      { label: 'Alunos inativos', value: String(inativos) },
      { label: 'Itens de catálogo (instrumento × estágio)', value: String(cursos) },
      { label: 'Professores', value: String(state.teachers.length) },
    ]
  }, [state.students, state.courses.length, state.teachers.length])

  const financeStats = useMemo(() => {
    const unpaid = state.mensalidades.filter((m) => !m.paidAt && m.status !== 'cancelado')
    return {
      open: unpaid.length,
      overdue: unpaid.filter((m) => {
        const due = new Date(m.dueDate + 'T12:00:00')
        const now = new Date(today + 'T12:00:00')
        return daysLateAfterDueDate(now, due) > 0
      }).length,
      dueSoon: unpaid.filter((m) => {
        const due = effectiveDueDateForLateFees(new Date(m.dueDate + 'T12:00:00'))
        const dueIso = due.toISOString().slice(0, 10)
        return dueIso >= today && dueIso <= horizon
      }).length,
    }
  }, [state.mensalidades, today, horizon])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Início</h2>
        <p className="mt-1 text-sm text-slate-600">
          Painel da Escola de Música Villa-Lobos — dados locais (navegador) integrados entre módulos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <p className="text-xs font-medium text-slate-500 sm:text-sm">{s.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900 sm:mt-2 sm:text-3xl">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Atalhos do financeiro
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/financeiro?filter=open')}
            className="min-h-[44px] cursor-pointer rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left shadow-sm transition duration-200 hover:scale-[1.01] hover:shadow-md sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-950/80">
              Mensalidades em aberto
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-amber-950 sm:mt-2 sm:text-3xl">
              {financeStats.open}
            </p>
            <p className="mt-1 text-xs text-amber-900/70">Não pagas e não canceladas</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/financeiro?filter=overdue')}
            className="min-h-[44px] cursor-pointer rounded-xl border border-red-200 bg-red-50/60 p-4 text-left shadow-sm transition duration-200 hover:scale-[1.01] hover:shadow-md sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-900/80">Em atraso</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-red-950 sm:mt-2 sm:text-3xl">
              {financeStats.overdue}
            </p>
            <p className="mt-1 text-xs text-red-900/70">Pendente com vencimento anterior a hoje</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/financeiro?filter=due-soon')}
            className="min-h-[44px] cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-left shadow-sm transition duration-200 hover:scale-[1.01] hover:shadow-md sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
              A vencer (30 dias)
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-emerald-950 sm:mt-2 sm:text-3xl">
              {financeStats.dueSoon}
            </p>
            <p className="mt-1 text-xs text-emerald-900/70">Pendente entre hoje e +30 dias</p>
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/alunos/novo"
          aria-label="Abrir cadastro de nova matrícula"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
        >
          Nova matrícula
        </Link>
        <Link
          to="/cursos"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Catálogo de cursos
        </Link>
        <Link
          to="/financeiro"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Financeiro
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Observação do dia (rascunho)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Use Salvar para guardar no painel ou Cancelar para limpar o rascunho (não afeta outros módulos).
        </p>
        <textarea
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lembretes rápidos…"
        />
        <FormActions
          onCancel={() => setNote('')}
          onSave={() => setNote((n) => n.trimEnd())}
          saveLabel="Salvar rascunho"
        />
      </section>
    </div>
  )
}
