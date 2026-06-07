import type { MensalidadeRegistrada, Student } from './types'

export function mensalidadeCycle(m: MensalidadeRegistrada): number {
  return m.cycle ?? 1
}

const fmtYm = (ym: string) => {
  const [y, m] = ym.split('-')
  return y && m ? `${m}/${y}` : ym
}

export interface CycleInfo {
  cycle: number
  label: string
  isCurrent: boolean
  courseLabel: string
  periodLabel: string
  openCount: number
}

/** Ciclo vigente: o da matrícula atual ou o maior ciclo existente nas parcelas. */
export function currentEnrollmentCycle(
  student: Student | undefined | null,
  mensalidades: MensalidadeRegistrada[],
): number {
  if (student?.enrollment?.cycle) return student.enrollment.cycle
  const rows = student ? mensalidades.filter((m) => m.studentId === student.id) : []
  if (!rows.length) return 1
  return Math.max(...rows.map(mensalidadeCycle))
}

export function listStudentCycles(
  mensalidades: MensalidadeRegistrada[],
  studentId: string,
  currentCycle: number,
): CycleInfo[] {
  const byCycle = new Map<number, MensalidadeRegistrada[]>()
  for (const m of mensalidades) {
    if (m.studentId !== studentId) continue
    const c = mensalidadeCycle(m)
    const list = byCycle.get(c) ?? []
    list.push(m)
    byCycle.set(c, list)
  }

  return [...byCycle.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([cycle, parcels]) => {
      parcels.sort((a, b) => a.parcelNumber - b.parcelNumber)
      const first = parcels[0]
      const last = parcels[parcels.length - 1]
      const startYm = first?.referenceMonth ?? ''
      const endYm = last?.referenceMonth ?? ''
      const periodLabel =
        startYm && endYm ? `${fmtYm(startYm)} — ${fmtYm(endYm)}` : startYm ? fmtYm(startYm) : ''
      const courseLabel = first?.courseLabel ?? '—'
      const openCount = parcels.filter((m) => m.status !== 'cancelado' && !m.paidAt).length
      const year = startYm.slice(0, 4) || '—'
      const label =
        cycle === currentCycle ? `Contrato atual (${year})` : `Contrato ${cycle} (${year})`
      return { cycle, label, isCurrent: cycle === currentCycle, courseLabel, periodLabel, openCount }
    })
}

/** Parcelas em aberto de contratos anteriores (dívida pendente após rematrícula). */
export function openParcelsInOtherCycles(
  mensalidades: MensalidadeRegistrada[],
  studentId: string,
  currentCycle: number,
): MensalidadeRegistrada[] {
  return mensalidades
    .filter((m) => m.studentId === studentId)
    .filter((m) => mensalidadeCycle(m) !== currentCycle)
    .filter((m) => m.status !== 'cancelado' && !m.paidAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
