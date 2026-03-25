type Props = {
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
  cancelLabel?: string
  disabled?: boolean
}

export function FormActions({
  onSave,
  onCancel,
  saveLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  disabled = false,
}: Props) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saveLabel}
      </button>
    </div>
  )
}
