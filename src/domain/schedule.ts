import { shouldStudentOccupyScheduleSlot } from './studentStatus'
import type { LessonMode, Student } from './types'

export const DAY_LABELS = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const DAY_COUNT = DAY_LABELS.length

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

/** 08:00–12:00 em blocos de 30min (8 intervalos) */
export function morningSlotLabels(): string[] {
  const r: string[] = []
  for (let h = 8; h <= 10; h++) {
    r.push(`${pad2(h)}:00`, `${pad2(h)}:30`)
  }
  r.push('11:00', '11:30')
  return r
}

/** 14:00–20:00 em blocos de 30min (12 intervalos) */
export function afternoonSlotLabels(): string[] {
  const r: string[] = []
  for (let h = 14; h <= 19; h++) {
    r.push(`${pad2(h)}:00`, `${pad2(h)}:30`)
  }
  return r
}

export function allSlotLabels(): string[] {
  return [...morningSlotLabels(), ...afternoonSlotLabels()]
}

export const MORNING_SLOT_COUNT = morningSlotLabels().length

export const SLOT_COUNT = allSlotLabels().length

/** Duas janelas de 30min consecutivas no mesmo período (manhã ou tarde) para 1x60min */
export function canStart60MinuteLesson(slotIndex: number) {
  const next = slotIndex + 1
  if (next >= SLOT_COUNT) return false
  const morning = slotIndex < MORNING_SLOT_COUNT && next < MORNING_SLOT_COUNT
  const afternoon =
    slotIndex >= MORNING_SLOT_COUNT && next >= MORNING_SLOT_COUNT
  return morning || afternoon
}

export function slotKey(dayIndex: number, slotIndex: number) {
  return `${dayIndex}-${slotIndex}`
}

export function parseSlotKey(key: string): { dayIndex: number; slotIndex: number } | null {
  const [d, s] = key.split('-')
  const dayIndex = Number(d)
  const slotIndex = Number(s)
  if (
    Number.isNaN(dayIndex) ||
    Number.isNaN(slotIndex) ||
    dayIndex < 0 ||
    dayIndex >= DAY_COUNT
  ) {
    return null
  }
  return { dayIndex, slotIndex }
}

export function formatSlotKeyLabel(key: string) {
  const p = parseSlotKey(key)
  if (!p) return key
  const labels = allSlotLabels()
  const t = labels[p.slotIndex] ?? '?'
  const day = DAY_LABELS[p.dayIndex] ?? '?'
  return `${day} · ${t}`
}

/** Ordena chaves de grade por dia e índice de slot (não usar sort() lexicográfico em strings). */
export function compareSlotKeys(a: string, b: string): number {
  const pa = parseSlotKey(a)
  const pb = parseSlotKey(b)
  if (!pa || !pb) return a.localeCompare(b)
  if (pa.dayIndex !== pb.dayIndex) return pa.dayIndex - pb.dayIndex
  return pa.slotIndex - pb.slotIndex
}

export function sortSlotKeys(keys: string[]): string[] {
  return [...keys].sort(compareSlotKeys)
}

export function createEmptySchedule(): Record<string, { status: 'free' }> {
  const map: Record<string, { status: 'free' }> = {}
  for (let d = 0; d < DAY_COUNT; d++) {
    for (let s = 0; s < SLOT_COUNT; s++) {
      map[slotKey(d, s)] = { status: 'free' }
    }
  }
  return map
}

export function consecutiveKeysSameDay(dayIndex: number, slotIndex: number) {
  return [slotKey(dayIndex, slotIndex), slotKey(dayIndex, slotIndex + 1)]
}

/** Duas chaves formam um bloco válido de 1×60 min (mesmo dia, slots consecutivos). */
export function parse60MinuteBlockFromKeys(keys: string[]): {
  dayIndex: number
  slotIndex: number
} | null {
  if (keys.length !== 2) return null
  const pa = parseSlotKey(keys[0]!)
  const pb = parseSlotKey(keys[1]!)
  if (!pa || !pb) return null
  if (pa.dayIndex !== pb.dayIndex) return null
  const lo = pa.slotIndex < pb.slotIndex ? pa : pb
  const hi = pa.slotIndex < pb.slotIndex ? pb : pa
  if (hi.slotIndex !== lo.slotIndex + 1) return null
  if (!canStart60MinuteLesson(lo.slotIndex)) return null
  return { dayIndex: lo.dayIndex, slotIndex: lo.slotIndex }
}

/** Índices de início válidos para 1×60 min (manhã ou tarde, bloco inteiro no mesmo período). */
export function valid60MinuteStartSlotIndices(): number[] {
  const r: number[] = []
  for (let s = 0; s < SLOT_COUNT - 1; s++) {
    if (canStart60MinuteLesson(s)) r.push(s)
  }
  return r
}

/** Chave canônica para registro pedagógico: no 1×60 min usa sempre o primeiro bloco de 30 min do par. */
export function canonicalLessonLogSlotKey(
  lessonMode: LessonMode | undefined,
  enrollmentSlotKeys: string[],
  slotKey: string,
): string {
  if (lessonMode !== '60x1') return slotKey
  const sorted = sortSlotKeys(enrollmentSlotKeys)
  if (sorted.length !== 2) return slotKey
  const [k0, k1] = sorted
  if (slotKey === k0 || slotKey === k1) return k0
  return slotKey
}

/** Rótulo único para aula de 60 min (um evento), ex.: "Segunda · 08:00–09:00 · Aula de 60 min". */
export function formatSixtyMinuteLessonLabel(slotKeys: string[]): string {
  const sorted = sortSlotKeys(slotKeys)
  if (sorted.length !== 2) {
    return sorted[0] ? formatSlotKeyLabel(sorted[0]) : ''
  }
  const p0 = parseSlotKey(sorted[0]!)
  const p1 = parseSlotKey(sorted[1]!)
  if (!p0 || !p1 || p0.dayIndex !== p1.dayIndex) {
    return `${formatSlotKeyLabel(sorted[0]!)} / ${formatSlotKeyLabel(sorted[1]!)}`
  }
  const labels = allSlotLabels()
  const start = labels[p0.slotIndex] ?? ''
  const endIdx = p1.slotIndex + 1
  const end = endIdx < labels.length ? labels[endIdx] : labels[p1.slotIndex] ?? ''
  const day = DAY_LABELS[p0.dayIndex] ?? ''
  return `${day} · ${start}–${end} · Aula de 60 min`
}

/** Duas chaves do mesmo bloco 60 min (para deduplicar logs legados). */
export function sixtyMinutePairKeys(enrollmentSlotKeys: string[]): Set<string> {
  const sorted = sortSlotKeys(enrollmentSlotKeys)
  if (sorted.length !== 2) return new Set(sorted)
  return new Set(sorted)
}

/** Pares de chaves [k0,k1] consecutivas no mesmo dia (60 min) para um professor. */
export function mergeSixtyMinuteSlotPairsForTeacher(
  students: Student[],
  teacherId: string,
  referenceDateIso = new Date().toISOString().slice(0, 10),
): string[][] {
  const out: string[][] = []
  for (const s of students) {
    if (!shouldStudentOccupyScheduleSlot(s, referenceDateIso)) continue
    const en = s.enrollment
    if (!en || en.teacherId !== teacherId || en.lessonMode !== '60x1' || en.slotKeys.length !== 2) continue
    const sorted = sortSlotKeys(en.slotKeys)
    const p0 = parseSlotKey(sorted[0]!)
    const p1 = parseSlotKey(sorted[1]!)
    if (!p0 || !p1 || p0.dayIndex !== p1.dayIndex || p1.slotIndex !== p0.slotIndex + 1) continue
    if (!canStart60MinuteLesson(p0.slotIndex)) continue
    out.push(sorted)
  }
  return out
}
