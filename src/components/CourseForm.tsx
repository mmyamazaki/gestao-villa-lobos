/**
 * Edição de um curso no contexto de um instrumento: ajuste do nível atual, nome do instrumento,
 * mensalidade; opcionalmente novos níveis no mesmo instrumento. O Salvar envia PUT com lista completa.
 */
import { useEffect, useState } from 'react'
import type { Course } from '../domain/types'

const inputClass =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25'
const inputReadOnlyClass =
  'w-full cursor-not-allowed rounded-lg border-2 border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-700 tabular-nums outline-none'
const labelClass = 'text-sm font-semibold text-[#003366]'

export type CourseFormProps = {
  open: boolean
  course: Course | null
  /** Se true, o valor da mensalidade não pode ser alterado (há alunos neste courseId). */
  lockMonthlyPrice: boolean
  onClose: () => void
  /** Persiste o catálogo completo (inclui níveis adicionados no modal). */
  onSubmit: (payload: { instrumentLabel: string; levelLabel: string; monthlyPrice: number }) => Promise<void>
  /** Inclui um novo nível no mesmo instrumento (atualiza draft no pai; não fecha o modal). */
  onAddLevel?: (payload: {
    levelLabel: string
    monthlyPrice: number
    instrumentLabel: string
  }) => void
}

export function CourseForm({ open, course, lockMonthlyPrice, onClose, onSubmit, onAddLevel }: CourseFormProps) {
  const [instrumentLabel, setInstrumentLabel] = useState('')
  const [levelLabel, setLevelLabel] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [addLevelLabel, setAddLevelLabel] = useState('')
  const [addMonthlyPrice, setAddMonthlyPrice] = useState(380)
  const [showAddLevelBlock, setShowAddLevelBlock] = useState(false)

  useEffect(() => {
    if (!open || !course) return
    setInstrumentLabel(course.instrumentLabel)
    setLevelLabel(course.levelLabel)
    setMonthlyPrice(course.monthlyPrice)
    setAddLevelLabel('')
    setAddMonthlyPrice(380)
    setShowAddLevelBlock(false)
  }, [open, course])

  if (!open || !course) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = instrumentLabel.trim()
    if (!label) {
      window.alert('Informe o nome do curso.')
      return
    }
    const level = levelLabel.trim()
    if (!level) {
      window.alert('Informe o nível / ano.')
      return
    }
    const price = lockMonthlyPrice ? course.monthlyPrice : monthlyPrice
    if (!lockMonthlyPrice && (Number.isNaN(price) || price < 0)) {
      window.alert('Informe um valor de mensalidade válido.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({ instrumentLabel: label, levelLabel: level, monthlyPrice: price })
      onClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert('Erro ao salvar: ' + message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddLevel = () => {
    if (!onAddLevel) return
    const lvl = addLevelLabel.trim()
    if (!lvl) {
      window.alert('Informe o nível / ano do novo estágio.')
      return
    }
    const price = addMonthlyPrice
    if (Number.isNaN(price) || price < 0) {
      window.alert('Informe uma mensalidade válida.')
      return
    }
    onAddLevel({
      levelLabel: lvl,
      monthlyPrice: price,
      instrumentLabel: instrumentLabel.trim() || course.instrumentLabel,
    })
    setAddLevelLabel('')
    setAddMonthlyPrice(380)
    setShowAddLevelBlock(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="editar-curso-titulo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="editar-curso-titulo" className="text-lg font-semibold text-[#003366]">
          Editar curso
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Ajuste o nome do instrumento, o nível desta linha e a mensalidade. Você pode incluir novos
          níveis no mesmo instrumento antes de salvar.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className={labelClass}>Nome do curso (instrumento)</span>
            <input
              type="text"
              className={`${inputClass} mt-1.5`}
              value={instrumentLabel}
              onChange={(e) => setInstrumentLabel(e.target.value)}
              placeholder="Nome exibido nas telas"
              autoFocus
            />
          </label>

          <label className="block">
            <span className={labelClass}>Nível / Ano (esta linha)</span>
            <input
              type="text"
              className={`${inputClass} mt-1.5`}
              value={levelLabel}
              onChange={(e) => setLevelLabel(e.target.value)}
              placeholder='Ex.: Pré, 1º ano, 4º/5º ano…'
            />
          </label>

          <div>
            <label className="block">
              <span className={labelClass}>Valor da mensalidade (R$) — esta linha</span>
              <input
                type="number"
                min={0}
                step={1}
                className={lockMonthlyPrice ? `${inputReadOnlyClass} mt-1.5` : `${inputClass} mt-1.5 tabular-nums`}
                value={lockMonthlyPrice ? course.monthlyPrice : monthlyPrice}
                onChange={(e) => setMonthlyPrice(Number.parseFloat(e.target.value) || 0)}
                readOnly={lockMonthlyPrice}
                disabled={lockMonthlyPrice}
                aria-readonly={lockMonthlyPrice}
              />
            </label>
            {lockMonthlyPrice && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Não é possível alterar o valor desta linha pois existem alunos matriculados. Novos níveis
                podem ter valores livres.
              </p>
            )}
          </div>

          {onAddLevel && (
            <div className="space-y-3">
              {!showAddLevelBlock ? (
                <button
                  type="button"
                  onClick={() => setShowAddLevelBlock(true)}
                  className="text-sm font-medium text-[#00AEEF] hover:underline"
                >
                  + Adicionar nível/estágio
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className={`${labelClass} mb-3`}>Novo nível no mesmo instrumento</p>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">Nível / Ano</span>
                      <input
                        type="text"
                        className={`${inputClass} mt-1`}
                        value={addLevelLabel}
                        onChange={(e) => setAddLevelLabel(e.target.value)}
                        placeholder="Ex.: 4º estágio"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">Mensalidade (R$)</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={`${inputClass} mt-1 tabular-nums`}
                        value={addMonthlyPrice}
                        onChange={(e) =>
                          setAddMonthlyPrice(Number.parseFloat(e.target.value) || 0)
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleAddLevel}
                        className="rounded-lg bg-[#003366] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00264d]"
                      >
                        Incluir nível
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddLevelBlock(false)
                          setAddLevelLabel('')
                          setAddMonthlyPrice(380)
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
