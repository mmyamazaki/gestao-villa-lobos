import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { isStudent, useAuth } from '../../auth/AuthContext'
import {
  formatSixtyMinuteLessonLabel,
  formatSlotKeyLabel,
  sortSlotKeys,
} from '../../domain/schedule'
import { SchedulePortalLegend } from '../../components/SchedulePortalLegend'
import { scheduleUi } from '../../components/scheduleUiTokens'
import { computeStudentParcelView } from '../../domain/studentFinance'
import { useSchool } from '../../state/SchoolContext'

const tabs = [
  { id: 'horarios' as const, label: 'Meus horários' },
  { id: 'reposicoes' as const, label: 'Minhas reposições' },
  { id: 'aulas' as const, label: 'Presença e conteúdo' },
  { id: 'financeiro' as const, label: 'Financeiro' },
]

export function AlunoPainel() {
  const { session } = useAuth()
  const { state } = useSchool()
  const studentId = isStudent(session) ? session.studentId : ''
  const student = state.students.find((s) => s.id === studentId)
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('horarios')

  const refDate = useMemo(() => new Date(), [])

  const financeRows = useMemo(() => {
    if (!studentId) return []
    const now = new Date()
    return state.mensalidades
      .filter((m) => m.studentId === studentId)
      .map((m) => computeStudentParcelView(m, now))
      .sort((a, b) => a.m.referenceMonth.localeCompare(b.m.referenceMonth))
  }, [state.mensalidades, studentId])

  const logsDesc = useMemo(() => {
    return [...state.lessonLogs].filter((l) => l.studentId === studentId).sort((a, b) => {
      if (a.lessonDate !== b.lessonDate) return b.lessonDate.localeCompare(a.lessonDate)
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [state.lessonLogs, studentId])
  const replacementRows = useMemo(
    () =>
      state.replacementClasses
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [state.replacementClasses, studentId],
  )

  if (!student) {
    return <p className="text-slate-600">Aluno não encontrado.</p>
  }

  const en = student.enrollment

  const formatLessonLogSlot = (logSlotKey: string) => {
    if (!en) return formatSlotKeyLabel(logSlotKey)
    if (en.lessonMode === '60x1' && en.slotKeys.length === 2) {
      const [k0] = sortSlotKeys(en.slotKeys)
      if (logSlotKey === k0) return formatSixtyMinuteLessonLabel(en.slotKeys)
    }
    return formatSlotKeyLabel(logSlotKey)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Portal do aluno</h2>
        <p className="mt-1 text-sm text-slate-600">
          Olá, <strong>{student.nome}</strong>. Referência:{' '}
          <span className="tabular-nums">{format(refDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}</span>
        </p>
        {student.status === 'inativo' && student.dataCancelamento && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Matrícula inativa desde {student.dataCancelamento.split('-').reverse().join('/')}.
            {student.observacoesCancelamento ? ` ${student.observacoesCancelamento}` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-t-lg px-3 py-2 text-sm font-medium transition',
              tab === t.id
                ? 'bg-white text-[#003366] shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'horarios' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <SchedulePortalLegend />
            <p className="mt-2 text-xs text-slate-500">
              Estes horários são suas aulas regulares (mesma cor de &quot;ocupado&quot; na grade da escola).
            </p>
          </div>
          {!en ? (
            <p className="text-slate-600">Sem matrícula ativa.</p>
          ) : (
            <ul className="space-y-2">
              {en.lessonMode === '60x1' && en.slotKeys.length === 2 ? (
                <li
                  className={`flex flex-wrap items-center justify-between gap-2 ${scheduleUi.cardOcupado}`}
                >
                  <span className={scheduleUi.nomeAluno}>{formatSixtyMinuteLessonLabel(en.slotKeys)}</span>
                  <span className="text-slate-700">
                    Professor:{' '}
                    {state.teachers.find((x) => x.id === en.teacherId)?.nome ?? '—'}
                  </span>
                </li>
              ) : (
                sortSlotKeys(en.slotKeys).map((k) => (
                  <li
                    key={k}
                    className={`flex flex-wrap items-center justify-between gap-2 ${scheduleUi.cardOcupado}`}
                  >
                    <span className={scheduleUi.nomeAluno}>{formatSlotKeyLabel(k)}</span>
                    <span className="text-slate-700">
                      Professor:{' '}
                      {state.teachers.find((x) => x.id === en.teacherId)?.nome ?? '—'}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      )}

      {tab === 'aulas' && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <SchedulePortalLegend />
          </div>
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Horário (grade)</th>
                <th className="px-3 py-3">Presença</th>
                <th className="px-3 py-3">Conteúdo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logsDesc.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    Nenhum registro de aula ainda.
                  </td>
                </tr>
              )}
              {logsDesc.map((l) => (
                <tr key={l.id} className={`${scheduleUi.rowOcupado} hover:bg-indigo-100/80`}>
                  <td className="px-3 py-3 tabular-nums text-slate-700">
                    {l.lessonDate.split('-').reverse().join('/')}
                  </td>
                  <td className="px-3 py-3">
                    <span className={scheduleUi.chipHorario}>{formatLessonLogSlot(l.slotKey)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        l.present ? 'font-medium text-emerald-700' : 'font-medium text-amber-800'
                      }
                    >
                      {l.present ? 'Presente' : 'Falta'}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-3 py-3 text-slate-700">{l.content || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'reposicoes' && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <SchedulePortalLegend />
          </div>
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Horário</th>
                <th className="px-3 py-3">Professor</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Conteúdo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {replacementRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    Nenhuma reposição agendada.
                  </td>
                </tr>
              )}
              {replacementRows.map((r) => (
                <tr key={r.id} className={`${scheduleUi.rowReposicao} hover:bg-violet-200/50`}>
                  <td className="px-3 py-3 tabular-nums text-slate-800">
                    {r.date.split('-').reverse().join('/')}
                  </td>
                  <td className="px-3 py-3">
                    <span className="mr-2 align-middle">
                      <span className={scheduleUi.badgeReposicao}>Reposição</span>
                    </span>
                    <span className="rounded-md bg-violet-200 px-2 py-0.5 font-bold text-black">
                      {r.startTime} · {r.duration} min
                    </span>
                  </td>
                  <td className="px-3 py-3 font-bold text-black">{r.teacherNome}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-800">
                    {r.status === 'agendada'
                      ? 'Agendada'
                      : r.status === 'realizada'
                        ? 'Realizada'
                        : 'Faltou'}
                  </td>
                  <td className="max-w-[320px] px-3 py-3 text-slate-700">{r.content || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'financeiro' && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Mês/ano</th>
                <th className="px-3 py-3 text-right">Valor bruto</th>
                <th className="px-3 py-3 text-right">Descontos (R$)</th>
                <th className="px-3 py-3 text-right">Multa / juros</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financeRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Nenhuma mensalidade registrada.
                  </td>
                </tr>
              )}
              {financeRows.map((row) => {
                const encargos = row.multa + row.juros
                const statusLabel =
                  row.status === 'cancelado'
                    ? 'Cancelado'
                    : row.status === 'pago'
                      ? 'Pago'
                      : row.status === 'aberto'
                        ? 'Aberto'
                        : 'Atrasado'
                const rowCls =
                  row.status === 'cancelado'
                    ? 'bg-slate-100/90'
                    : row.status === 'pago'
                      ? 'bg-emerald-50/90'
                      : row.status === 'aberto'
                        ? 'bg-amber-50/90'
                        : 'bg-red-50/90'
                return (
                  <tr key={row.m.id} className={rowCls}>
                    <td className="px-3 py-3 font-medium tabular-nums text-slate-900">
                      {row.m.referenceMonth}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      R$ {row.valorBruto.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      R$ {row.descontoReais.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">R$ {encargos.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      R$ {row.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-800">{statusLabel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Após o vencimento, o desconto deixa de valer; multa e juros incidem sobre o valor bruto. 1ª parcela: sem
            multa/juros no sistema.
          </p>
        </section>
      )}
    </div>
  )
}
