import { useMemo, useState } from 'react'
import { daysLateAfterDueDate, lateFeesOnGross } from '../domain/finance'
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
    manualFine: number
    manualInterest: number
    adjustmentNotes?: string
  }) => void | Promise<void>
}

function PaymentMensalidadeModalForm({
  m,
  paymentDate,
  onClose,
  onConfirm,
}: Omit<Props, 'open'>) {
  const system = useMemo(() => {
    if (m.waivesLateFees) return { fine: 0, interest: 0, late: 0, isLate: false }
    const due = new Date(m.dueDate + 'T12:00:00')
    const pay = new Date(paymentDate + 'T12:00:00')
    const late = daysLateAfterDueDate(pay, due)
    if (late <= 0) return { fine: 0, interest: 0, late: 0, isLate: false }
    const f = lateFeesOnGross(m.baseAmount, late)
    return { fine: f.fine, interest: f.interest, late, isLate: true }
  }, [m, paymentDate])

  const defaultFine = useMemo(() => {
    if (m.waivesLateFees) return 0
    return system.isLate ? round2(system.fine) : 0
  }, [m.waivesLateFees, system.isLate, system.fine])

  const defaultInterest = useMemo(() => {
    if (m.waivesLateFees) return 0
    return system.isLate ? round2(system.interest) : 0
  }, [m.waivesLateFees, system.isLate, system.interest])

  const [fineStr, setFineStr] = useState(() =>
    m.waivesLateFees ? '0.00' : defaultFine.toFixed(2),
  )
  const [interestStr, setInterestStr] = useState(() =>
    m.waivesLateFees ? '0.00' : defaultInterest.toFixed(2),
  )
  const [notes, setNotes] = useState('')
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  const fine = round2(parseFloat(fineStr.replace(',', '.')) || 0)
  const interest = round2(parseFloat(interestStr.replace(',', '.')) || 0)

  /** Em atraso: encargos sobre o bruto. Em dia: líquido + encargos manuais (exceções / acertos). */
  const total = useMemo(() => {
    if (m.waivesLateFees) return m.liquidAmount
    if (system.isLate) return round2(m.baseAmount + fine + interest)
    return round2(m.liquidAmount + fine + interest)
  }, [m.liquidAmount, m.baseAmount, m.waivesLateFees, system.isLate, fine, interest])

  const needsNote =
    !m.waivesLateFees &&
    (round2(fine) !== defaultFine || round2(interest) !== defaultInterest)

  const handleConfirm = async () => {
    setSubmitErr(null)
    if (needsNote && !notes.trim()) {
      setSubmitErr('Descreva o motivo da alteração em multa/juros em “Observações da alteração”.')
      return
    }
    if (fine < 0 || interest < 0) {
      setSubmitErr('Multa e juros não podem ser negativos.')
      return
    }
    try {
      await onConfirm({
        manualFine: fine,
        manualInterest: interest,
        adjustmentNotes: notes.trim() || undefined,
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
              <span className="font-medium tabular-nums">{paymentDate}</span>
            </p>
            <p>
              Bruto:{' '}
              <span className="font-medium tabular-nums">R$ {m.baseAmount.toFixed(2)}</span>
            </p>
            <p>
              Líquido (parcela):{' '}
              <span className="font-medium tabular-nums">R$ {m.liquidAmount.toFixed(2)}</span>
            </p>
            {system.isLate ? (
              <p className="col-span-2">
                Atraso: <span className="font-semibold">{system.late}</span> dia(s) — por padrão multa/juros
                sobre o <strong>valor bruto</strong>; pode alterar abaixo e registrar o motivo em observações.
              </p>
            ) : (
              <p className="col-span-2">
                Sem atraso: total padrão é o <strong>líquido</strong>. Multa/juros podem ser usados em casos
                excepcionais (acréscimo ou ajuste) — descreva em observações.
              </p>
            )}
          </div>

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
            {!m.waivesLateFees && system.isLate && (
              <p className="mt-1 text-[11px] text-slate-600">
                = bruto (R$ {m.baseAmount.toFixed(2)}) + multa + juros
              </p>
            )}
            {!m.waivesLateFees && !system.isLate && (fine > 0 || interest > 0) && (
              <p className="mt-1 text-[11px] text-slate-600">
                = líquido (R$ {m.liquidAmount.toFixed(2)}) + multa + juros
              </p>
            )}
          </div>

          <label className="block text-xs font-semibold text-slate-800">
            Observações{' '}
            {needsNote ? (
              <span className="font-bold text-amber-900">(obrigatório se multa/juros ≠ calculado/padrão)</span>
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
