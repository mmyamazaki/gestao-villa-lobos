import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  teacherNome: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Modal em `document.body` para não ser cortado por `overflow` de ancestrais e ficar acima do header.
 * Só deve abrir quando não há alunos matriculados com este professor (a UI valida antes).
 */
export function DeleteTeacherDialog({
  open,
  teacherNome,
  isDeleting,
  onCancel,
  onConfirm,
}: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-teacher-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="delete-teacher-title" className="text-lg font-semibold text-slate-900">
          Excluir professor
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Excluir <strong>{teacherNome}</strong>? O cadastro e a grade de horários serão removidos. Só é
          possível chegar aqui se nenhum aluno estiver matriculado com este professor.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Excluindo…' : 'Excluir professor'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
