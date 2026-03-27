type Props = {
  onSave: () => void | Promise<void>
  onCancel: () => void
  saveLabel?: string
  savingLabel?: string
  cancelLabel?: string
  disabled?: boolean
  isSaving?: boolean
}

export function FormActions({
  onSave,
  onCancel,
  saveLabel = 'Salvar',
  savingLabel = 'Salvando...',
  cancelLabel = 'Cancelar',
  disabled = false,
  isSaving = false,
}: Props) {
  const block = disabled || isSaving
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:flex-wrap sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={block}
        className="min-h-[44px] rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? savingLabel : saveLabel}
      </button>
    </div>
  )
}
