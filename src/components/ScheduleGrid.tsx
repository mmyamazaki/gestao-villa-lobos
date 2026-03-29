import { useMemo } from 'react'
import {
  DAY_COUNT,
  DAY_LABELS,
  MORNING_SLOT_COUNT,
  allSlotLabels,
  canStart60MinuteLesson,
  parseSlotKey,
  slotKey,
  sortSlotKeys,
} from '../domain/schedule'
import type { ScheduleMap, SlotState } from '../domain/types'

type Props = {
  schedule: ScheduleMap
  mode: 'edit' | 'pick'
  /** modo pick: livre ou ocupado pelo mesmo aluno pode ser selecionado */
  pickingStudentId?: string
  /**
   * Pares de chaves de slots consecutivos (mesmo dia) para exibir como um único bloco de 60 min
   * (nome centralizado, altura 2 linhas, sem divisória visual entre os 30 min).
   */
  mergeSlotKeys?: string[][]
  /** Ocupações transitórias não recorrentes (ex.: reposições semanais). */
  transientByKey?: Record<
    string,
    { studentName: string; instrumentLabel?: string; replacement?: boolean }
  >
  onToggle?: (
    key: string,
    cell: SlotState,
    meta: { dayIndex: number; slotIndex: number },
  ) => void
}

/** Cores base da grade — indisponível: vermelho vivo (bloqueio) */
function cellClasses(cell: SlotState, mode: Props['mode']) {
  if (cell.status === 'busy') {
    return 'bg-indigo-300 ring-1 ring-indigo-500'
  }
  if (cell.status === 'unavailable') {
    return 'bg-red-500 ring-1 ring-red-600'
  }
  return mode === 'pick'
    ? 'bg-emerald-300 text-emerald-950 ring-1 ring-emerald-500 hover:bg-emerald-400'
    : 'bg-emerald-300 text-emerald-950 ring-1 ring-emerald-500 hover:bg-emerald-200'
}

function buildMergeMaps(pairs: string[][] | undefined) {
  const rowspan = new Map<string, number>()
  const skip = new Set<string>()
  for (const pair of pairs ?? []) {
    if (pair.length !== 2) continue
    const [k0, k1] = sortSlotKeys(pair)
    const p0 = parseSlotKey(k0)
    const p1 = parseSlotKey(k1)
    if (!p0 || !p1) continue
    if (p0.dayIndex !== p1.dayIndex) continue
    if (p1.slotIndex !== p0.slotIndex + 1) continue
    if (!canStart60MinuteLesson(p0.slotIndex)) continue
    rowspan.set(k0, 2)
    skip.add(k1)
  }
  return { rowspan, skip }
}

export function ScheduleLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-emerald-300 ring-1 ring-emerald-500" />
        Livre
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-red-500 ring-1 ring-red-600" />
        Indisponível
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-indigo-300 ring-1 ring-indigo-500" />
        Ocupado (aluno)
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-3 w-6 rounded bg-violet-300 ring-1 ring-violet-500" />
        Reposição (data específica)
      </span>
    </div>
  )
}

export function ScheduleGrid({
  schedule,
  mode,
  pickingStudentId,
  mergeSlotKeys,
  transientByKey,
  onToggle,
}: Props) {
  const labels = allSlotLabels()
  const { rowspan, skip } = useMemo(() => buildMergeMaps(mergeSlotKeys), [mergeSlotKeys])

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm">
      {/*
        overflow-auto neste bloco: sticky em thead funciona ao rolar a grade (o scroll horizontal
        + vertical compartilham o mesmo container; dias da semana permanecem no topo).
      */}
      <div className="relative max-h-[min(75vh,52rem)] overflow-auto">
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full min-h-full w-5 bg-gradient-to-l from-white to-transparent md:hidden" />
        <table className="min-w-[900px] w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="sticky left-0 top-0 z-40 min-w-[92px] bg-white px-2 py-2 font-semibold text-slate-600 shadow-[0_1px_0_0_rgb(226,232,240)]">
                Horário
              </th>
              {Array.from({ length: DAY_COUNT }, (_, d) => (
                <th
                  key={DAY_LABELS[d]}
                  className="sticky top-0 z-30 min-w-[120px] bg-white px-1 py-2 text-center font-semibold text-slate-600 shadow-[0_1px_0_0_rgb(226,232,240)]"
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
              <td className="sticky left-0 z-20 whitespace-nowrap bg-white px-2 py-1 font-medium text-slate-700 shadow-[1px_0_0_0_rgb(241,245,249)]">
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
                if (skip.has(key)) {
                  return null
                }
                const cell = schedule[key] ?? { status: 'free' as const }
                const transient = transientByKey?.[key]
                const displayCell: SlotState =
                  transient && cell.status === 'free'
                    ? {
                        status: 'busy',
                        studentId: '__replacement__',
                        studentName: transient.studentName,
                        instrumentLabel: transient.instrumentLabel,
                      }
                    : cell
                const clickable =
                  mode === 'edit'
                    ? true
                    : displayCell.status === 'free' ||
                      (displayCell.status === 'busy' && displayCell.studentId === pickingStudentId)
                /** Não escurecer células ocupadas só por estar disabled (outro aluno): mantém nome legível */
                const dimDisabledSlot =
                  !clickable && displayCell.status !== 'busy' && displayCell.status !== 'unavailable'
                const rs = rowspan.get(key) ?? 1
                const tall = rs > 1

                return (
                  <td key={key} rowSpan={rs} className="p-0.5 align-top">
                    <button
                      type="button"
                      disabled={!clickable || !onToggle}
                      title={
                        displayCell.status === 'busy'
                          ? displayCell.studentName
                          : displayCell.status === 'unavailable'
                            ? 'Indisponível'
                            : 'Livre'
                      }
                      onClick={() => onToggle?.(key, displayCell, { dayIndex, slotIndex })}
                      className={[
                        tall
                          ? 'flex min-h-[5.5rem] w-full flex-col items-center justify-center rounded-md px-1 text-center transition-colors disabled:cursor-not-allowed'
                          : 'flex min-h-[44px] w-full flex-col items-center justify-center rounded-md px-1 text-center transition-colors disabled:cursor-not-allowed',
                        dimDisabledSlot ? 'disabled:opacity-40' : '',
                        transient
                          ? 'bg-violet-300 ring-1 ring-violet-500'
                          : cellClasses(displayCell, mode),
                      ].join(' ')}
                    >
                      {displayCell.status === 'busy' ? (
                        <span className="flex w-full flex-col items-center justify-center gap-0.5 leading-tight">
                          <span className="block max-w-full text-center text-sm font-bold leading-snug text-black">
                            {displayCell.studentName}
                          </span>
                          {transient ? (
                            <span className="rounded bg-violet-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Reposição
                            </span>
                          ) : displayCell.instrumentLabel ? (
                            <span className="block max-w-full text-center text-[11px] font-bold leading-tight text-black">
                              {displayCell.instrumentLabel}
                            </span>
                          ) : null}
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
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 md:hidden">
        Deslize a grade para o lado para ver todos os dias.
      </p>
    </div>
  )
}
