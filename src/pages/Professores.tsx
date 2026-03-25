import { Link } from 'react-router-dom'
import { useSchool } from '../state/SchoolContext'

export function Professores() {
  const { state } = useSchool()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Professores</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cadastro completo e grade de horários integrada às matrículas.
          </p>
        </div>
        <Link
          to="/professores/novo"
          aria-label="Ir para o cadastro de novo professor"
          className="inline-flex items-center justify-center rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
        >
          Novo professor
        </Link>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {state.teachers.map((t) => (
          <li key={t.id}>
            <Link
              to={`/professores/${t.id}`}
              className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{t.nome || 'Professor sem nome'}</p>
                <p className="text-sm text-slate-500">{t.contatos || '—'}</p>
              </div>
              <span className="text-sm font-medium text-emerald-800">Editar</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
