import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { isTeacher, useAuth } from '../../auth/AuthContext'
import {
  allSlotLabels,
  DAY_LABELS,
  formatSixtyMinuteLessonLabel,
  parseSlotKey,
  sortSlotKeys,
} from '../../domain/schedule'
import { SchedulePortalLegend } from '../../components/SchedulePortalLegend'
import { scheduleUi } from '../../components/scheduleUiTokens'
import { shouldStudentOccupyScheduleSlot } from '../../domain/studentStatus'
import { useSchool } from '../../state/SchoolContext'

type ModalState =
  | null
  | {
      studentId: string
      studentNome: string
      slotKey: string
      lessonDate: string
      present: boolean
      content: string
      logId?: string
      /** Exibição única para bloco de 60 min */
      timeLabel: string
      isReplacement?: boolean
      replacementClassId?: string
    }

export function ProfessorAgenda() {
  const { session } = useAuth()
  const { state, saveLessonLog, saveReplacementClassResult } = useSchool()
  const teacherId = isTeacher(session) ? session.teacherId : ''

  const [weekOffset, setWeekOffset] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)

  const weekStart = useMemo(
    () => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset),
    [weekOffset],
  )

  const teacher = state.teachers.find((t) => t.id === teacherId)

  const rows = useMemo(() => {
    if (!teacherId) return []
    const labels = allSlotLabels()
    const out: {
      studentId: string
      studentNome: string
      slotKey: string
      lessonDate: string
      dayLabel: string
      timeLabel: string
      log?: { present: boolean; content: string; id: string }
      isReplacement?: boolean
      replacementClassId?: string
    }[] = []
    const myStudents = state.students.filter((s) => s.enrollment?.teacherId === teacherId)
    for (const s of myStudents) {
      const en = s.enrollment
      if (!en) continue

      if (en.lessonMode === '60x1' && en.slotKeys.length === 2) {
        const [k0, k1] = sortSlotKeys(en.slotKeys)
        const p = parseSlotKey(k0)
        if (!p) continue
        const lessonDate = format(addDays(weekStart, p.dayIndex), 'yyyy-MM-dd')
        if (!shouldStudentOccupyScheduleSlot(s, lessonDate)) continue
        const log = state.lessonLogs.find(
          (l) =>
            l.teacherId === teacherId &&
            l.studentId === s.id &&
            l.lessonDate === lessonDate &&
            (l.slotKey === k0 || l.slotKey === k1),
        )
        out.push({
          studentId: s.id,
          studentNome: s.nome,
          slotKey: k0,
          lessonDate,
          dayLabel: DAY_LABELS[p.dayIndex] ?? '',
          timeLabel: formatSixtyMinuteLessonLabel(en.slotKeys),
          log: log
            ? { present: log.present, content: log.content, id: log.id }
            : undefined,
        })
        continue
      }

      for (const key of en.slotKeys) {
        const p = parseSlotKey(key)
        if (!p) continue
        const lessonDate = format(addDays(weekStart, p.dayIndex), 'yyyy-MM-dd')
        if (!shouldStudentOccupyScheduleSlot(s, lessonDate)) continue
        const timeLabel = labels[p.slotIndex] ?? key
        const dayLabel = DAY_LABELS[p.dayIndex] ?? ''
        const log = state.lessonLogs.find(
          (l) =>
            l.teacherId === teacherId &&
            l.studentId === s.id &&
            l.lessonDate === lessonDate &&
            l.slotKey === key,
        )
        out.push({
          studentId: s.id,
          studentNome: s.nome,
          slotKey: key,
          lessonDate,
          dayLabel,
          timeLabel,
          log: log
            ? { present: log.present, content: log.content, id: log.id }
            : undefined,
        })
      }
    }
    for (const r of state.replacementClasses) {
      if (r.teacherId !== teacherId) continue
      const lessonDate = r.date
      const d = new Date(lessonDate + 'T12:00:00')
      const delta = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))
      if (delta < 0 || delta > 5) continue
      const dayLabel = DAY_LABELS[delta] ?? ''
      const startIdx = labels.indexOf(r.startTime)
      const timeLabel =
        startIdx >= 0 && r.duration === 60 && startIdx + 2 <= labels.length
          ? `${dayLabel} · ${labels[startIdx]}–${labels[startIdx + 2]} · Reposição`
          : `${dayLabel} · ${r.startTime} · Reposição`
      out.push({
        studentId: r.studentId,
        studentNome: r.studentNome,
        slotKey: startIdx >= 0 ? `${delta}-${startIdx}` : `${delta}-0`,
        lessonDate,
        dayLabel,
        timeLabel,
        log:
          r.status === 'realizada' || r.status === 'faltou'
            ? { present: Boolean(r.present), content: r.content, id: r.id }
            : undefined,
        isReplacement: true,
        replacementClassId: r.id,
      })
    }
    out.sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || a.timeLabel.localeCompare(b.timeLabel))
    return out
  }, [state.students, state.lessonLogs, state.replacementClasses, teacherId, weekStart])

  if (!teacher) {
    return <p className="text-slate-600">Professor não encontrado.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Agenda semanal</h2>
        <p className="mt-1 text-sm text-slate-600">
          Olá, <strong>{teacher.nome}</strong>. Toque no aluno para marcar presença/falta e registrar o conteúdo.
          Aulas de <strong>reposição</strong> aparecem só na data agendada (etiqueta no horário); não geram
          mensalidade.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50"
          onClick={() => setWeekOffset((w) => w - 1)}
        >
          Semana anterior
        </button>
        <span className="text-sm font-medium text-slate-800">
          {format(weekStart, "d 'de' MMMM", { locale: ptBR })} —{' '}
          {format(addDays(weekStart, 5), "d 'de' MMMM yyyy", { locale: ptBR })}
        </span>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-50"
          onClick={() => setWeekOffset((w) => w + 1)}
        >
          Próxima semana
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          onClick={() => setWeekOffset(0)}
        >
          Esta semana
        </button>
      </div>

      <SchedulePortalLegend />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Data</th>
              <th className="px-3 py-3">Dia</th>
              <th className="px-3 py-3">Horário</th>
              <th className="px-3 py-3">Aluno</th>
              <th className="px-3 py-3">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum aluno vinculado à sua grade nesta semana.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={`${r.studentId}-${r.slotKey}-${r.lessonDate}-${r.isReplacement ? 'rep' : 'reg'}`}
                className={
                  r.isReplacement
                    ? `${scheduleUi.rowReposicao} hover:bg-violet-200/50`
                    : `${scheduleUi.rowOcupado} hover:bg-indigo-100/80`
                }
              >
                <td className="px-3 py-3 tabular-nums text-slate-700">
                  {r.lessonDate.split('-').reverse().join('/')}
                </td>
                <td className="px-3 py-3 font-medium text-slate-800">{r.dayLabel}</td>
                <td className="max-w-[280px] px-3 py-3">
                  <span
                    className={
                      r.isReplacement
                        ? 'rounded-md bg-violet-200 px-2 py-0.5 font-bold text-black'
                        : scheduleUi.chipHorario
                    }
                  >
                    {r.timeLabel}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className={`text-left underline decoration-slate-300 ${scheduleUi.nomeAluno} hover:decoration-[#003366]`}
                    onClick={() => {
                      if (r.isReplacement && r.replacementClassId) {
                        const rr = state.replacementClasses.find((x) => x.id === r.replacementClassId)
                        setModal({
                          studentId: r.studentId,
                          studentNome: r.studentNome,
                          slotKey: r.slotKey,
                          lessonDate: r.lessonDate,
                          present: rr?.present ?? true,
                          content: rr?.content ?? '',
                          logId: rr?.id,
                          timeLabel: r.timeLabel,
                          isReplacement: true,
                          replacementClassId: r.replacementClassId,
                        })
                        return
                      }
                      const en = state.students.find((x) => x.id === r.studentId)?.enrollment
                      const pair =
                        en?.lessonMode === '60x1' && en.slotKeys.length === 2
                          ? sortSlotKeys(en.slotKeys)
                          : [r.slotKey]
                      const existing = state.lessonLogs.find(
                        (l) =>
                          l.teacherId === teacherId &&
                          l.studentId === r.studentId &&
                          l.lessonDate === r.lessonDate &&
                          pair.includes(l.slotKey),
                      )
                      setModal({
                        studentId: r.studentId,
                        studentNome: r.studentNome,
                        slotKey: pair[0] ?? r.slotKey,
                        lessonDate: r.lessonDate,
                        present: existing?.present ?? true,
                        content: existing?.content ?? '',
                        logId: existing?.id,
                        timeLabel: r.timeLabel,
                      })
                    }}
                  >
                    {r.studentNome}
                  </button>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">
                  {r.log ? (
                    <span className={r.log.present ? 'text-emerald-700' : 'text-amber-800'}>
                      {r.log.present ? 'Presença' : 'Falta'} · {r.log.content.slice(0, 40)}
                      {r.log.content.length > 40 ? '…' : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">Não registrado</span>
                  )}
                  {r.isReplacement && (
                    <span className={`ml-2 ${scheduleUi.badgeReposicao}`}>Reposição</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Registro de aula</h3>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{modal.studentNome}</strong> · {modal.timeLabel} ·{' '}
              {modal.lessonDate.split('-').reverse().join('/')}
              {modal.isReplacement && (
                <span className={`ml-2 ${scheduleUi.badgeReposicao}`}>Reposição</span>
              )}
            </p>
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={modal.present}
                  onChange={(e) => setModal((m) => (m ? { ...m, present: e.target.checked } : m))}
                  className="rounded border-slate-300"
                />
                Presença
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Conteúdo da aula
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                  value={modal.content}
                  onChange={(e) => setModal((m) => (m ? { ...m, content: e.target.value } : m))}
                  placeholder="Ex.: Escala de Dó maior, exercício 3 do método…"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#00264d]"
                onClick={() => {
                  if (modal.isReplacement && modal.replacementClassId) {
                    saveReplacementClassResult({
                      replacementClassId: modal.replacementClassId,
                      present: modal.present,
                      content: modal.content,
                    })
                  } else {
                    saveLessonLog({
                      teacherId,
                      studentId: modal.studentId,
                      lessonDate: modal.lessonDate,
                      slotKey: modal.slotKey,
                      present: modal.present,
                      content: modal.content.trim(),
                      id: modal.logId,
                    })
                  }
                  setModal(null)
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
