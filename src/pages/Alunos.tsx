import { useState } from 'react'
import { Link } from 'react-router-dom'
import { calcAgeYears } from '../domain/age'
import { allSlotLabels, canStart60MinuteLesson, formatSlotKeyLabel, slotKey } from '../domain/schedule'
import type { Student } from '../domain/types'
import { useSchool } from '../state/SchoolContext'

function statusBadgeClass(status: Student['status']) {
  return status === 'ativo'
    ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
    : 'bg-slate-200 text-slate-800 ring-slate-300'
}

export function Alunos() {
  const { state, getTeacher, getCourse, saveStudent, scheduleReplacementClass } = useSchool()
  const [cancelModal, setCancelModal] = useState<Student | null>(null)
  const [cancelDate, setCancelDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [cancelObs, setCancelObs] = useState('')
  const [reactivateModal, setReactivateModal] = useState<Student | null>(null)
  const [replacementModal, setReplacementModal] = useState<Student | null>(null)
  const [replacementTeacherId, setReplacementTeacherId] = useState('')
  const [replacementDate, setReplacementDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [replacementStartTime, setReplacementStartTime] = useState('')
  const [replacementDuration, setReplacementDuration] = useState<30 | 60>(30)

  const today = new Date().toISOString().slice(0, 10)

  const openCancelModal = (s: Student) => {
    setCancelModal(s)
    setCancelDate(today)
    setCancelObs('')
  }

  const confirmCancel = () => {
    if (!cancelModal) return
    if (!cancelDate) {
      window.alert('Informe a data de cancelamento.')
      return
    }
    const updated: Student = {
      ...cancelModal,
      status: 'inativo',
      dataCancelamento: cancelDate.slice(0, 10),
      observacoesCancelamento: cancelObs.trim() || undefined,
    }
    const r = saveStudent(updated)
    if (!r.ok) {
      window.alert(r.message)
      return
    }
    setCancelModal(null)
  }

  const openReactivateModal = (s: Student) => {
    setReactivateModal(s)
  }

  const openReplacementModal = (s: Student) => {
    setReplacementModal(s)
    setReplacementTeacherId(s.enrollment?.teacherId ?? state.teachers[0]?.id ?? '')
    setReplacementDate(today)
    setReplacementDuration(30)
    setReplacementStartTime('')
  }

  const confirmReactivate = () => {
    if (!reactivateModal) return
    const updated: Student = {
      ...reactivateModal,
      status: 'ativo',
      dataCancelamento: undefined,
      observacoesCancelamento: undefined,
    }
    const r = saveStudent(updated)
    if (!r.ok) {
      window.alert(r.message)
      return
    }
    setReactivateModal(null)
  }

  const replacementTimeOptions = (() => {
    if (!replacementTeacherId || !replacementDate) return [] as string[]
    const teacher = state.teachers.find((t) => t.id === replacementTeacherId)
    if (!teacher) return [] as string[]
    const labels = allSlotLabels()
    const d = new Date(replacementDate + 'T12:00:00')
    const jsDay = d.getDay()
    if (Number.isNaN(jsDay) || jsDay === 0) return [] as string[]
    const dayIndex = jsDay - 1
    return labels.filter((_, idx) => {
      const k = slotKey(dayIndex, idx)
      if (teacher.schedule[k]?.status !== 'free') return false
      const hasConflict = state.replacementClasses.some((r) => {
        if (r.teacherId !== replacementTeacherId || r.date !== replacementDate) return false
        const rIdx = labels.indexOf(r.startTime)
        if (rIdx < 0) return false
        const range = r.duration === 60 ? [rIdx, rIdx + 1] : [rIdx]
        return range.includes(idx) || (replacementDuration === 60 && range.includes(idx + 1))
      })
      if (hasConflict) return false
      if (replacementDuration === 60) {
        if (!canStart60MinuteLesson(idx)) return false
        const k2 = slotKey(dayIndex, idx + 1)
        if (teacher.schedule[k2]?.status !== 'free') return false
      }
      return true
    })
  })()

  const confirmReplacement = () => {
    if (!replacementModal) return
    if (!replacementTeacherId || !replacementDate || !replacementStartTime) {
      window.alert('Selecione professor, data e horário para agendar a reposição.')
      return
    }
    const r = scheduleReplacementClass({
      studentId: replacementModal.id,
      teacherId: replacementTeacherId,
      date: replacementDate,
      startTime: replacementStartTime,
      duration: replacementDuration,
    })
    if (!r.ok) {
      window.alert(r.message)
      return
    }
    setReplacementModal(null)
  }

  return (
    <div className="relative space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1 pr-0 sm:pr-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Alunos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Matrículas integradas à grade dos professores e ao financeiro. Use o status para
            cancelamento formal (com data e observações).
          </p>
        </div>
        <div className="shrink-0 sm:pt-0.5">
          <Link
            to="/alunos/novo"
            aria-label="Ir para o cadastro de nova matrícula"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#003366] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 sm:w-auto"
          >
            Nova matrícula
          </Link>
        </div>
      </header>

      <div className="md:hidden space-y-3">
        {state.students.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
            Nenhum aluno cadastrado.
          </div>
        )}
        {state.students.map((s) => {
          const age = calcAgeYears(s.dataNascimento)
          const en = s.enrollment
          const course = en ? getCourse(en.courseId) : undefined
          const teacher = en ? getTeacher(en.teacherId) : undefined
          return (
            <article key={`mobile-${s.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{s.nome}</h3>
                  <p className="text-xs tabular-nums text-slate-500">Código: {s.codigo}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(s.status)}`}
                >
                  {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                <p>Idade: {age !== null ? `${age}` : '—'}</p>
                <p>Curso/Professor: {course && teacher ? `${course.instrumentLabel} · ${teacher.nome}` : '—'}</p>
                <p className="text-xs text-slate-600">
                  Horários: {en?.slotKeys?.length ? en.slotKeys.map((k) => formatSlotKeyLabel(k)).join('; ') : '—'}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/alunos/${s.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-800"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium text-violet-800"
                  onClick={() => openReplacementModal(s)}
                >
                  Agendar reposição
                </button>
                {s.status === 'ativo' && s.enrollment && (
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800"
                    onClick={() => openCancelModal(s)}
                  >
                    Cancelar matrícula
                  </button>
                )}
                {s.status === 'inativo' && (
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                    onClick={() => openReactivateModal(s)}
                  >
                    Reativar
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Idade</th>
              <th className="px-4 py-3">Curso / Professor</th>
              <th className="px-4 py-3">Horários</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhum aluno cadastrado.
                </td>
              </tr>
            )}
            {state.students.map((s) => {
              const age = calcAgeYears(s.dataNascimento)
              const en = s.enrollment
              const course = en ? getCourse(en.courseId) : undefined
              const teacher = en ? getTeacher(en.teacherId) : undefined
              return (
                <tr key={s.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.nome}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{s.codigo}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(s.status)}`}
                    >
                      {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                    {s.status === 'inativo' && s.dataCancelamento && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        Cancel.: {s.dataCancelamento.split('-').reverse().join('/')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{age !== null ? `${age}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {course && teacher
                      ? `${course.instrumentLabel} · ${teacher.nome}`
                      : '—'}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">
                    {en?.slotKeys?.length
                      ? en.slotKeys.map((k) => formatSlotKeyLabel(k)).join('; ')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                      <Link
                        to={`/alunos/${s.id}`}
                        className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] items-center text-sm font-medium text-violet-800 hover:text-violet-900"
                        onClick={() => openReplacementModal(s)}
                      >
                        Agendar reposição
                      </button>
                      {s.status === 'ativo' && s.enrollment && (
                        <button
                          type="button"
                        className="inline-flex min-h-[44px] items-center text-sm font-medium text-red-800 hover:text-red-900"
                          onClick={() => openCancelModal(s)}
                        >
                          Cancelar matrícula
                        </button>
                      )}
                      {s.status === 'inativo' && (
                        <button
                          type="button"
                        className="inline-flex min-h-[44px] items-center text-sm font-medium text-slate-700 hover:text-slate-900"
                          onClick={() => openReactivateModal(s)}
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {reactivateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reactivate-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 id="reactivate-title" className="text-lg font-semibold text-slate-900">
              Confirmar reativação
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Deseja reativar este aluno? Isso tornará as mensalidades futuras pendentes e restaurará
              o horário na agenda.
            </p>
            <p className="mt-3 text-sm text-slate-800">
              Aluno: <strong>{reactivateModal.nome}</strong>
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => setReactivateModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                onClick={confirmReactivate}
              >
                Confirmar Reativação
              </button>
            </div>
          </div>
        </div>
      )}

      {replacementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replacement-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 id="replacement-title" className="text-lg font-semibold text-slate-900">
              Agendar reposição
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Aluno: <strong>{replacementModal.nome}</strong>. Esta aula não gera cobrança no financeiro.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium text-slate-700">
                Professor
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={replacementTeacherId}
                  onChange={(e) => {
                    setReplacementTeacherId(e.target.value)
                    setReplacementStartTime('')
                  }}
                >
                  <option value="">Selecione…</option>
                  {state.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">
                  Data
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={replacementDate}
                    onChange={(e) => {
                      setReplacementDate(e.target.value)
                      setReplacementStartTime('')
                    }}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Duração
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={String(replacementDuration)}
                    onChange={(e) => {
                      setReplacementDuration(e.target.value === '60' ? 60 : 30)
                      setReplacementStartTime('')
                    }}
                  >
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                  </select>
                </label>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Horário livre
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={replacementStartTime}
                  onChange={(e) => setReplacementStartTime(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {replacementTimeOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => setReplacementModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
                onClick={confirmReplacement}
              >
                Agendar Reposição
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 id="cancel-title" className="text-lg font-semibold text-slate-900">
              Cancelar matrícula
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{cancelModal.nome}</strong> — Parcelas com vencimento após esta data serão
              marcadas como canceladas. A agenda do professor será liberada conforme a data (imediato
              se a data for hoje ou passado).
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Data de cancelamento
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                value={cancelDate}
                onChange={(e) => setCancelDate(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Observações
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                rows={3}
                value={cancelObs}
                onChange={(e) => setCancelObs(e.target.value)}
                placeholder="Motivo, encaminhamento, etc."
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => setCancelModal(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                onClick={confirmCancel}
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
