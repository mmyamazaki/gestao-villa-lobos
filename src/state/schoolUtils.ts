import { canonicalLessonLogSlotKey, createEmptySchedule } from '../domain/schedule'
import type {
  ClassSessionLog,
  MensalidadeRegistrada,
  ReplacementClass,
  ScheduleMap,
  SlotState,
  Student,
} from '../domain/types'

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
  const serverStudentParcelToId = new Map(
    server.map((x) => [`${x.studentId}|${x.parcelNumber}`, x.id] as const),
  )

  /** Remove parcelas locais “fantasma” (mesmo aluno/nº, id antigo) quando o servidor já tem a linha canónica. */
  const localFiltered = local.filter((l) => {
    const k = `${l.studentId}|${l.parcelNumber}`
    const serverId = serverStudentParcelToId.get(k)
    if (serverId == null) return true
    return serverId === l.id
  })

  const localById = new Map(localFiltered.map((x) => [x.id, x]))
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

/** Deduplica por professor/aluno/data/slot canónico; em conflito mantém o registo com `updatedAt` mais recente. */
export function normalizeLessonLogs(students: Student[], logs: ClassSessionLog[]): ClassSessionLog[] {
  const byComposite = new Map<string, ClassSessionLog>()
  for (const l of logs) {
    const st = students.find((s) => s.id === l.studentId)
    const en = st?.enrollment
    const slotKey = en
      ? canonicalLessonLogSlotKey(en.lessonMode, en.slotKeys, l.slotKey)
      : l.slotKey
    const row = { ...l, slotKey }
    const composite = `${row.teacherId}|${row.studentId}|${row.lessonDate}|${slotKey}`
    const existing = byComposite.get(composite)
    if (!existing || row.updatedAt > existing.updatedAt) {
      byComposite.set(composite, { ...row, id: existing?.id ?? row.id })
    } else {
      byComposite.set(composite, { ...existing, slotKey })
    }
  }
  return [...byComposite.values()]
}

/**
 * Une logs locais (localStorage) com os do servidor para outro dispositivo ver o mesmo histórico.
 */
export function mergeLessonLogsFromServer(
  students: Student[],
  local: ClassSessionLog[],
  server: ClassSessionLog[],
): ClassSessionLog[] {
  if (server.length === 0) return local
  return normalizeLessonLogs(students, [...local, ...server])
}

const EPOCH_ISO = '1970-01-01T00:00:00.000Z'

/** Por `id`; em conflito mantém o registo com `updatedAt` mais recente (ISO). */
export function normalizeReplacementClasses(rows: ReplacementClass[]): ReplacementClass[] {
  const byId = new Map<string, ReplacementClass>()
  for (const r of rows) {
    const u = (r.updatedAt ?? '').trim() || EPOCH_ISO
    const prev = byId.get(r.id)
    const pu = prev ? (prev.updatedAt ?? '').trim() || EPOCH_ISO : ''
    if (!prev || u > pu) {
      byId.set(r.id, {
        ...r,
        updatedAt: (r.updatedAt ?? '').trim() || u,
      })
    }
  }
  return [...byId.values()]
}

export function mergeReplacementClassesFromServer(
  local: ReplacementClass[],
  server: ReplacementClass[],
): ReplacementClass[] {
  if (server.length === 0) return local
  return normalizeReplacementClasses([...local, ...server])
}

export function ensureSchedule(m: ScheduleMap | undefined): ScheduleMap {
  const base = createEmptySchedule() as ScheduleMap
  if (!m) return base
  for (const k of Object.keys(base)) {
    if (m[k]) base[k] = m[k] as SlotState
  }
  return base
}
