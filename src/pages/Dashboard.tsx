import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSchool } from '../state/SchoolContext'
import { FormActions } from '../components/FormActions'

export function Dashboard() {
  const { state } = useSchool()
  const [note, setNote] = useState('')

  const stats = useMemo(() => {
    const matriculados = state.students.filter((s) => s.enrollment).length
    const cursos = state.courses.length
    return [
      { label: 'Alunos cadastrados', value: String(state.students.length) },
      { label: 'Com matrícula ativa', value: String(matriculados) },
      { label: 'Itens de catálogo (instrumento × estágio)', value: String(cursos) },
      { label: 'Professores', value: String(state.teachers.length) },
    ]
  }, [state.students, state.courses.length, state.teachers.length])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Início</h2>
        <p className="mt-1 text-sm text-slate-600">
          Painel da Escola de Música Villa-Lobos — dados locais (navegador) integrados entre módulos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/alunos/novo"
          aria-label="Abrir cadastro de nova matrícula"
          className="inline-flex rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
        >
          Nova matrícula
        </Link>
        <Link
          to="/cursos"
          className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Catálogo de cursos
        </Link>
        <Link
          to="/financeiro"
          className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
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
