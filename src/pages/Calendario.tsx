import { addDays, addWeeks, differenceInCalendarDays, format, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { allSlotLabels, mergeSixtyMinuteSlotPairsForTeacher, slotKey } from '../domain/schedule'
import { ScheduleGrid, ScheduleLegend } from '../components/ScheduleGrid'
import { useSchool } from '../state/SchoolContext'

export function Calendario() {
  const { state } = useSchool()
  const [teacherId, setTeacherId] = useState(() => state.teachers[0]?.id ?? '')
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(
    () => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset),
    [weekOffset],
  )
  const weekEnd = useMemo(() => addDays(weekStart, 5), [weekStart])

  const teacher = state.teachers.find((t) => t.id === teacherId)

  const mergeSlotKeys = useMemo(
    () => (teacherId ? mergeSixtyMinuteSlotPairsForTeacher(state.students, teacherId) : []),
    [state.students, teacherId],
  )

  const transientByKey = useMemo(() => {
    if (!teacherId) return {} as Record<string, { studentName: string; replacement?: boolean }>
    const labels = allSlotLabels()
    const out: Record<string, { studentName: string; replacement?: boolean }> = {}
    for (const r of state.replacementClasses) {
      if (r.teacherId !== teacherId) continue
      const d = new Date(r.date + 'T12:00:00')
      const delta = differenceInCalendarDays(d, weekStart)
      if (delta < 0 || delta > 5) continue
      const dayIndex = delta
      const start = labels.indexOf(r.startTime)
      if (start < 0) continue
      out[slotKey(dayIndex, start)] = {
        studentName: r.studentNome,
        replacement: true,
      }
      if (r.duration === 60) {
        out[slotKey(dayIndex, start + 1)] = {
          studentName: '',
          replacement: true,
        }
      }
    }
    return out
  }, [state.replacementClasses, teacherId, weekStart])

  const schedule = teacher?.schedule ?? {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Calendário</h2>
        <p className="mt-1 text-sm text-slate-600">
          Grade semanal por professor (mesmo padrão visual da matrícula). Verde: livre · Vermelho suave:
          indisponível · Ocupado: nome do aluno e instrumento em destaque. Reposição aparece em violeta com
          etiqueta.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Professor
            <select
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              {state.teachers.length === 0 && <option value="">Nenhum professor cadastrado</option>}
              {state.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-slate-700">
            <p className="font-medium">Semana exibida</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                onClick={() => setWeekOffset((w) => w - 1)}
              >
                ←
              </button>
              <span className="text-xs sm:text-sm">
                {format(weekStart, "d 'de' MMM", { locale: ptBR })} —{' '}
                {format(weekEnd, "d 'de' MMM yyyy", { locale: ptBR })}
              </span>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                onClick={() => setWeekOffset((w) => w + 1)}
              >
                →
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                onClick={() => setWeekOffset(0)}
              >
                Esta semana
              </button>
            </div>
          </div>
        </div>
      </section>

      {teacher ? (
        <div className="space-y-3">
          <ScheduleLegend />
          <ScheduleGrid
            mode="edit"
            schedule={schedule}
            mergeSlotKeys={mergeSlotKeys}
            transientByKey={transientByKey}
          />
          <p className="text-xs text-slate-500">
            Visualização somente leitura. Para alterar disponibilidade ou ocupação, use o cadastro do
            professor ou a matrícula. Para aulas avulsas de reposição (sem cobrança, apenas na data
            marcada), use{' '}
            <Link to="/alunos" className="font-medium text-emerald-800 underline hover:text-emerald-950">
              Alunos → Agendar reposição
            </Link>
            .
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Cadastre um professor para ver a grade.</p>
      )}
    </div>
  )
}
