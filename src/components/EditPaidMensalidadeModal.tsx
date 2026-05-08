import { useState } from 'react'
import type { MensalidadeRegistrada } from '../domain/types'

type Props = {
  m: MensalidadeRegistrada | null
  onClose: () => void
  onConfirm: (reason: string) => void | Promise<void>
}

export function EditPaidMensalidadeModal({ m, onClose, onConfirm }: Props) {
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)

  if (!m) return null

  const handleSubmit = async () => {
    setErr(null)
    if (!notes.trim()) {
      setErr('Informe o motivo para reabrir a parcela.')
      return
    }
    await onConfirm(notes.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Reabrir parcela para pagamento</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {m.studentNome} · {m.courseLabel} · Parcela {m.parcelNumber}/12
          </p>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm">
          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{err}</div>}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Esta ação remove a baixa atual e devolve a parcela para <strong>Pendente</strong>, liberando o
            botão <strong>Efetuar pagamento</strong>.
          </p>
          <label className="block text-xs font-semibold text-slate-800">
            Motivo da reabertura (obrigatório)
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 text-sm outline-none ring-amber-500/30 focus:border-amber-500 focus:ring-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: pagamento lançado em aluno errado; reabrir para corrigir."
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void handleSubmit()}
            >
              Reabrir parcela
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
