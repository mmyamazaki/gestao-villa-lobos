import { jsPDF } from 'jspdf'
import { useMemo, useState } from 'react'

import {
  formatSixtyMinuteLessonLabel,
  formatSlotKeyLabel,
  sortSlotKeys,
} from '../../domain/schedule'
import type { Enrollment } from '../../domain/types'
import { useSchool } from '../../state/SchoolContext'
import { drawPdfHeader } from '../../utils/pdfHeader'

type ReportType = 'Aula' | 'Reposição'

interface ReportRow {
  key: string
  tipo: ReportType
  /** YYYY-MM-DD */
  date: string
  dateBR: string
  horarioLabel: string
  studentId: string
  studentName: string
  teacherId: string
  teacherName: string
  courseId: string
  courseLabel: string
  /** true = presente, false = falta, null = não registrado (ex.: reposição agendada) */
  present: boolean | null
  statusLabel: string
  content: string
}

const ddmmaaaa = (iso: string) => iso.split('-').reverse().join('/')

function formatLessonLogSlot(enrollment: Enrollment | null | undefined, slotKey: string): string {
  if (enrollment && enrollment.lessonMode === '60x1' && enrollment.slotKeys.length === 2) {
    const [k0] = sortSlotKeys(enrollment.slotKeys)
    if (slotKey === k0) return formatSixtyMinuteLessonLabel(enrollment.slotKeys)
  }
  return formatSlotKeyLabel(slotKey)
}

const replacementStatusLabel = (status: string): string =>
  status === 'realizada' ? 'Realizada' : status === 'faltou' ? 'Faltou' : 'Agendada'

export function RelatorioAulas() {
  const { state, getTeacher } = useSchool()

  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [alunoId, setAlunoId] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [tipo, setTipo] = useState<'todos' | 'aula' | 'reposicao'>('todos')
  const [presenca, setPresenca] = useState<'todos' | 'presente' | 'falta'>('todos')

  const studentsById = useMemo(
    () => new Map(state.students.map((s) => [s.id, s] as const)),
    [state.students],
  )

  const courseLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of state.courses) map.set(c.id, `${c.instrumentLabel} · ${c.levelLabel}`)
    return map
  }, [state.courses])

  const allRows = useMemo<ReportRow[]>(() => {
    const rows: ReportRow[] = []

    for (const l of state.lessonLogs) {
      const student = studentsById.get(l.studentId)
      const enrollment = student?.enrollment ?? null
      const courseId = enrollment?.courseId ?? ''
      rows.push({
        key: `aula-${l.id}`,
        tipo: 'Aula',
        date: l.lessonDate,
        dateBR: ddmmaaaa(l.lessonDate),
        horarioLabel: formatLessonLogSlot(enrollment, l.slotKey),
        studentId: l.studentId,
        studentName: student?.nome ?? '(aluno removido)',
        teacherId: l.teacherId,
        teacherName: getTeacher(l.teacherId)?.nome ?? '—',
        courseId,
        courseLabel: courseLabelById.get(courseId) ?? '—',
        present: l.present,
        statusLabel: l.present ? 'Presente' : 'Falta',
        content: l.content?.trim() ?? '',
      })
    }

    for (const r of state.replacementClasses) {
      const student = studentsById.get(r.studentId)
      const enrollment = student?.enrollment ?? null
      const courseId = enrollment?.courseId ?? ''
      const present = typeof r.present === 'boolean' ? r.present : null
      rows.push({
        key: `rep-${r.id}`,
        tipo: 'Reposição',
        date: r.date,
        dateBR: ddmmaaaa(r.date),
        horarioLabel: `${r.startTime} · ${r.duration} min`,
        studentId: r.studentId,
        studentName: r.studentNome || student?.nome || '—',
        teacherId: r.teacherId,
        teacherName: r.teacherNome || getTeacher(r.teacherId)?.nome || '—',
        courseId,
        courseLabel: courseLabelById.get(courseId) ?? '—',
        present,
        statusLabel: replacementStatusLabel(r.status),
        content: r.content?.trim() ?? '',
      })
    }

    rows.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.studentName.localeCompare(b.studentName, 'pt-BR')
    })
    return rows
  }, [state.lessonLogs, state.replacementClasses, studentsById, courseLabelById, getTeacher])

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (dataInicio && r.date < dataInicio) return false
      if (dataFim && r.date > dataFim) return false
      if (professorId && r.teacherId !== professorId) return false
      if (alunoId && r.studentId !== alunoId) return false
      if (cursoId && r.courseId !== cursoId) return false
      if (tipo === 'aula' && r.tipo !== 'Aula') return false
      if (tipo === 'reposicao' && r.tipo !== 'Reposição') return false
      if (presenca === 'presente' && r.present !== true) return false
      if (presenca === 'falta' && r.present !== false) return false
      return true
    })
  }, [allRows, dataInicio, dataFim, professorId, alunoId, cursoId, tipo, presenca])

  const resumo = useMemo(() => {
    let presentes = 0
    let faltas = 0
    for (const r of rows) {
      if (r.present === true) presentes++
      else if (r.present === false) faltas++
    }
    return { total: rows.length, presentes, faltas }
  }, [rows])

  const professoresOrdenados = useMemo(
    () => [...state.teachers].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [state.teachers],
  )
  const alunosOrdenados = useMemo(
    () => [...state.students].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [state.students],
  )
  const cursosOrdenados = useMemo(
    () =>
      [...state.courses].sort((a, b) =>
        `${a.instrumentLabel} ${a.levelLabel}`.localeCompare(`${b.instrumentLabel} ${b.levelLabel}`, 'pt-BR'),
      ),
    [state.courses],
  )

  const hasFiltros =
    Boolean(dataInicio) ||
    Boolean(dataFim) ||
    Boolean(professorId) ||
    Boolean(alunoId) ||
    Boolean(cursoId) ||
    tipo !== 'todos' ||
    presenca !== 'todos'

  const limparFiltros = () => {
    setDataInicio('')
    setDataFim('')
    setProfessorId('')
    setAlunoId('')
    setCursoId('')
    setTipo('todos')
    setPresenca('todos')
  }

  const exportarPdf = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    let y = await drawPdfHeader(doc, 10)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Relatório de aulas e reposições', pageW / 2, y + 1, { align: 'center' })
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const periodoTxt =
      dataInicio || dataFim
        ? `Período: ${dataInicio ? ddmmaaaa(dataInicio) : 'início'} a ${dataFim ? ddmmaaaa(dataFim) : 'hoje'}`
        : 'Período: todos'
    const profTxt = professorId ? getTeacher(professorId)?.nome ?? '—' : 'todos'
    const alunoTxt = alunoId ? studentsById.get(alunoId)?.nome ?? '—' : 'todos'
    const cursoTxt = cursoId ? courseLabelById.get(cursoId) ?? '—' : 'todos'
    const tipoTxt = tipo === 'todos' ? 'aulas + reposições' : tipo === 'aula' ? 'apenas aulas' : 'apenas reposições'
    doc.text(
      `${periodoTxt}  ·  Professor: ${profTxt}  ·  Aluno: ${alunoTxt}  ·  Curso: ${cursoTxt}  ·  Tipo: ${tipoTxt}`,
      14,
      y,
    )
    y += 5
    doc.text(
      `Total: ${resumo.total}  ·  Presenças: ${resumo.presentes}  ·  Faltas: ${resumo.faltas}  ·  Gerado em ${new Date().toLocaleString('pt-BR')}`,
      14,
      y,
    )
    y += 4

    const x = 10
    const columns = [
      { label: 'Data', w: 20, align: 'left' as const, get: (r: ReportRow) => r.dateBR },
      { label: 'Tipo', w: 22, align: 'left' as const, get: (r: ReportRow) => r.tipo },
      { label: 'Horário', w: 40, align: 'left' as const, get: (r: ReportRow) => r.horarioLabel },
      { label: 'Aluno', w: 48, align: 'left' as const, get: (r: ReportRow) => r.studentName },
      { label: 'Professor', w: 42, align: 'left' as const, get: (r: ReportRow) => r.teacherName },
      { label: 'Curso', w: 40, align: 'left' as const, get: (r: ReportRow) => r.courseLabel },
      { label: 'Presença', w: 20, align: 'left' as const, get: (r: ReportRow) => r.statusLabel },
      { label: 'Conteúdo', w: 45, align: 'left' as const, get: (r: ReportRow) => r.content || '—' },
    ]
    const tableW = columns.reduce((s, c) => s + c.w, 0)
    const rowH = 6.5

    const fit = (text: string, wMm: number) => {
      const maxW = wMm - 3
      if (doc.getTextWidth(text) <= maxW) return text
      let t = text
      while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1)
      return `${t}…`
    }

    const drawHeader = () => {
      doc.setFillColor(236, 242, 255)
      doc.rect(x, y, tableW, rowH, 'F')
      doc.setDrawColor(170, 184, 214)
      doc.rect(x, y, tableW, rowH)
      let cx = x
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      for (const c of columns) {
        doc.text(c.label, cx + 1.5, y + 4.4)
        cx += c.w
      }
      y += rowH
    }

    drawHeader()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    if (rows.length === 0) {
      doc.text('Nenhum registro para os filtros selecionados.', x + 1.5, y + 4.4)
    }

    const lineH = 3.6
    const lastIdx = columns.length - 1
    for (const r of rows) {
      const contentText = String(columns[lastIdx]!.get(r))
      const contentLines = doc.splitTextToSize(contentText, columns[lastIdx]!.w - 3) as string[]
      const dynH = Math.max(rowH, contentLines.length * lineH + 3)
      if (y + dynH > pageH - 10) {
        doc.addPage()
        y = 12
        drawHeader()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
      }
      doc.setDrawColor(220, 226, 240)
      doc.rect(x, y, tableW, dynH)
      let cx = x
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i]!
        if (i === lastIdx) {
          doc.text(contentLines, cx + 1.5, y + 4.2)
        } else {
          doc.text(fit(String(c.get(r)), c.w), cx + 1.5, y + 4.2)
        }
        cx += c.w
      }
      y += dynH
    }

    doc.save(`relatorio-aulas-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const selectCls =
    'min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]'
  const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Aulas e reposições lançadas pelos professores: presença, faltas e conteúdo por aluno.
        </p>
        <button
          type="button"
          onClick={exportarPdf}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#003366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00264d]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          Exportar PDF
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls} htmlFor="rel-data-inicio">
              Data início
            </label>
            <input
              id="rel-data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className={selectCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="rel-data-fim">
              Data fim
            </label>
            <input
              id="rel-data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className={selectCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="rel-professor">
              Professor
            </label>
            <select
              id="rel-professor"
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              className={selectCls}
            >
              <option value="">Todos</option>
              {professoresOrdenados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rel-aluno">
              Aluno
            </label>
            <select
              id="rel-aluno"
              value={alunoId}
              onChange={(e) => setAlunoId(e.target.value)}
              className={selectCls}
            >
              <option value="">Todos</option>
              {alunosOrdenados.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rel-curso">
              Curso
            </label>
            <select
              id="rel-curso"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              className={selectCls}
            >
              <option value="">Todos</option>
              {cursosOrdenados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.instrumentLabel} · {c.levelLabel}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rel-tipo">
              Tipo
            </label>
            <select
              id="rel-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className={selectCls}
            >
              <option value="todos">Aulas + reposições</option>
              <option value="aula">Apenas aulas</option>
              <option value="reposicao">Apenas reposições</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="rel-presenca">
              Presença
            </label>
            <select
              id="rel-presenca"
              value={presenca}
              onChange={(e) => setPresenca(e.target.value as typeof presenca)}
              className={selectCls}
            >
              <option value="todos">Todas</option>
              <option value="presente">Apenas presenças</option>
              <option value="falta">Apenas faltas</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={limparFiltros}
              disabled={!hasFiltros}
              className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            Total: <strong className="tabular-nums">{resumo.total}</strong>
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            Presenças: <strong className="tabular-nums">{resumo.presentes}</strong>
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
            Faltas: <strong className="tabular-nums">{resumo.faltas}</strong>
          </span>
        </div>
      </section>

      <section className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Nenhum registro para os filtros selecionados.
          </div>
        ) : (
          rows.map((r) => (
            <article key={r.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-sm font-semibold text-slate-900">{r.dateBR}</span>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    r.tipo === 'Reposição' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800',
                  ].join(' ')}
                >
                  {r.tipo}
                </span>
                <span className="text-sm text-slate-600">{r.horarioLabel}</span>
                <span className="ml-auto">
                  {r.present === null ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {r.statusLabel}
                    </span>
                  ) : (
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        r.present ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900',
                      ].join(' ')}
                    >
                      {r.statusLabel}
                    </span>
                  )}
                </span>
              </div>

              <div className="mt-1.5 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{r.studentName}</span>
                <span className="text-slate-400"> · </span>Prof. {r.teacherName}
                <span className="text-slate-400"> · </span>
                {r.courseLabel}
              </div>

              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Conteúdo da aula
                </span>
                {r.content ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{r.content}</p>
                ) : (
                  <span className="text-sm text-slate-400">Não informado</span>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
