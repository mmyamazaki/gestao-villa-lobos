import { createEmptySchedule } from '../domain/schedule'
import type { MensalidadeRegistrada, ScheduleMap, SlotState } from '../domain/types'

/**
 * Une lista local com a do servidor: inclui parcelas que só existem no banco (outro PC),
 * mantém parcelas só no navegador (ainda não sincronizadas) e resolve conflitos de quitação.
 */
export function mergeMensalidadesFromServer(
  local: MensalidadeRegistrada[],
  server: MensalidadeRegistrada[],
): MensalidadeRegistrada[] {
  if (server.length === 0) return local

  const serverById = new Map(server.map((x) => [x.id, x]))
  const localById = new Map(local.map((x) => [x.id, x]))
  const out = new Map<string, MensalidadeRegistrada>()

  for (const [id, s] of serverById) {
    const l = localById.get(id)
    if (!l) {
      out.set(id, s)
      continue
    }
    const localPaid = Boolean(l.paidAt)
    const serverPaid = Boolean(s.paidAt)

    if (localPaid && !serverPaid) {
      out.set(id, {
        ...s,
        paidAt: l.paidAt,
        status: 'pago',
        manualFine: l.manualFine,
        manualInterest: l.manualInterest,
        adjustmentNotes: l.adjustmentNotes,
        liquidAmount: l.liquidAmount,
      })
      continue
    }

    out.set(id, { ...l, ...s })
  }

  for (const [id, l] of localById) {
    if (!serverById.has(id)) {
      out.set(id, l)
    }
  }

  return Array.from(out.values()).sort(
    (a, b) => a.studentId.localeCompare(b.studentId) || a.parcelNumber - b.parcelNumber,
  )
}

export function ensureSchedule(m: ScheduleMap | undefined): ScheduleMap {
  const base = createEmptySchedule() as ScheduleMap
  if (!m) return base
  for (const k of Object.keys(base)) {
    if (m[k]) base[k] = m[k] as SlotState
  }
  return base
}
