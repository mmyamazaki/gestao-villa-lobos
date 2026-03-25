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
