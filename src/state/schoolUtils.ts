import { createEmptySchedule } from '../domain/schedule'
import type { ScheduleMap, SlotState } from '../domain/types'

export function ensureSchedule(m: ScheduleMap | undefined): ScheduleMap {
  const base = createEmptySchedule() as ScheduleMap
  if (!m) return base
  for (const k of Object.keys(base)) {
    if (m[k]) base[k] = m[k] as SlotState
  }
  return base
}
