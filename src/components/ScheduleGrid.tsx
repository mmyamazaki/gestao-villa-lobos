import {
  DAY_COUNT,
  DAY_LABELS,
  MORNING_SLOT_COUNT,
  allSlotLabels,
  slotKey,
} from '../domain/schedule'
import type { ScheduleMap, SlotState } from '../domain/types'

type Props = {
  schedule: ScheduleMap
  mode: 'edit' | 'pick'
  /** modo pick: livre ou ocupado pelo mesmo aluno pode ser selecionado */
  pickingStudentId?: string
  onToggle?: (
    key: string,
    cell: SlotState,
    meta: { dayIndex: number; slotIndex: number },
  ) => void
}

function cellClasses(cell: SlotState, mode: Props['mode']) {
  if (cell.status === 'busy') {
    return 'bg-indigo-100 text-indigo-950 ring-1 ring-indigo-200'
  }
  if (cell.status === 'unavailable') {
    return 'bg-red-600 text-white ring-1 ring-red-700'
  }
  return mode === 'pick'
    ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-200'
    : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-50'
}

export function ScheduleLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-emerald-200 ring-1 ring-emerald-300" />
        Livre
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-red-600 ring-1 ring-red-700" />
        Indisponível
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-indigo-200 ring-1 ring-indigo-300" />
        Ocupado (aluno)
      </span>
    </div>
  )
}

export function ScheduleGrid({ schedule, mode, pickingStudentId, onToggle }: Props) {
  const labels = allSlotLabels()

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[900px] w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 font-semibold text-slate-600">
              Horário
            </th>
            {Array.from({ length: DAY_COUNT }, (_, d) => (
              <th
                key={DAY_LABELS[d]}
                className="px-1 py-2 text-center font-semibold text-slate-600"
              >
                {DAY_LABELS[d].slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, slotIndex) => (
            <tr
              key={label}
              className={
                slotIndex === MORNING_SLOT_COUNT
                  ? 'border-t-2 border-slate-300'
                  : 'border-t border-slate-100'
              }
            >
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 font-medium text-slate-700">
                {label}
                {slotIndex === 0 && (
                  <span className="ml-1 text-[10px] font-normal text-slate-400">(manhã)</span>
                )}
                {slotIndex === MORNING_SLOT_COUNT && (
                  <span className="ml-1 text-[10px] font-normal text-slate-400">(tarde)</span>
                )}
              </td>
              {Array.from({ length: DAY_COUNT }, (_, dayIndex) => {
                const key = slotKey(dayIndex, slotIndex)
                const cell = schedule[key] ?? { status: 'free' as const }
                const clickable =
                  mode === 'edit'
                    ? true
                    : cell.status === 'free' ||
                      (cell.status === 'busy' && cell.studentId === pickingStudentId)

                return (
                  <td key={key} className="p-0.5">
                    <button
                      type="button"
                      disabled={!clickable || !onToggle}
                      title={
                        cell.status === 'busy'
                          ? cell.studentName
                          : cell.status === 'unavailable'
                            ? 'Indisponível'
                            : 'Livre'
                      }
                      onClick={() =>
                        onToggle?.(key, cell, { dayIndex, slotIndex })
                      }
                      className={[
                        'flex h-10 w-full flex-col items-center justify-center rounded-md px-0.5 text-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        cellClasses(cell, mode),
                      ].join(' ')}
                    >
                      {cell.status === 'busy' ? (
                        <span className="line-clamp-2 w-full leading-tight">
                          {cell.studentName}
                        </span>
                      ) : (
                        <span className="text-transparent">.</span>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {mode === 'pick' && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Toque nos horários livres para marcar a aula conforme o modo (1×60 ou 2×30).
        </p>
      )}
    </div>
  )
}
