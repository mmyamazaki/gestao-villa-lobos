const turmas = [
  { nome: '1º Ano A', alunos: 28, turno: 'Manhã' },
  { nome: '2º Ano B', alunos: 26, turno: 'Tarde' },
  { nome: '3º Ano A', alunos: 24, turno: 'Manhã' },
  { nome: '4º Ano C', alunos: 22, turno: 'Integral' },
]

export function Turmas() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Turmas
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Organização por série e turno.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Nova turma
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {turmas.map((t) => (
          <article
            key={t.nome}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-slate-900">{t.nome}</h3>
            <p className="mt-1 text-sm text-slate-500">{t.turno}</p>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-900">
              {t.alunos}
              <span className="ml-1 text-sm font-normal text-slate-500">alunos</span>
            </p>
            <button
              type="button"
              className="mt-4 text-left text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Ver detalhes
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
