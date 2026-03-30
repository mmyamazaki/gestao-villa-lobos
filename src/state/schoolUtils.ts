import { createEmptySchedule } from '../domain/schedule'
import type { MensalidadeRegistrada, ScheduleMap, SlotState } from '../domain/types'

/** Sobrepõe na parcela local os dados de pagamento vindos do servidor (Supabase via API). */
export function mergeMensalidadesFromServer(
  local: MensalidadeRegistrada[],
  server: MensalidadeRegistrada[],
): MensalidadeRegistrada[] {
  const sMap = new Map(server.map((x) => [x.id, x]))
  return local.map((m) => {
    const s = sMap.get(m.id)
    if (!s || !s.paidAt) return m
    return {
      ...m,
      paidAt: s.paidAt,
      status: 'pago',
      manualFine: s.manualFine,
      manualInterest: s.manualInterest,
      adjustmentNotes: s.adjustmentNotes,
    }
  })
}

export function ensureSchedule(m: ScheduleMap | undefined): ScheduleMap {
  const base = createEmptySchedule() as ScheduleMap
  if (!m) return base
  for (const k of Object.keys(base)) {
    if (m[k]) base[k] = m[k] as SlotState
  }
  return base
}
