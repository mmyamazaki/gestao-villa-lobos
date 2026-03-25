import { useState } from 'react'
import { FormActions } from '../components/FormActions'
import { useSchool } from '../state/SchoolContext'
import type { SchoolSettings } from '../domain/types'

function settingsKey(s: SchoolSettings, seed: string) {
  return `${seed}|${s.observacoesInternas.length}|${s.observacoesInternas.slice(0, 12)}`
}

export function Configuracoes() {
  const { state, saveSettings, resetDemoData } = useSchool()
  return (
    <ConfiguracoesInner
      key={settingsKey(state.settings, `${state.teachers.length}-${state.students.length}`)}
      initialObservacoes={state.settings.observacoesInternas}
      saveSettings={saveSettings}
      resetDemoData={resetDemoData}
    />
  )
}

function ConfiguracoesInner({
  initialObservacoes,
  saveSettings,
  resetDemoData,
}: {
  initialObservacoes: string
  saveSettings: (s: SchoolSettings) => void
  resetDemoData: () => void
}) {
  const [draft, setDraft] = useState(initialObservacoes)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Configurações</h2>
        <p className="mt-1 text-sm text-slate-600">
          Observações internas persistem no navegador junto com cursos, professores e alunos.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Observações internas</h3>
        <textarea
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <FormActions
          onCancel={() => setDraft(initialObservacoes)}
          onSave={() => saveSettings({ observacoesInternas: draft })}
        />
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-rose-900">Zona de risco</h3>
        <p className="mt-2 text-sm text-rose-800">
          Restaurar dados de demonstração apaga alunos e redefine professores/cursos padrão (o conteúdo do
          armazenamento local é substituído).
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-rose-900 shadow-sm ring-1 ring-rose-200 hover:bg-rose-50"
          onClick={() => {
            if (window.confirm('Confirma resetar todos os dados locais?')) resetDemoData()
          }}
        >
          Restaurar dados de demonstração
        </button>
      </section>
    </div>
  )
}
