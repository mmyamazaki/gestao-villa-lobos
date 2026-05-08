import { useMemo, useState } from 'react'
import { applyDiscount, daysLateAfterDueDate, lateFeesOnGross } from '../domain/finance'
import type { MensalidadeRegistrada } from '../domain/types'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

type Props = {
  open: boolean
  m: MensalidadeRegistrada | null
  paymentDate: string
  onClose: () => void
  onConfirm: (payload: {
    paidDate: string
    manualFine: number
    manualInterest: number
    adjustmentNotes?: string
    liquidAmount?: number
  }) => void | Promise<void>
}

function PaymentMensalidadeModalForm({
  m,
  paymentDate,
  onClose,
  onConfirm,
}: Omit<Props, 'open'>) {
  const calcReferenceForDate = (dateIso: string) => {
    if (m.waivesLateFees) {
      return {
        liquid: round2(m.baseAmount),
        fine: 0,
        interest: 0,
      }
    }
    const due = new Date(m.dueDate + 'T12:00:00')
    const pay = new Date(dateIso.slice(0, 10) + 'T12:00:00')
    const late = daysLateAfterDueDate(pay, due)
    if (late <= 0) {
      return {
        liquid: round2(applyDiscount(m.baseAmount, m.discountPercent)),
        fine: 0,
        interest: 0,
      }
    }
    const auto = lateFeesOnGross(m.baseAmount, late)
    return {
      liquid: round2(m.baseAmount),
      fine: round2(auto.fine),
      interest: round2(auto.interest),
    }
  }

  const [selectedPaymentDate, setSelectedPaymentDate] = useState(paymentDate.slice(0, 10))

  const system = useMemo(() => {
    if (m.waivesLateFees) return { fine: 0, interest: 0, late: 0, isLate: false }
    const due = new Date(m.dueDate + 'T12:00:00')
    const pay = new Date(selectedPaymentDate + 'T12:00:00')
    const late = daysLateAfterDueDate(pay, due)
    if (late <= 0) return { fine: 0, interest: 0, late: 0, isLate: false }
    const f = lateFeesOnGross(m.baseAmount, late)
    return { fine: f.fine, interest: f.interest, late, isLate: true }
  }, [m, selectedPaymentDate])

  const defaultFine = useMemo(() => {
    if (m.waivesLateFees) return 0
    return system.isLate ? round2(system.fine) : 0
  }, [m.waivesLateFees, system.isLate, system.fine])

  const defaultInterest = useMemo(() => {
    if (m.waivesLateFees) return 0
    return system.isLate ? round2(system.interest) : 0
  }, [m.waivesLateFees, system.isLate, system.interest])

  /** Até ao vencimento: líquido contratual (desconto %). Após: bruto (multa/juros sobre base). */
  const defaultLiquid = useMemo(() => {
    if (m.waivesLateFees) return round2(m.baseAmount)
    const due = new Date(m.dueDate + 'T12:00:00')
    const pay = new Date(selectedPaymentDate + 'T12:00:00')
    if (daysLateAfterDueDate(pay, due) <= 0) {
      return round2(applyDiscount(m.baseAmount, m.discountPercent))
    }
    return round2(m.baseAmount)
  }, [m.baseAmount, m.dueDate, m.discountPercent, m.waivesLateFees, selectedPaymentDate])
  const liquidEditable = true

  const [liquidStr, setLiquidStr] = useState(() => defaultLiquid.toFixed(2))
  const [fineStr, setFineStr] = useState(() => (m.waivesLateFees ? '0.00' : defaultFine.toFixed(2)))
  const [interestStr, setInterestStr] = useState(() =>
    m.waivesLateFees ? '0.00' : defaultInterest.toFixed(2),
  )
  const [notes, setNotes] = useState('')
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const fine = round2(parseFloat(fineStr.replace(',', '.')) || 0)
  const interest = round2(parseFloat(interestStr.replace(',', '.')) || 0)
  const liquidEff = liquidEditable
    ? round2(parseFloat(liquidStr.replace(',', '.')) || 0)
    : round2(m.liquidAmount)

  /** Total sempre considera líquido efetivo + multa + juros (quando aplicável). */
  const total = useMemo(() => {
    if (m.waivesLateFees) return liquidEff
    return round2(liquidEff + fine + interest)
  }, [
    m.waivesLateFees,
    liquidEff,
    fine,
    interest,
  ])

  const liquidChanged = liquidEditable && round2(liquidEff) !== round2(defaultLiquid)
  const needsNote =
    (!m.waivesLateFees &&
      (round2(fine) !== defaultFine || round2(interest) !== defaultInterest)) ||
    liquidChanged

  const handleConfirm = async () => {
    setSubmitErr(null)
    if (!selectedPaymentDate) {
      setSubmitErr('Informe a data de pagamento deste lançamento.')
      return
    }
    if (needsNote && !notes.trim()) {
      setSubmitErr(
        'Descreva o motivo do ajuste (valor líquido, multa ou juros) em “Observações”.',
      )
      return
    }
    if (fine < 0 || interest < 0) {
      setSubmitErr('Multa e juros não podem ser negativos.')
      return
    }
    if (liquidEditable) {
      if (liquidEff < 0 || liquidEff > round2(m.baseAmount) + 1e-9) {
        setSubmitErr('Valor líquido deve estar entre 0 e o bruto da parcela.')
        return
      }
    }
    try {
      await onConfirm({
        paidDate: selectedPaymentDate,
        manualFine: fine,
        manualInterest: interest,
        adjustmentNotes: notes.trim() || undefined,
        liquidAmount: liquidEff,
      })
      onClose()
    } catch {
      setSubmitErr('Não foi possível concluir. Tente novamente.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="payment-modal-title" className="text-base font-semibold text-slate-900">
            Efetuar pagamento
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {m.studentNome} · {m.courseLabel} · Parcela {m.parcelNumber}/12
          </p>
        </div>

        <div className="space-y-4 px-4 py-4 text-sm">
          {submitErr && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
              {submitErr}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
            <p>
              Vencimento: <span className="font-medium tabular-nums">{m.dueDate}</span>
            </p>
            <p>
              Pagamento (referência):{' '}
              <span className="font-medium tabular-nums">{selectedPaymentDate}</span>
            </p>
            <p>
              Bruto:{' '}
              <span className="font-medium tabular-nums">R$ {m.baseAmount.toFixed(2)}</span>
            </p>
            {m.waivesLateFees ? (
              <p className="col-span-2">
                1ª parcela: sem multa/juros no cadastro. Ajuste o <strong>valor líquido</strong> abaixo
                para desconto extra, se houver.
              </p>
            ) : system.isLate ? (
              <p className="col-span-2">
                Atraso: <span className="font-semibold">{system.late}</span> dia(s). Você pode ajustar o{' '}
                <strong>valor líquido</strong> (desconto/acordo) e também editar multa/juros.
              </p>
            ) : (
              <p className="col-span-2">
                Em dia: informe o <strong>valor líquido</strong> da baixa (pode ser menor que o padrão
                para desconto extra) e, se precisar, multa/juros excepcionais.
              </p>
            )}
          </div>

          <label className="block text-xs font-medium text-slate-700">
            Data de pagamento deste lançamento
            <input
              type="date"
              value={selectedPaymentDate}
              onChange={(e) => {
                const nextDate = e.target.value
                setSelectedPaymentDate(nextDate)
                const ref = calcReferenceForDate(nextDate)
                setLiquidStr(ref.liquid.toFixed(2))
                setFineStr(ref.fine.toFixed(2))
                setInterestStr(ref.interest.toFixed(2))
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
            />
            <span className="mt-0.5 block text-[10px] text-slate-500">
              Esta data será usada para salvar a baixa e calcular atraso/multa/juros.
            </span>
          </label>

          <label className="block text-xs font-medium text-slate-700">
            Valor líquido desta baixa (R$)
            <input
              type="number"
              min={0}
              max={m.baseAmount}
              step={0.01}
              value={liquidStr}
              onChange={(e) => setLiquidStr(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
            />
            <span className="mt-0.5 block text-[10px] text-slate-500">
              Valor de referência (contrato): R$ {round2(defaultLiquid).toFixed(2)} · teto: bruto R${' '}
              {m.baseAmount.toFixed(2)}
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-700">
              Multa (R$)
              <input
                type="number"
                min={0}
                step={0.01}
                disabled={m.waivesLateFees}
                value={fineStr}
                onChange={(e) => setFineStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              {!m.waivesLateFees && system.isLate && (
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  Calculado (referência): R$ {round2(system.fine).toFixed(2)}
                </span>
              )}
            </label>
            <label className="text-xs font-medium text-slate-700">
              Juros (R$)
              <input
                type="number"
                min={0}
                step={0.01}
                disabled={m.waivesLateFees}
                value={interestStr}
                onChange={(e) => setInterestStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              {!m.waivesLateFees && system.isLate && (
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  Calculado (referência): R$ {round2(system.interest).toFixed(2)}
                </span>
              )}
            </label>
          </div>

          <div className="rounded-lg border border-[#003366]/20 bg-[#003366]/5 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#003366]">
              Total a pagar
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              R$ {total.toFixed(2)}
            </p>
            {m.waivesLateFees && (
              <p className="mt-1 text-[11px] text-slate-600">
                = valor líquido da baixa (R$ {liquidEff.toFixed(2)})
              </p>
            )}
            {!m.waivesLateFees && system.isLate && (
              <p className="mt-1 text-[11px] text-slate-600">
                = bruto (R$ {m.baseAmount.toFixed(2)}) + multa + juros
              </p>
            )}
            {!m.waivesLateFees && !system.isLate && (fine > 0 || interest > 0) && (
              <p className="mt-1 text-[11px] text-slate-600">
                = líquido (R$ {liquidEff.toFixed(2)}) + multa + juros
              </p>
            )}
          </div>

          <label className="block text-xs font-semibold text-slate-800">
            Observações{' '}
            {needsNote ? (
              <span className="font-bold text-amber-900">
                (obrigatório se alterar líquido, multa ou juros em relação ao padrão)
              </span>
            ) : (
              <span className="font-normal text-slate-600">(opcional — desconto extra, acordo, etc.)</span>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 ${
                needsNote && !notes.trim()
                  ? 'border-amber-300 bg-amber-50/50 ring-amber-500/30 focus:border-amber-500'
                  : 'border-slate-200 bg-white ring-emerald-500/30 focus:border-emerald-600'
              }`}
              placeholder="Ex.: Isenção parcial de multa acordada; desconto promocional extra…"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#00264d]"
              onClick={() => void handleConfirm()}
            >
              Confirmar pagamento e gerar recibo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PaymentMensalidadeModal({ open, m, paymentDate, onClose, onConfirm }: Props) {
  if (!open || !m) return null
  return (
    <PaymentMensalidadeModalForm
      key={`${m.id}-${paymentDate}`}
      m={m}
      paymentDate={paymentDate}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
