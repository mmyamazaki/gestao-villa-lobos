import { useMemo, useState } from 'react'

import { useSchool } from '../../state/SchoolContext'
import { exportReportTablePdf } from '../../utils/reportTablePdf'

type InstrView = 'qtd' | 'lista'

const INSTR_TABS: { id: InstrView; label: string }[] = [
  { id: 'qtd', label: 'Quantidade por instrumento' },
  { id: 'lista', label: 'Lista de alunos' },
]

interface QtdRow {
  instrument: string
  label: string
  cursos: number
  alunos: number
}

interface ListaRow {
  id: string
  codigo: string
  nome: string
  instrumentSlug: string
  instrumentLabel: string
  levelLabel: string
  cursoLabel: string
  courseId: string
  professor: string
  ativo: boolean
}

export function RelatorioInstrumentos() {
  const { state, getCourse, getTeacher } = useSchool()
  const [view, setView] = useState<InstrView>('qtd')
  const [incluirInativos, setIncluirInativos] = useState(false)
  const [filtroInstrumento, setFiltroInstrumento] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')

  const hoje = new Date().toISOString().slice(0, 10)

  const instrumentosOrdenados = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of state.courses) map.set(c.instrument, c.instrumentLabel)
    return [...map.entries()]
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [state.courses])

  const cursosFiltrados = useMemo(() => {
    return [...state.courses]
      .filter((c) => !filtroInstrumento || c.instrument === filtroInstrumento)
      .sort((a, b) =>
        `${a.instrumentLabel} ${a.levelLabel}`.localeCompare(`${b.instrumentLabel} ${b.levelLabel}`, 'pt-BR'),
      )
  }, [state.courses, filtroInstrumento])

  const porInstrumento = useMemo<QtdRow[]>(() => {
    const map = new Map<string, { label: string; alunos: number; cursos: Set<string> }>()
    for (const s of state.students) {
      if (!s.enrollment) continue
      if (!incluirInativos && s.status !== 'ativo') continue
      const c = getCourse(s.enrollment.courseId)
      if (!c) continue
      const cur = map.get(c.instrument) ?? { label: c.instrumentLabel, alunos: 0, cursos: new Set<string>() }
      cur.alunos += 1
      cur.cursos.add(c.id)
      map.set(c.instrument, cur)
    }
    return [...map.entries()]
      .map(([instrument, v]) => ({ instrument, label: v.label, cursos: v.cursos.size, alunos: v.alunos }))
      .sort((a, b) => b.alunos - a.alunos || a.label.localeCompare(b.label, 'pt-BR'))
  }, [state.students, incluirInativos, getCourse])

  const totalQtd = useMemo(
    () => porInstrumento.reduce((s, r) => s + r.alunos, 0),
    [porInstrumento],
  )

  const lista = useMemo<ListaRow[]>(() => {
    return state.students
      .filter((s) => s.enrollment)
      .filter((s) => (incluirInativos ? true : s.status === 'ativo'))
      .map((s) => {
        const c = getCourse(s.enrollment!.courseId)
        const professor = getTeacher(s.enrollment!.teacherId)?.nome ?? '—'
        return {
          id: s.id,
          codigo: s.codigo,
          nome: s.nome,
          instrumentSlug: c?.instrument ?? '',
          instrumentLabel: c?.instrumentLabel ?? '—',
          levelLabel: c?.levelLabel ?? '—',
          cursoLabel: c ? `${c.instrumentLabel} · ${c.levelLabel}` : '—',
          courseId: c?.id ?? '',
          professor,
          ativo: s.status === 'ativo',
        }
      })
      .filter((r) => !filtroInstrumento || r.instrumentSlug === filtroInstrumento)
      .filter((r) => !filtroCurso || r.courseId === filtroCurso)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [state.students, incluirInativos, filtroInstrumento, filtroCurso, getCourse, getTeacher])

  const tabBtn = (active: boolean) =>
    [
      'rounded-lg px-3 py-2 text-sm font-medium transition',
      active ? 'bg-[#003366] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ].join(' ')

  const situacaoTxt = incluirInativos ? 'todos (ativos + inativos)' : 'apenas ativos'

  const exportQtd = () =>
    exportReportTablePdf<QtdRow>({
      title: 'Quantidade de alunos por instrumento',
      orientation: 'portrait',
      subtitleLines: [`Considerando: ${situacaoTxt}  ·  Total de alunos: ${totalQtd}`],
      columns: [
        { label: 'Instrumento', w: 70, align: 'left', get: (r) => r.label },
        { label: 'Cursos', w: 40, align: 'center', get: (r) => String(r.cursos) },
        { label: 'Alunos', w: 40, align: 'center', get: (r) => String(r.alunos) },
      ],
      rows: porInstrumento,
      fileName: `alunos-por-instrumento-${hoje}.pdf`,
    })

  const exportLista = () => {
    const instrTxt = filtroInstrumento
      ? instrumentosOrdenados.find((i) => i.slug === filtroInstrumento)?.label ?? '—'
      : 'todos'
    const cursoTxt = filtroCurso ? getCourse(filtroCurso)?.levelLabel ?? '—' : 'todos'
    return exportReportTablePdf<ListaRow>({
      title: 'Lista de alunos por instrumento / curso',
      orientation: 'landscape',
      subtitleLines: [
        `Instrumento: ${instrTxt}  ·  Curso: ${cursoTxt}  ·  Situação: ${situacaoTxt}  ·  Total: ${lista.length}`,
      ],
      columns: [
        { label: 'Código', w: 26, align: 'left', get: (r) => r.codigo },
        { label: 'Aluno', w: 75, align: 'left', get: (r) => r.nome },
        { label: 'Instrumento', w: 45, align: 'left', get: (r) => r.instrumentLabel },
        { label: 'Nível', w: 40, align: 'left', get: (r) => r.levelLabel },
        { label: 'Professor', w: 55, align: 'left', get: (r) => r.professor },
        { label: 'Situação', w: 26, align: 'center', get: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
      ],
      rows: lista,
      fileName: `lista-alunos-instrumento-${hoje}.pdf`,
    })
  }

  const exportAtual = view === 'qtd' ? exportQtd : exportLista

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {INSTR_TABS.map((t) => (
            <button key={t.id} type="button" className={tabBtn(view === t.id)} onClick={() => setView(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportAtual}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00264d]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          Exportar PDF
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view === 'lista' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="instr-filtro">
                  Instrumento
                </label>
                <select
                  id="instr-filtro"
                  value={filtroInstrumento}
                  onChange={(e) => {
                    setFiltroInstrumento(e.target.value)
                    setFiltroCurso('')
                  }}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                >
                  <option value="">Todos</option>
                  {instrumentosOrdenados.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="curso-filtro">
                  Curso
                </label>
                <select
                  id="curso-filtro"
                  value={filtroCurso}
                  onChange={(e) => setFiltroCurso(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                >
                  <option value="">Todos</option>
                  {cursosFiltrados.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.instrumentLabel} · {c.levelLabel}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex items-end">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={incluirInativos}
                onChange={(e) => setIncluirInativos(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#003366] focus:ring-[#003366]"
              />
              Incluir alunos inativos
            </label>
          </div>
        </div>
      </section>

      {view === 'qtd' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Instrumento</th>
                <th className="px-4 py-3 text-center">Cursos</th>
                <th className="px-4 py-3 text-center">Alunos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porInstrumento.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Nenhum aluno matriculado.
                  </td>
                </tr>
              )}
              {porInstrumento.map((r) => (
                <tr key={r.instrument} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-700">{r.cursos}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-900">{r.alunos}</td>
                </tr>
              ))}
            </tbody>
            {porInstrumento.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-center">—</td>
                  <td className="px-4 py-3 text-center tabular-nums">{totalQtd}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>
      )}

      {view === 'lista' && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Instrumento</th>
                <th className="px-4 py-3">Nível</th>
                <th className="px-4 py-3">Professor</th>
                <th className="px-4 py-3 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nenhum aluno para os filtros selecionados.
                  </td>
                </tr>
              )}
              {lista.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.codigo}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.nome}</td>
                  <td className="px-4 py-3 text-slate-700">{r.instrumentLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{r.levelLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{r.professor}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        r.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
                      ].join(' ')}
                    >
                      {r.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
