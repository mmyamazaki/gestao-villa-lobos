import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { daysLateAfterDueDate, effectiveDueDateForLateFees, lateFeesOnGross } from '../domain/finance'
import { projectUnpaidMensalidade } from '../domain/mensalidadeProjection'
import type { MensalidadeRegistrada } from '../domain/types'
import { isStudentActiveEnrolled } from '../domain/studentStatus'
import { useSchool } from '../state/SchoolContext'
import { EditPaidMensalidadeModal } from '../components/EditPaidMensalidadeModal'
import { FormActions } from '../components/FormActions'
import { PaymentMensalidadeModal } from '../components/PaymentMensalidadeModal'
import { generateMensalidadeReceiptPdf } from '../utils/generateReceiptPdf'

function addDaysIso(isoDate: string, days: number) {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function Financeiro() {
  const { state, registerMensalidadePayment, reopenMensalidadePayment } = useSchool()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = new Date().toISOString().slice(0, 10)
  const filterParam = searchParams.get('filter')
  const quickFilter = filterParam === 'open' || filterParam === 'overdue' || filterParam === 'due-soon' || filterParam === 'active'
    ? filterParam
    : null
  const [paymentDate, setPaymentDate] = useState(today)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [payModalRow, setPayModalRow] = useState<MensalidadeRegistrada | null>(null)
  const [editModalRow, setEditModalRow] = useState<MensalidadeRegistrada | null>(null)

  const studentsForFinance = useMemo(() => {
    const withMens = new Set(state.mensalidades.map((m) => m.studentId))
    return [...state.students]
      .filter((s) => s.enrollment != null || withMens.has(s.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [state.students, state.mensalidades])

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    if (!q) return studentsForFinance
    return studentsForFinance.filter(
      (s) =>
        s.nome.toLowerCase().includes(q) ||
        s.codigo.toLowerCase().includes(q) ||
        s.id === selectedStudentId,
    )
  }, [studentQuery, studentsForFinance, selectedStudentId])

  const dashboard = useMemo(() => {
    const activeCount = state.students.filter(isStudentActiveEnrolled).length
    const unpaid = state.mensalidades.filter((m) => !m.paidAt && m.status !== 'cancelado')
    const openCount = unpaid.length
    const overdueCount = unpaid.filter((m) => {
      const due = new Date(m.dueDate + 'T12:00:00')
      const now = new Date(today + 'T12:00:00')
      return daysLateAfterDueDate(now, due) > 0
    }).length
    const horizon = addDaysIso(today, 30)
    const dueSoonCount = unpaid.filter(
      (m) => {
        const due = effectiveDueDateForLateFees(new Date(m.dueDate + 'T12:00:00'))
        const dueIso = due.toISOString().slice(0, 10)
        return dueIso >= today && dueIso <= horizon
      },
    ).length
    const openTotal = unpaid.reduce((acc, m) => acc + m.liquidAmount, 0)
    return {
      activeCount,
      openCount,
      overdueCount,
      dueSoonCount,
      openTotal,
    }
  }, [state.mensalidades, state.students, today])

  const rows = useMemo(() => {
    if (!selectedStudentId) return []
    return state.mensalidades
      .filter((m) => m.studentId === selectedStudentId)
      .sort((a, b) => a.parcelNumber - b.parcelNumber)
      .map((m) => {
        if (m.status === 'cancelado') {
          const discAmount = Math.max(0, m.baseAmount - m.liquidAmount)
          return {
            m,
            late: 0,
            fees: { fine: 0, interest: 0, total: 0 },
            discAmount,
            displayLiquid: m.liquidAmount,
          }
        }
        if (m.paidAt) {
          const discAmount = Math.max(0, m.baseAmount - m.liquidAmount)
          const due = new Date(m.dueDate + 'T12:00:00')
          const pay = new Date(m.paidAt.slice(0, 10) + 'T12:00:00')
          let late = 0
          let fees = { fine: 0, interest: 0, total: m.liquidAmount }
          if (m.waivesLateFees) {
            fees = { fine: 0, interest: 0, total: m.liquidAmount }
          } else {
            late = daysLateAfterDueDate(pay, due)
            if (late <= 0) {
              fees = { fine: 0, interest: 0, total: m.liquidAmount }
            } else {
              const auto = lateFeesOnGross(m.baseAmount, late)
              const fine = m.manualFine != null ? m.manualFine : auto.fine
              const interest = m.manualInterest != null ? m.manualInterest : auto.interest
              fees = {
                fine,
                interest,
                total: m.baseAmount + fine + interest,
              }
            }
          }
          return { m, late, fees, discAmount, displayLiquid: m.liquidAmount }
        }
        const proj = projectUnpaidMensalidade(m, paymentDate)
        return {
          m,
          late: proj.late,
          fees: proj.fees,
          discAmount: proj.contractualDiscountReais,
          displayLiquid: proj.displayLiquid,
        }
      })
  }, [state.mensalidades, selectedStudentId, paymentDate])

  const selectedStudent = studentsForFinance.find((s) => s.id === selectedStudentId)
  const quickRows = useMemo(() => {
    if (!quickFilter || quickFilter === 'active') return []
    const horizon = addDaysIso(today, 30)
    return state.mensalidades
      .filter((m) => m.status !== 'cancelado' && !m.paidAt)
      .filter((m) => {
        const due = effectiveDueDateForLateFees(new Date(m.dueDate + 'T12:00:00'))
        const dueIso = due.toISOString().slice(0, 10)
        if (quickFilter === 'open') return true
        if (quickFilter === 'overdue') {
          const now = new Date(today + 'T12:00:00')
          return daysLateAfterDueDate(now, due) > 0
        }
        return dueIso >= today && dueIso <= horizon
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.studentNome.localeCompare(b.studentNome))
  }, [quickFilter, state.mensalidades, today])

  const quickActiveStudents = useMemo(() => {
    if (quickFilter !== 'active') return []
    return [...state.students]
      .filter(isStudentActiveEnrolled)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [quickFilter, state.students])

  const exportQuickCsv = () => {
    if (!quickFilter) return
    const rows =
      quickFilter === 'active'
        ? quickActiveStudents.map((s) => `${s.codigo};${s.nome};ATIVO`)
        : quickRows.map((m) => `${m.studentNome};${m.courseLabel};${m.referenceMonth};${m.dueDate};${m.liquidAmount.toFixed(2)};PENDENTE`)
    const header =
      quickFilter === 'active'
        ? 'codigo;aluno;status'
        : 'aluno;curso;referencia;vencimento;liquido;situacao'
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro-${quickFilter}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportQuickPdf = () => {
    if (!quickFilter) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const title =
      quickFilter === 'open'
        ? 'Relatorio - Mensalidades em aberto'
        : quickFilter === 'overdue'
          ? 'Relatorio - Mensalidades em atraso'
          : quickFilter === 'due-soon'
            ? 'Relatorio - Mensalidades a vencer (30 dias)'
            : 'Relatorio - Alunos ativos'
    doc.setFontSize(12)
    doc.text(title, 14, 14)
    doc.setFontSize(9)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)
    let y = 28
    if (quickFilter === 'active') {
      for (const s of quickActiveStudents) {
        if (y > 285) {
          doc.addPage()
          y = 14
        }
        doc.text(`${s.codigo} - ${s.nome}`, 14, y)
        y += 5
      }
      doc.save(`financeiro-${quickFilter}-${new Date().toISOString().slice(0, 10)}.pdf`)
      return
    }

    const x = 10
    const tableW = 190
    const columns = [
      { label: 'Aluno', w: 58, align: 'left' as const },
      { label: 'Curso', w: 34, align: 'left' as const },
      { label: 'Parc.', w: 14, align: 'center' as const },
      { label: 'Ref.', w: 18, align: 'center' as const },
      { label: 'Venc.', w: 20, align: 'center' as const },
      { label: 'Líquido', w: 20, align: 'right' as const },
      { label: 'Situação', w: 26, align: 'center' as const },
    ]
    const rowH = 7
    const drawHeader = () => {
      doc.setFillColor(236, 242, 255)
      doc.rect(x, y, tableW, rowH, 'F')
      doc.setDrawColor(170, 184, 214)
      doc.rect(x, y, tableW, rowH)
      let cx = x
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      for (const c of columns) {
        const tx = c.align === 'left' ? cx + 1.5 : c.align === 'right' ? cx + c.w - 1.5 : cx + c.w / 2
        doc.text(c.label, tx, y + 4.6, { align: c.align })
        cx += c.w
      }
      y += rowH
    }
    drawHeader()

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const m of quickRows) {
      if (y > 286) {
        doc.addPage()
        y = 14
        drawHeader()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
      }
      doc.setDrawColor(220, 226, 240)
      doc.rect(x, y, tableW, rowH)
      const data = [
        m.studentNome.slice(0, 36),
        m.courseLabel.slice(0, 22),
        `${m.parcelNumber}/12`,
        m.referenceMonth,
        m.dueDate,
        `R$ ${m.liquidAmount.toFixed(2)}`,
        'Pendente',
      ]
      let cx = x
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i]!
        const tx = c.align === 'left' ? cx + 1.5 : c.align === 'right' ? cx + c.w - 1.5 : cx + c.w / 2
        doc.text(data[i]!, tx, y + 4.6, { align: c.align })
        cx += c.w
      }
      y += rowH
    }
    doc.save(`financeiro-${quickFilter}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const finalizePayment = async (
    m: MensalidadeRegistrada,
    patch: {
      paidDate: string
      manualFine: number
      manualInterest: number
      adjustmentNotes?: string
      liquidAmount?: number
    },
  ) => {
    const d = patch.paidDate.slice(0, 10)
    await registerMensalidadePayment(m.id, {
      paidDate: d,
      manualFine: m.waivesLateFees ? 0 : patch.manualFine,
      manualInterest: m.waivesLateFees ? 0 : patch.manualInterest,
      adjustmentNotes: patch.adjustmentNotes,
      ...(patch.liquidAmount != null ? { liquidAmount: patch.liquidAmount } : {}),
    })
    const paid: MensalidadeRegistrada = {
      ...m,
      paidAt: d,
      status: 'pago',
      liquidAmount: patch.liquidAmount ?? m.liquidAmount,
      manualFine: m.waivesLateFees ? undefined : patch.manualFine,
      manualInterest: m.waivesLateFees ? undefined : patch.manualInterest,
      adjustmentNotes: patch.adjustmentNotes?.trim() || undefined,
    }
    void generateMensalidadeReceiptPdf(paid, { kind: 'payment', paymentDate: d })
  }

  const reprintPaymentReceipt = (m: MensalidadeRegistrada) => {
    const d = m.paidAt?.slice(0, 10)
    if (!d) return
    void generateMensalidadeReceiptPdf(m, { kind: 'payment', paymentDate: d })
  }

  return (
    <div className="space-y-6">
      <PaymentMensalidadeModal
        open={payModalRow != null}
        m={payModalRow}
        paymentDate={paymentDate}
        onClose={() => setPayModalRow(null)}
        onConfirm={async (patch) => {
          if (!payModalRow) return
          const row = payModalRow
          await finalizePayment(row, patch)
        }}
      />
      {editModalRow && (
        <EditPaidMensalidadeModal
          key={`${editModalRow.id}-${editModalRow.paidAt ?? ''}`}
          m={editModalRow}
          onClose={() => setEditModalRow(null)}
          onConfirm={async (reason) => {
            await reopenMensalidadePayment(editModalRow.id, reason)
          }}
        />
      )}
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {formError}
        </div>
      )}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h2>
        <p className="mt-1 text-sm text-slate-600">
          Indicadores globais abaixo. O extrato de mensalidades é exibido somente após você buscar e
          selecionar um aluno. Recibos: ao quitar uma parcela ou pelo botão <strong>Reimprimir recibo</strong>{' '}
          nas linhas já pagas.
        </p>
      </div>

      {quickFilter && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-indigo-950">
                Atalho aplicado:{' '}
                {quickFilter === 'open'
                  ? 'Mensalidades em aberto'
                  : quickFilter === 'overdue'
                    ? 'Mensalidades em atraso'
                    : quickFilter === 'due-soon'
                      ? 'Mensalidades a vencer (30 dias)'
                      : 'Alunos ativos'}
              </h3>
              <p className="mt-1 text-sm text-indigo-900/80">
                Resultado carregado automaticamente via query param.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-900 hover:bg-indigo-50"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Limpar filtro
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-900 hover:bg-indigo-50"
                onClick={exportQuickCsv}
              >
                Exportar CSV
              </button>
              <button
                type="button"
                className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-900 hover:bg-indigo-50"
                onClick={exportQuickPdf}
              >
                Exportar PDF
              </button>
            </div>
          </div>

          {quickFilter === 'active' ? (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-white p-3">
              {quickActiveStudents.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum aluno ativo encontrado.</p>
              ) : (
                <ul className="space-y-1 text-sm text-slate-700">
                  {quickActiveStudents.map((s) => (
                    <li key={`active-${s.id}`}>
                      {s.nome} ({s.codigo})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
          <div className="mt-4 space-y-2 md:hidden">
            {quickRows.length === 0 && (
              <div className="rounded-lg border border-indigo-100 bg-white px-3 py-5 text-center text-sm text-slate-500">
                Nenhuma mensalidade encontrada para este filtro.
              </div>
            )}
            {quickRows.map((m) => (
              <article key={`quick-mobile-${m.id}`} className="rounded-lg border border-indigo-100 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">{m.studentNome}</p>
                <p className="text-xs text-slate-600">{m.courseLabel}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <p>Parcela: {m.parcelNumber}/12</p>
                  <p>Ref.: {m.referenceMonth}</p>
                  <p>Venc.: {m.dueDate}</p>
                  <p className="font-medium">Líquido: R$ {m.liquidAmount.toFixed(2)}</p>
                </div>
              </article>
            ))}
          </div>
          )}

          {quickFilter !== 'active' && (
          <div className="mt-4 hidden max-h-[min(60vh,520px)] overflow-auto rounded-lg border border-indigo-100 bg-white md:block">
            <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-indigo-900/70">
                <tr>
                  <th className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 shadow-[4px_0_10px_-4px_rgba(30,27,75,0.18)]">
                    Aluno
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 shadow-[0_1px_0_0_rgb(199,210,254)]">
                    Curso
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 shadow-[0_1px_0_0_rgb(199,210,254)]">
                    Parcela
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 shadow-[0_1px_0_0_rgb(199,210,254)]">
                    Ref.
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 shadow-[0_1px_0_0_rgb(199,210,254)]">
                    Venc.
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 text-right shadow-[0_1px_0_0_rgb(199,210,254)]">
                    Líquido
                  </th>
                  <th className="sticky top-0 z-20 whitespace-nowrap border-b border-indigo-100 bg-indigo-50 px-3 py-2 shadow-[0_1px_0_0_rgb(199,210,254)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50">
                {quickRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                      Nenhuma mensalidade encontrada para este filtro.
                    </td>
                  </tr>
                )}
                {quickRows.map((m) => (
                  <tr key={`quick-${m.id}`} className="group hover:bg-indigo-50/40">
                    <td className="sticky left-0 z-10 max-w-[200px] border-b border-indigo-50/80 bg-white px-3 py-2 font-medium text-slate-900 shadow-[4px_0_10px_-4px_rgba(30,27,75,0.12)] group-hover:bg-indigo-50">
                      {m.studentNome}
                    </td>
                    <td className="border-b border-indigo-50/80 px-3 py-2 text-slate-600">{m.courseLabel}</td>
                    <td className="border-b border-indigo-50/80 px-3 py-2 tabular-nums text-slate-600">
                      {m.parcelNumber}/12
                    </td>
                    <td className="border-b border-indigo-50/80 px-3 py-2 tabular-nums text-slate-600">
                      {m.referenceMonth}
                    </td>
                    <td className="border-b border-indigo-50/80 px-3 py-2 tabular-nums text-slate-700">
                      {m.dueDate}
                    </td>
                    <td className="border-b border-indigo-50/80 px-3 py-2 text-right tabular-nums">
                      R$ {m.liquidAmount.toFixed(2)}
                    </td>
                    <td className="border-b border-indigo-50/80 px-3 py-2 text-xs font-semibold text-amber-800">
                      Pendente
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setSearchParams({ filter: 'active' }, { replace: true })}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alunos ativos
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {dashboard.activeCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Status ativo e matrícula concluída</p>
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ filter: 'open' }, { replace: true })}
          className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-950/80">
            Mensalidades em aberto
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-950">
            {dashboard.openCount}
          </p>
          <p className="mt-1 text-xs text-amber-900/70">
            Soma líquida pendente: R$ {dashboard.openTotal.toFixed(2)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ filter: 'overdue' }, { replace: true })}
          className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-red-900/80">
            Em atraso
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-red-950">
            {dashboard.overdueCount}
          </p>
          <p className="mt-1 text-xs text-red-900/70">Vencimento anterior a hoje e não quitadas</p>
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ filter: 'due-soon' }, { replace: true })}
          className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
            A vencer (30 dias)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-950">
            {dashboard.dueSoonCount}
          </p>
          <p className="mt-1 text-xs text-emerald-900/70">Não quitadas, venc. entre hoje e +30 dias</p>
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Data de pagamento (simula multa/juros nas parcelas 2–12)
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => {
              setPaymentDate(e.target.value)
              setFieldErrors((prev) => ({ ...prev, paymentDate: '' }))
            }}
            className={`mt-1 block max-w-xs rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.paymentDate ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
          />
          {fieldErrors.paymentDate && (
            <span className="mt-1 block text-xs text-red-700">{fieldErrors.paymentDate}</span>
          )}
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Regra de vencimento: quando o dia 01 cair em sábado ou domingo, o sistema prorroga para
          o próximo dia útil antes de calcular atraso, multa e juros.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Extrato por aluno</h3>
        <p className="mt-1 text-sm text-slate-600">
          Busque pelo nome ou código e selecione o aluno para carregar as parcelas.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-[200px] flex-1 text-sm font-medium text-slate-700">
            Buscar
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Nome ou código…"
            />
          </label>
          <label className="min-w-[220px] flex-1 text-sm font-medium text-slate-700">
            Aluno
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={selectedStudentId ?? ''}
              onChange={(e) => setSelectedStudentId(e.target.value || null)}
            >
              <option value="">Selecione…</option>
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {s.codigo}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedStudent && (
          <p className="mt-3 text-sm text-slate-700">
            Extrato: <strong>{selectedStudent.nome}</strong> ({selectedStudent.codigo})
            {selectedStudent.status === 'inativo' && (
              <span className="ml-2 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800">
                Inativo
              </span>
            )}
          </p>
        )}
      </section>

      {!selectedStudentId ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
          Selecione um aluno para ver mensalidades, valores e registrar pagamentos.
        </p>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
              Nenhuma mensalidade para este aluno.
            </div>
          )}
          {rows.map(({ m, late, fees, discAmount, displayLiquid }) => (
            <article key={`mobile-${m.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.courseLabel}</p>
                  <p className="text-xs text-slate-600">{m.referenceMonth} · Venc. {m.dueDate}</p>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {m.parcelNumber}/12
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <p>Base: R$ {m.baseAmount.toFixed(2)}</p>
                <p>Desc.: {m.discountPercent}%</p>
                <p>Desc. R$: {discAmount.toFixed(2)}</p>
                <p>Líquido: R$ {displayLiquid.toFixed(2)}</p>
                <p>Atraso: {late} dia(s)</p>
                <p>Total: {m.status === 'cancelado' ? '—' : `R$ ${fees.total.toFixed(2)}`}</p>
              </div>
              <div className="mt-2 text-xs font-medium text-slate-700">
                Situação:{' '}
                {m.status === 'cancelado' ? 'Cancelada' : m.paidAt ? `Paga (${m.paidAt})` : 'Pendente'}
              </div>
              <div className="mt-3">
                {m.status === 'cancelado' ? (
                  <span className="text-xs text-slate-500">Sem ação disponível</span>
                ) : m.paidAt ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-slate-500">Quitada em {m.paidAt}</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] w-fit items-center rounded-md border border-[#003366] bg-white px-3 py-2 text-xs font-medium text-[#003366] hover:bg-slate-50"
                        onClick={() => reprintPaymentReceipt(m)}
                      >
                        Reimprimir recibo
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] w-fit items-center rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                        onClick={() => setEditModalRow(m)}
                      >
                        Reabrir parcela
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center rounded-md bg-[#003366] px-3 py-2 text-xs font-medium text-white hover:bg-[#00264d]"
                    onClick={() => setPayModalRow(m)}
                  >
                    Efetuar pagamento
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="hidden max-h-[min(70vh,640px)] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[4px_0_10px_-4px_rgba(15,23,42,0.14)]">
                  Parc.
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Curso
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Ref.
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Venc.
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Base
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Desc. %
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Desc. R$
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Líquido
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Atraso
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Multa
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Juros
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-right shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Total
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Situação
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 shadow-[0_1px_0_0_rgb(226,232,240)]">
                  Pagamento
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center text-slate-500">
                    Nenhuma mensalidade para este aluno.
                  </td>
                </tr>
              )}
              {rows.map(({ m, late, fees, discAmount, displayLiquid }) => (
                <tr key={m.id} className="group hover:bg-slate-50/80">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-white px-2 py-3 tabular-nums font-medium text-slate-900 shadow-[4px_0_10px_-4px_rgba(15,23,42,0.12)] group-hover:bg-slate-50">
                    {m.parcelNumber}/12
                  </td>
                  <td className="max-w-[120px] border-b border-slate-100 px-2 py-3 text-slate-600">
                    {m.courseLabel}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 tabular-nums text-slate-600">
                    {m.referenceMonth}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 tabular-nums text-slate-600">
                    {m.dueDate}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums">
                    R$ {m.baseAmount.toFixed(2)}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums">
                    {m.discountPercent}%
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums text-slate-600">
                    R$ {discAmount.toFixed(2)}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums">
                    R$ {displayLiquid.toFixed(2)}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums">{late}</td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums">
                    R$ {fees.fine.toFixed(2)}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right tabular-nums">
                    R$ {fees.interest.toFixed(2)}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-right font-medium tabular-nums text-slate-900">
                    {m.status === 'cancelado' ? '—' : `R$ ${fees.total.toFixed(2)}`}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3 text-xs font-medium text-slate-700">
                    {m.status === 'cancelado'
                      ? 'Cancelada'
                      : m.paidAt
                        ? 'Paga'
                        : 'Pendente'}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-3">
                    {m.status === 'cancelado' ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : m.paidAt ? (
                      <div className="flex min-w-[140px] flex-col gap-1.5">
                        <span className="text-xs text-slate-500">Quitada em {m.paidAt}</span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="w-fit rounded-md border border-[#003366] bg-white px-2.5 py-1.5 text-xs font-medium text-[#003366] hover:bg-slate-50"
                            onClick={() => reprintPaymentReceipt(m)}
                          >
                            Reimprimir recibo
                          </button>
                          <button
                            type="button"
                            className="w-fit rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                            onClick={() => setEditModalRow(m)}
                          >
                            Reabrir parcela
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md bg-[#003366] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#00264d]"
                        onClick={() => setPayModalRow(m)}
                      >
                        Efetuar pagamento
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <FormActions
        saveLabel="Salvar"
        savingLabel="Salvando..."
        cancelLabel="Cancelar"
        isSaving={isSaving}
        onCancel={() => {
          setPaymentDate(new Date().toISOString().slice(0, 10))
          setFieldErrors({})
          setFormError(null)
          navigate('/financeiro', { replace: true })
        }}
        onSave={async () => {
          const nextErrs: Record<string, string> = {}
          setFormError(null)
          if (!paymentDate) nextErrs.paymentDate = 'Informe a data de pagamento.'
          setFieldErrors(nextErrs)
          if (Object.keys(nextErrs).length > 0) {
            const msg = 'Formulário inválido. Revise os campos destacados em vermelho.'
            setFormError(msg)
            window.alert(msg)
            return
          }
          try {
            setIsSaving(true)
            navigate('/financeiro', { replace: true })
          } catch {
            const msg = 'Erro ao salvar. Verifique sua conexão ou os campos obrigatórios'
            setFormError(msg)
            window.alert(msg)
          } finally {
            setIsSaving(false)
          }
        }}
      />
    </div>
  )
}
