import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { calcAgeYears } from '../domain/age'
import {
  canStart60MinuteLesson,
  formatSlotKeyLabel,
  parseSlotKey,
  slotKey,
} from '../domain/schedule'
import { generateStudentCode, isValidStudentCode } from '../domain/studentCode'
import type { LessonMode, Responsible, Student } from '../domain/types'
import type { SchoolContextValue } from '../state/SchoolContext'
import { FormActions } from '../components/FormActions'
import { ScheduleGrid } from '../components/ScheduleGrid'
import { useSchool } from '../state/SchoolContext'
import { generateEnrollmentContractPdf } from '../utils/generateContractPdf'

function emptyResponsible(): Responsible {
  return {
    nome: '',
    parentesco: '',
    profissao: '',
    rg: '',
    cpf: '',
    contato: '',
    endereco: '',
  }
}

function cloneStudent(b: Student): Student {
  return {
    ...b,
    responsavel: b.responsavel ? { ...b.responsavel } : undefined,
    enrollment: b.enrollment
      ? { ...b.enrollment, slotKeys: [...b.enrollment.slotKeys] }
      : null,
  }
}

export function Matricula() {
  const { id } = useParams()
  const navigate = useNavigate()
  const school = useSchool()

  const [novoStudentId] = useState(() => crypto.randomUUID())
  const [novoCodigo] = useState(() => generateStudentCode())

  const baseline = useMemo((): Student | null => {
    if (id === 'novo') {
      return {
        id: novoStudentId,
        codigo: novoCodigo,
        nome: '',
        dataNascimento: '',
        rg: '',
        cpf: '',
        filiacao: '',
        responsavel: undefined,
        enrollment: null,
      }
    }
    return school.state.students.find((s) => s.id === id) ?? null
  }, [id, novoStudentId, novoCodigo, school.state.students])

  if (!baseline) return <Navigate to="/alunos" replace />

  return (
    <MatriculaInner
      key={id === 'novo' ? novoStudentId : baseline.id}
      mode={id === 'novo' ? 'novo' : 'edit'}
      baseline={baseline}
      school={school}
      onCancelNavigate={() => navigate('/alunos')}
      onDone={() => navigate('/alunos')}
    />
  )
}

function MatriculaInner({
  mode,
  baseline,
  school,
  onCancelNavigate,
  onDone,
}: {
  mode: 'novo' | 'edit'
  baseline: Student
  school: SchoolContextValue
  onCancelNavigate: () => void
  onDone: () => void
}) {
  const { state, saveStudent, getTeacher, getCourse } = school

  const [draft, setDraft] = useState(() => cloneStudent(baseline))
  const [lessonMode, setLessonMode] = useState<LessonMode>(
    () => baseline.enrollment?.lessonMode ?? '60x1',
  )
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    () => baseline.enrollment?.slotKeys.slice().sort() ?? [],
  )

  const age = calcAgeYears(draft.dataNascimento)
  const minor = age !== null && age < 18
  const teacher = draft.enrollment ? getTeacher(draft.enrollment.teacherId) : undefined

  const selectedCourse = draft.enrollment?.courseId
    ? state.courses.find((c) => c.id === draft.enrollment!.courseId)
    : undefined

  const teachersForCourse = useMemo(() => {
    if (!selectedCourse) return []
    return state.teachers.filter((t) =>
      (t.instrumentSlugs ?? []).includes(selectedCourse.instrument),
    )
  }, [state.teachers, selectedCourse])

  const pickSlot = (key: string) => {
    if (!draft.enrollment) return
    const t = getTeacher(draft.enrollment.teacherId)
    if (!t) return
    const cell = t.schedule[key]
    if (cell?.status === 'unavailable') return
    if (cell?.status === 'busy' && cell.studentId !== draft.id) return

    const parsed = parseSlotKey(key)
    if (!parsed) return

    if (lessonMode === '60x1') {
      const { dayIndex, slotIndex } = parsed
      if (!canStart60MinuteLesson(slotIndex)) {
        window.alert(
          'Para 1×60min, escolha um horário cuja segunda metade esteja no mesmo período (manhã ou tarde).',
        )
        return
      }
      const k2 = slotKey(dayIndex, slotIndex + 1)
      const c2 = t.schedule[k2]
      if (
        c2?.status === 'unavailable' ||
        (c2?.status === 'busy' && c2.studentId !== draft.id)
      ) {
        window.alert('O bloco de 60 minutos não está totalmente livre.')
        return
      }
      setSelectedKeys([key, k2].sort())
      return
    }

    setSelectedKeys((prev) => {
      const set = new Set(prev)
      if (set.has(key)) {
        set.delete(key)
      } else if (set.size < 2) {
        set.add(key)
      } else {
        window.alert('No modo 2×30min, selecione no máximo dois blocos de 30 minutos.')
        return prev
      }
      return [...set].sort()
    })
  }

  const buildEnrollment = () => {
    if (!draft.enrollment?.courseId || !draft.enrollment.teacherId) return null
    if (!selectedKeys.length) return null
    if (lessonMode === '60x1' && selectedKeys.length !== 2) return null
    if (lessonMode === '30x2' && selectedKeys.length !== 2) return null
    return {
      ...draft.enrollment,
      lessonMode,
      slotKeys: selectedKeys.slice().sort(),
      matriculatedAt:
        draft.enrollment.matriculatedAt || new Date().toISOString().slice(0, 10),
    }
  }

  const commitDraft = (): Student | null => {
    const en = buildEnrollment()
    if (!en) {
      window.alert('Preencha curso, professor, desconto e selecione os horários corretamente.')
      return null
    }
    if (minor) {
      const r = draft.responsavel
      if (!r?.nome || !r.parentesco || !r.profissao || !r.cpf || !r.contato || !r.endereco) {
        window.alert(
          'Para menores de 18 anos, preencha todos os dados do responsável (incluindo endereço).',
        )
        return null
      }
    }
    return {
      ...draft,
      enrollment: en,
      responsavel: minor ? draft.responsavel : undefined,
    }
  }

  const resetToBaseline = () => {
    setDraft(cloneStudent(baseline))
    setLessonMode(baseline.enrollment?.lessonMode ?? '60x1')
    setSelectedKeys(baseline.enrollment?.slotKeys.slice().sort() ?? [])
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {mode === 'novo' ? 'Nova matrícula' : 'Editar matrícula'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Fluxo: Curso → Professor disponível → Modalidade de aula → Horários. Integração automática com a
          grade do professor.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Identificação do aluno</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Nome completo
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Código (XX.XXX)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.codigo}
              onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))}
            />
            {!isValidStudentCode(draft.codigo) && (
              <span className="mt-1 block text-xs text-amber-700">Formato esperado: 99.999</span>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nascimento
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.dataNascimento}
              onChange={(e) => {
                const dataNascimento = e.target.value
                setDraft((d) => {
                  const a = calcAgeYears(dataNascimento)
                  const isMinor = a !== null && a < 18
                  return {
                    ...d,
                    dataNascimento,
                    responsavel: isMinor ? (d.responsavel ?? emptyResponsible()) : undefined,
                  }
                })
              }}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Idade: {age !== null ? `${age} anos` : '—'}
            </span>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Filiação
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.filiacao}
              onChange={(e) => setDraft((d) => ({ ...d, filiacao: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            RG
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.rg}
              onChange={(e) => setDraft((d) => ({ ...d, rg: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            CPF
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.cpf}
              onChange={(e) => setDraft((d) => ({ ...d, cpf: e.target.value }))}
            />
          </label>
        </div>
      </section>

      {minor && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-amber-950">Dados do responsável (obrigatório)</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(() => {
              const r = draft.responsavel ?? emptyResponsible()
              const patch = (p: Partial<Responsible>) =>
                setDraft((d) => ({ ...d, responsavel: { ...r, ...p } }))
              return (
                <>
                  <label className="text-sm font-medium text-slate-800">
                    Nome
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.nome}
                      onChange={(e) => patch({ nome: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Parentesco
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.parentesco}
                      onChange={(e) => patch({ parentesco: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Profissão
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.profissao}
                      onChange={(e) => patch({ profissao: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    RG
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.rg}
                      onChange={(e) => patch({ rg: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    CPF
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.cpf}
                      onChange={(e) => patch({ cpf: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Contato
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.contato}
                      onChange={(e) => patch({ contato: e.target.value })}
                    />
                  </label>
                  <label className="md:col-span-2 text-sm font-medium text-slate-800">
                    Endereço
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.endereco}
                      onChange={(e) => patch({ endereco: e.target.value })}
                    />
                  </label>
                </>
              )
            })()}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Curso e financeiro da matrícula</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Curso (instrumento · estágio)
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.enrollment?.courseId ?? ''}
              onChange={(e) => {
                const courseId = e.target.value
                const course = state.courses.find((c) => c.id === courseId)
                setDraft((d) => {
                  let teacherId = d.enrollment?.teacherId ?? ''
                  if (course && teacherId) {
                    const t = state.teachers.find((x) => x.id === teacherId)
                    if (!t?.instrumentSlugs.includes(course.instrument)) teacherId = ''
                  }
                  return {
                    ...d,
                    enrollment: {
                      courseId,
                      teacherId,
                      lessonMode,
                      slotKeys: [],
                      discountPercent: d.enrollment?.discountPercent ?? 0,
                      matriculatedAt: d.enrollment?.matriculatedAt ?? '',
                    },
                  }
                })
                setSelectedKeys([])
              }}
            >
              <option value="">Selecione…</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.instrumentLabel} — {c.stage}º estágio — R${c.monthlyPrice.toFixed(0)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Professor
            <select
              disabled={!draft.enrollment?.courseId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              value={draft.enrollment?.teacherId ?? ''}
              onChange={(e) => {
                const teacherId = e.target.value
                const courseId = draft.enrollment?.courseId ?? ''
                setDraft((d) => ({
                  ...d,
                  enrollment: {
                    courseId,
                    teacherId,
                    lessonMode,
                    slotKeys: [],
                    discountPercent: d.enrollment?.discountPercent ?? 0,
                    matriculatedAt: d.enrollment?.matriculatedAt ?? '',
                  },
                }))
                setSelectedKeys([])
              }}
            >
              <option value="">Selecione…</option>
              {teachersForCourse.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome || 'Sem nome'}
                </option>
              ))}
            </select>
            {draft.enrollment?.courseId && teachersForCourse.length === 0 && (
              <p className="mt-2 text-xs text-amber-800">
                Nenhum professor leciona este instrumento. Edite um professor e marque o instrumento em
                &quot;Instrumentos que leciona&quot;.
              </p>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Modalidade
            <select
              disabled={!draft.enrollment?.teacherId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              value={lessonMode}
              onChange={(e) => {
                const m = e.target.value as LessonMode
                setLessonMode(m)
                setSelectedKeys([])
                setDraft((d) =>
                  d.enrollment ? { ...d, enrollment: { ...d.enrollment, lessonMode: m, slotKeys: [] } } : d,
                )
              }}
            >
              <option value="60x1">Opção A — 1× 60 minutos semanais</option>
              <option value="30x2">Opção B — 2× 30 minutos semanais</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Desconto na mensalidade
            <select
              disabled={!draft.enrollment?.courseId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
              value={String(draft.enrollment?.discountPercent ?? 0)}
              title="Desconto aplicado na mensalidade e no financeiro"
              onChange={(e) => {
                const discountPercent = Number(e.target.value) as 0 | 5 | 10
                setDraft((d) =>
                  d.enrollment ? { ...d, enrollment: { ...d.enrollment, discountPercent } } : d,
                )
              }}
            >
              <option value="0">Sem desconto</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
            </select>
          </label>
        </div>
      </section>

      {draft.enrollment?.courseId && draft.enrollment.teacherId && teacher && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Seleção de horários na grade do professor</h3>
          <p className="text-sm text-slate-600">
            Selecionados:{' '}
            <strong>
              {selectedKeys.length
                ? selectedKeys.map((k) => formatSlotKeyLabel(k)).join(' · ')
                : 'nenhum'}
            </strong>
          </p>
          <ScheduleGrid
            mode="pick"
            pickingStudentId={draft.id}
            schedule={teacher.schedule}
            onToggle={(key) => pickSlot(key)}
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <FormActions
          saveLabel="Salvar matrícula"
          cancelLabel="Cancelar"
          onCancel={() => {
            resetToBaseline()
            onCancelNavigate()
          }}
          onSave={() => {
            if (!isValidStudentCode(draft.codigo)) {
              window.alert('Ajuste o código no formato XX.XXX')
              return
            }
            const next = commitDraft()
            if (!next) return
            const enrollment = buildEnrollment()
            if (!enrollment) return
            const toSave: Student = { ...next, enrollment }
            const result = saveStudent(toSave)
            if (!result.ok) {
              window.alert(result.message)
              return
            }
            const t = getTeacher(enrollment.teacherId)
            const c = getCourse(enrollment.courseId)
            if (t && c && window.confirm('Gerar contrato em PDF agora?')) {
              generateEnrollmentContractPdf(toSave, t, c)
            }
            onDone()
          }}
        />
        {draft.enrollment && teacher && getCourse(draft.enrollment.courseId) && (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={() => {
              const en = buildEnrollment()
              if (!en) {
                window.alert('Complete a matrícula antes de gerar o PDF.')
                return
              }
              const t = getTeacher(en.teacherId)
              const c = getCourse(en.courseId)
              if (!t || !c) return
              generateEnrollmentContractPdf({ ...draft, enrollment: en }, t, c)
            }}
          >
            Gerar contrato (PDF)
          </button>
        )}
      </div>
    </div>
  )
}
