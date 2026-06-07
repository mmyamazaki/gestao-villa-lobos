import { useMemo, useState } from 'react'

import type { MensalidadeRegistrada, Student } from '../../domain/types'
import { useSchool } from '../../state/SchoolContext'
import { exportReportTablePdf } from '../../utils/reportTablePdf'

type FinView = 'aluno' | 'mes' | 'ano' | 'resumo' | 'cancel'

const FIN_TABS: { id: FinView; label: string }[] = [
  { id: 'aluno', label: 'Por aluno (extrato)' },
  { id: 'mes', label: 'A receber por mês' },
  { id: 'ano', label: 'A receber por ano' },
  { id: 'resumo', label: 'Resumo geral' },
  { id: 'cancel', label: 'Cancelamentos' },
]

type SituacaoFiltro = 'todas' | 'pagas' | 'abertas' | 'canceladas'

interface ExtratoRow {
  id: string
  parcela: number
  refLabel: string
  vencimentoBR: string
  vencimento: string
  valor: number
  situacao: 'Paga' | 'Em aberto' | 'Cancelada'
  pagoEmBR: string
}

const brl = (n: number) => `R$ ${n.toFixed(2)}`
const ddmmaaaa = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return y && m ? `${m}/${y}` : ym
}

const isOpen = (m: MensalidadeRegistrada) => m.status !== 'cancelado' && !m.paidAt
const isPaid = (m: MensalidadeRegistrada) => Boolean(m.paidAt) && m.status !== 'cancelado'
const isCancelled = (m: MensalidadeRegistrada) => m.status === 'cancelado'

interface GroupRow {
  chave: string
  label: string
  qtd: number
  valor: number
}

export function RelatorioFinanceiro() {
  const { state } = useSchool()
  const [view, setView] = useState<FinView>('aluno')
  const [cancelInicio, setCancelInicio] = useState('')
  const [cancelFim, setCancelFim] = useState('')
  const [alunoId, setAlunoId] = useState('')
  const [alunoInicio, setAlunoInicio] = useState('')
  const [alunoFim, setAlunoFim] = useState('')
  const [alunoSituacao, setAlunoSituacao] = useState<SituacaoFiltro>('todas')

  const alunosOrdenados = useMemo(
    () => [...state.students].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [state.students],
  )
  const alunoSelecionado = useMemo(
    () => state.students.find((s) => s.id === alunoId) ?? null,
    [state.students, alunoId],
  )

  const extratoRows = useMemo<ExtratoRow[]>(() => {
    if (!alunoId) return []
    return state.mensalidades
      .filter((m) => m.studentId === alunoId)
      .filter((m) => {
        // Filtro por data de pagamento; parcelas sem pagamento (em aberto) sempre aparecem.
        if (!m.paidAt) return true
        const pago = m.paidAt.slice(0, 10)
        if (alunoInicio && pago < alunoInicio) return false
        if (alunoFim && pago > alunoFim) return false
        return true
      })
      .filter((m) => {
        if (alunoSituacao === 'pagas') return isPaid(m)
        if (alunoSituacao === 'abertas') return isOpen(m)
        if (alunoSituacao === 'canceladas') return isCancelled(m)
        return true
      })
      .sort((a, b) => a.parcelNumber - b.parcelNumber)
      .map((m) => ({
        id: m.id,
        parcela: m.parcelNumber,
        refLabel: fmtMonth(m.referenceMonth),
        vencimento: m.dueDate,
        vencimentoBR: ddmmaaaa(m.dueDate),
        valor: m.liquidAmount,
        situacao: isCancelled(m) ? 'Cancelada' : isPaid(m) ? 'Paga' : 'Em aberto',
        pagoEmBR: m.paidAt ? ddmmaaaa(m.paidAt.slice(0, 10)) : '—',
      }))
  }, [state.mensalidades, alunoId, alunoInicio, alunoFim, alunoSituacao])

  const extratoResumo = useMemo(() => {
    let pagoQtd = 0
    let pagoValor = 0
    let abertoQtd = 0
    let abertoValor = 0
    let canceladaQtd = 0
    for (const r of extratoRows) {
      if (r.situacao === 'Paga') {
        pagoQtd += 1
        pagoValor += r.valor
      } else if (r.situacao === 'Em aberto') {
        abertoQtd += 1
        abertoValor += r.valor
      } else {
        canceladaQtd += 1
      }
    }
    return { pagoQtd, pagoValor, abertoQtd, abertoValor, canceladaQtd }
  }, [extratoRows])

  const porMes = useMemo<GroupRow[]>(() => {
    const map = new Map<string, { qtd: number; valor: number }>()
    for (const m of state.mensalidades) {
      if (!isOpen(m)) continue
      const cur = map.get(m.referenceMonth) ?? { qtd: 0, valor: 0 }
      cur.qtd += 1
      cur.valor += m.liquidAmount
      map.set(m.referenceMonth, cur)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, v]) => ({ chave: ym, label: fmtMonth(ym), qtd: v.qtd, valor: v.valor }))
  }, [state.mensalidades])

  const porAno = useMemo<GroupRow[]>(() => {
    const map = new Map<string, { qtd: number; valor: number }>()
    for (const m of state.mensalidades) {
      if (!isOpen(m)) continue
      const ano = m.referenceMonth.slice(0, 4)
      const cur = map.get(ano) ?? { qtd: 0, valor: 0 }
      cur.qtd += 1
      cur.valor += m.liquidAmount
      map.set(ano, cur)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ano, v]) => ({ chave: ano, label: ano, qtd: v.qtd, valor: v.valor }))
  }, [state.mensalidades])

  const resumo = useMemo(() => {
    let recebidoValor = 0
    let recebidoQtd = 0
    let abertoValor = 0
    let abertoQtd = 0
    let canceladoValor = 0
    let canceladoQtd = 0
    for (const m of state.mensalidades) {
      if (isCancelled(m)) {
        canceladoQtd += 1
        canceladoValor += m.liquidAmount
      } else if (isPaid(m)) {
        recebidoQtd += 1
        recebidoValor += m.liquidAmount
      } else {
        abertoQtd += 1
        abertoValor += m.liquidAmount
      }
    }
    return {
      recebidoValor,
      recebidoQtd,
      abertoValor,
      abertoQtd,
      canceladoValor,
      canceladoQtd,
    }
  }, [state.mensalidades])

  const totalMes = useMemo(
    () => porMes.reduce((s, r) => ({ qtd: s.qtd + r.qtd, valor: s.valor + r.valor }), { qtd: 0, valor: 0 }),
    [porMes],
  )

  const cancelados = useMemo(() => {
    const studentsCancel: Student[] = state.students
      .filter((s) => s.status === 'inativo' && s.dataCancelamento)
      .filter((s) => {
        const d = s.dataCancelamento ?? ''
        if (cancelInicio && d < cancelInicio) return false
        if (cancelFim && d > cancelFim) return false
        return true
      })
      .sort((a, b) => (b.dataCancelamento ?? '').localeCompare(a.dataCancelamento ?? ''))
    return studentsCancel
  }, [state.students, cancelInicio, cancelFim])

  const tabBtn = (active: boolean) =>
    [
      'rounded-lg px-3 py-2 text-sm font-medium transition',
      active ? 'bg-[#003366] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ].join(' ')

  const hoje = new Date().toISOString().slice(0, 10)

  const exportMes = () =>
    exportReportTablePdf<GroupRow>({
      title: 'A receber por mês (parcelas em aberto)',
      subtitleLines: [`Total: ${totalMes.qtd} parcela(s)  ·  ${brl(totalMes.valor)}`],
      orientation: 'portrait',
      columns: [
        { label: 'Mês/Ano', w: 50, align: 'left', get: (r) => r.label },
        { label: 'Parcelas em aberto', w: 60, align: 'center', get: (r) => String(r.qtd) },
        { label: 'Valor a receber', w: 60, align: 'right', get: (r) => brl(r.valor) },
      ],
      rows: porMes,
      fileName: `a-receber-por-mes-${hoje}.pdf`,
    })

  const exportAno = () =>
    exportReportTablePdf<GroupRow>({
      title: 'A receber por ano (parcelas em aberto)',
      orientation: 'portrait',
      columns: [
        { label: 'Ano', w: 50, align: 'left', get: (r) => r.label },
        { label: 'Parcelas em aberto', w: 60, align: 'center', get: (r) => String(r.qtd) },
        { label: 'Valor a receber', w: 60, align: 'right', get: (r) => brl(r.valor) },
      ],
      rows: porAno,
      fileName: `a-receber-por-ano-${hoje}.pdf`,
    })

  const exportResumo = () =>
    exportReportTablePdf<{ cat: string; qtd: number; valor: number }>({
      title: 'Resumo financeiro geral',
      orientation: 'portrait',
      columns: [
        { label: 'Situação', w: 60, align: 'left', get: (r) => r.cat },
        { label: 'Parcelas', w: 50, align: 'center', get: (r) => String(r.qtd) },
        { label: 'Valor', w: 60, align: 'right', get: (r) => brl(r.valor) },
      ],
      rows: [
        { cat: 'Recebido', qtd: resumo.recebidoQtd, valor: resumo.recebidoValor },
        { cat: 'Em aberto', qtd: resumo.abertoQtd, valor: resumo.abertoValor },
        { cat: 'Canceladas', qtd: resumo.canceladoQtd, valor: resumo.canceladoValor },
      ],
      fileName: `resumo-financeiro-${hoje}.pdf`,
    })

  const exportExtrato = () => {
    if (!alunoSelecionado) return
    const periodo = `Período (pagamento): ${alunoInicio ? ddmmaaaa(alunoInicio) : 'início'} a ${alunoFim ? ddmmaaaa(alunoFim) : 'hoje'}`
    const situacaoTxt =
      alunoSituacao === 'todas'
        ? 'todas'
        : alunoSituacao === 'pagas'
          ? 'apenas pagas'
          : alunoSituacao === 'abertas'
            ? 'apenas em aberto'
            : 'apenas canceladas'
    return exportReportTablePdf<ExtratoRow>({
      title: 'Extrato financeiro do aluno',
      orientation: 'portrait',
      subtitleLines: [
        `Aluno: ${alunoSelecionado.nome}  ·  Código: ${alunoSelecionado.codigo}`,
        `${periodo}  ·  Situação: ${situacaoTxt}`,
        `Pagas: ${extratoResumo.pagoQtd} (${brl(extratoResumo.pagoValor)})  ·  Em aberto: ${extratoResumo.abertoQtd} (${brl(extratoResumo.abertoValor)})  ·  Canceladas: ${extratoResumo.canceladaQtd}`,
      ],
      columns: [
        { label: 'Parcela', w: 22, align: 'center', get: (r) => `${r.parcela}/12` },
        { label: 'Mês ref.', w: 28, align: 'center', get: (r) => r.refLabel },
        { label: 'Vencimento', w: 32, align: 'center', get: (r) => r.vencimentoBR },
        { label: 'Valor', w: 32, align: 'right', get: (r) => brl(r.valor) },
        { label: 'Situação', w: 30, align: 'center', get: (r) => r.situacao },
        { label: 'Pago em', w: 32, align: 'center', get: (r) => r.pagoEmBR },
      ],
      rows: extratoRows,
      fileName: `extrato-${alunoSelecionado.codigo || 'aluno'}-${hoje}.pdf`,
      emptyText: 'Nenhuma parcela para os filtros selecionados.',
    })
  }

  const exportCancel = () =>
    exportReportTablePdf<Student>({
      title: 'Cancelamentos de alunos',
      subtitleLines: [
        `Período: ${cancelInicio ? ddmmaaaa(cancelInicio) : 'início'} a ${cancelFim ? ddmmaaaa(cancelFim) : 'hoje'}  ·  Total: ${cancelados.length}`,
      ],
      orientation: 'landscape',
      columns: [
        { label: 'Código', w: 28, align: 'left', get: (s) => s.codigo },
        { label: 'Aluno', w: 70, align: 'left', get: (s) => s.nome },
        { label: 'Cancelado em', w: 32, align: 'center', get: (s) => ddmmaaaa(s.dataCancelamento ?? '') },
        { label: 'Observações', w: 120, align: 'left', get: (s) => s.observacoesCancelamento ?? '' },
      ],
      rows: cancelados,
      fileName: `cancelamentos-${hoje}.pdf`,
    })

  const exportAtual =
    view === 'aluno'
      ? exportExtrato
      : view === 'mes'
        ? exportMes
        : view === 'ano'
          ? exportAno
          : view === 'resumo'
            ? exportResumo
            : exportCancel

  const exportDisabled = view === 'aluno' && !alunoId

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FIN_TABS.map((t) => (
            <button key={t.id} type="button" className={tabBtn(view === t.id)} onClick={() => setView(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportAtual}
          disabled={exportDisabled}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00264d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          Exportar PDF
        </button>
      </div>

      {view === 'aluno' && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ext-aluno">
                  Aluno
                </label>
                <select
                  id="ext-aluno"
                  value={alunoId}
                  onChange={(e) => setAlunoId(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                >
                  <option value="">Selecione um aluno…</option>
                  {alunosOrdenados.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                      {s.status === 'inativo' ? ' (cancelado)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ext-inicio">
                  Pago a partir de
                </label>
                <input
                  id="ext-inicio"
                  type="date"
                  value={alunoInicio}
                  onChange={(e) => setAlunoInicio(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ext-fim">
                  Pago até
                </label>
                <input
                  id="ext-fim"
                  type="date"
                  value={alunoFim}
                  onChange={(e) => setAlunoFim(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="ext-situacao">
                  Situação
                </label>
                <select
                  id="ext-situacao"
                  value={alunoSituacao}
                  onChange={(e) => setAlunoSituacao(e.target.value as SituacaoFiltro)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                >
                  <option value="todas">Todas</option>
                  <option value="pagas">Apenas pagas</option>
                  <option value="abertas">Apenas em aberto</option>
                  <option value="canceladas">Apenas canceladas</option>
                </select>
              </div>
            </div>

            {alunoId && (
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                  Pagas: <strong className="tabular-nums">{extratoResumo.pagoQtd}</strong> · {brl(extratoResumo.pagoValor)}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
                  Em aberto: <strong className="tabular-nums">{extratoResumo.abertoQtd}</strong> · {brl(extratoResumo.abertoValor)}
                </span>
                {extratoResumo.canceladaQtd > 0 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                    Canceladas: <strong className="tabular-nums">{extratoResumo.canceladaQtd}</strong>
                  </span>
                )}
              </div>
            )}
          </section>

          {!alunoId ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              Selecione um aluno para ver o extrato de mensalidades.
            </div>
          ) : (
            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-center">Parcela</th>
                    <th className="px-4 py-3 text-center">Mês ref.</th>
                    <th className="px-4 py-3 text-center">Vencimento</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-center">Situação</th>
                    <th className="px-4 py-3 text-center">Pago em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extratoRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma parcela para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                  {extratoRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center tabular-nums text-slate-700">{r.parcela}/12</td>
                      <td className="px-4 py-3 text-center text-slate-700">{r.refLabel}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-700">{r.vencimentoBR}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">{brl(r.valor)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            r.situacao === 'Paga'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.situacao === 'Em aberto'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-600',
                          ].join(' ')}
                        >
                          {r.situacao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-700">{r.pagoEmBR}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {view === 'mes' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mês/Ano</th>
                <th className="px-4 py-3 text-center">Parcelas em aberto</th>
                <th className="px-4 py-3 text-right">Valor a receber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porMes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma parcela em aberto.
                  </td>
                </tr>
              )}
              {porMes.map((r) => (
                <tr key={r.chave} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-700">{r.qtd}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">{brl(r.valor)}</td>
                </tr>
              ))}
            </tbody>
            {porMes.length > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-center tabular-nums">{totalMes.qtd}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{brl(totalMes.valor)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>
      )}

      {view === 'ano' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3 text-center">Parcelas em aberto</th>
                <th className="px-4 py-3 text-right">Valor a receber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porAno.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma parcela em aberto.
                  </td>
                </tr>
              )}
              {porAno.map((r) => (
                <tr key={r.chave} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-700">{r.qtd}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">{brl(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {view === 'resumo' && (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">Recebido</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-950">{brl(resumo.recebidoValor)}</p>
            <p className="mt-1 text-xs text-emerald-900/70">{resumo.recebidoQtd} parcela(s) paga(s)</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Em aberto</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-950">{brl(resumo.abertoValor)}</p>
            <p className="mt-1 text-xs text-amber-900/70">{resumo.abertoQtd} parcela(s) pendente(s)</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Canceladas</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-800">{brl(resumo.canceladoValor)}</p>
            <p className="mt-1 text-xs text-slate-500">{resumo.canceladoQtd} parcela(s) cancelada(s)</p>
          </div>
        </section>
      )}

      {view === 'cancel' && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="cancel-inicio">
                  Cancelado a partir de
                </label>
                <input
                  id="cancel-inicio"
                  type="date"
                  value={cancelInicio}
                  onChange={(e) => setCancelInicio(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="cancel-fim">
                  Cancelado até
                </label>
                <input
                  id="cancel-fim"
                  type="date"
                  value={cancelFim}
                  onChange={(e) => setCancelFim(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>
              <div className="flex items-end">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  Cancelamentos: <strong className="tabular-nums">{cancelados.length}</strong>
                </span>
              </div>
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Cancelado em</th>
                  <th className="px-4 py-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cancelados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Nenhum cancelamento no período.
                    </td>
                  </tr>
                )}
                {cancelados.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 tabular-nums text-slate-700">{s.codigo}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.nome}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{ddmmaaaa(s.dataCancelamento ?? '')}</td>
                    <td className="px-4 py-3 text-slate-700">{s.observacoesCancelamento || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
