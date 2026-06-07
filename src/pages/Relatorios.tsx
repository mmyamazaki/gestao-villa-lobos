import { useState } from 'react'

import { RelatorioAulas } from './relatorios/RelatorioAulas'
import { RelatorioFinanceiro } from './relatorios/RelatorioFinanceiro'
import { RelatorioInstrumentos } from './relatorios/RelatorioInstrumentos'

type Categoria = 'aulas' | 'financeiro' | 'instrumentos'

const CATEGORIAS: { id: Categoria; label: string; desc: string }[] = [
  { id: 'aulas', label: 'Aulas e reposições', desc: 'Presença, faltas e conteúdo lançados pelos professores.' },
  { id: 'financeiro', label: 'Financeiro', desc: 'Extrato por aluno, a receber por mês/ano, resumo geral e cancelamentos.' },
  { id: 'instrumentos', label: 'Por instrumento', desc: 'Quantidade de alunos por instrumento e lista por instrumento/curso.' },
]

export function Relatorios() {
  const [categoria, setCategoria] = useState<Categoria>('aulas')
  const atual = CATEGORIAS.find((c) => c.id === categoria) ?? CATEGORIAS[0]!

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Relatórios</h2>
        <p className="mt-1 text-sm text-slate-600">{atual.desc}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoria(c.id)}
            className={[
              'rounded-lg px-4 py-2 text-sm font-semibold transition',
              categoria === c.id
                ? 'bg-[#003366] text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {c.label}
          </button>
        ))}
      </div>

      {categoria === 'aulas' ? (
        <RelatorioAulas />
      ) : categoria === 'financeiro' ? (
        <RelatorioFinanceiro />
      ) : (
        <RelatorioInstrumentos />
      )}
    </div>
  )
}
