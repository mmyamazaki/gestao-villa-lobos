import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { normalizeBirthToIso } from '../domain/age'
import { buildDefaultCourses } from '../domain/coursesCatalog'
import { buildTwelveMensalidades } from '../domain/installments'
import {
  allSlotLabels,
  canStart60MinuteLesson,
  canonicalLessonLogSlotKey,
  createEmptySchedule,
  slotKey,
  sixtyMinutePairKeys,
  sortSlotKeys,
} from '../domain/schedule'
import { shouldStudentOccupyScheduleSlot } from '../domain/studentStatus'
import type {
  ClassSessionLog,
  Course,
  MensalidadeRegistrada,
  MensalidadeStatus,
  ReplacementClass,
  SchoolSettings,
  SchoolState,
  Student,
  StudentStatus,
  Teacher,
} from '../domain/types'
import type { ScheduleMap } from '../domain/types'
import { ensureSchedule } from './schoolUtils'

const STORAGE_KEY = 'emvl-musica-villa-lobos-v1'

function uniqueInstrumentSlugs(courses: Course[]) {
  return [...new Set(courses.map((c) => c.instrument))]
}

function normalizeState(raw: Partial<SchoolState> | null): SchoolState {
  let courses = raw?.courses?.length ? raw!.courses : buildDefaultCourses()
  courses = courses.map((c) => ({ ...c }))
  const fallbackSlugs = uniqueInstrumentSlugs(courses)
  const teachers = (raw?.teachers ?? []).map((t) => ({
    ...t,
    email: typeof t.email === 'string' ? t.email : '',
    celular: typeof t.celular === 'string' ? t.celular : '',
    login: typeof t.login === 'string' ? t.login : '',
    senha: typeof t.senha === 'string' ? t.senha : '',
    instrumentSlugs:
      Array.isArray(t.instrumentSlugs) && t.instrumentSlugs.length > 0
        ? [...t.instrumentSlugs]
        : [...fallbackSlugs],
    schedule: ensureSchedule(t.schedule),
  }))
  const students = (raw?.students ?? []).map((s) => {
    const birthRaw = typeof s.dataNascimento === 'string' ? s.dataNascimento : ''
    const birthIso = normalizeBirthToIso(birthRaw) || birthRaw
    const st = s as Student & {
      dataCancelamento?: string
      observacoesCancelamento?: string
    }
    const status: StudentStatus = st.status === 'inativo' ? 'inativo' : 'ativo'
    return {
      ...s,
      dataNascimento: birthIso,
      status,
      dataCancelamento:
        typeof st.dataCancelamento === 'string' ? st.dataCancelamento.slice(0, 10) : undefined,
      observacoesCancelamento:
        typeof st.observacoesCancelamento === 'string' ? st.observacoesCancelamento : undefined,
      endereco: typeof s.endereco === 'string' ? s.endereco : '',
      telefone: typeof s.telefone === 'string' ? s.telefone : '',
      email: typeof s.email === 'string' ? s.email : '',
      login: typeof s.login === 'string' ? s.login : '',
      senha: typeof s.senha === 'string' ? s.senha : '',
      enrollment: s.enrollment ? { ...s.enrollment, slotKeys: [...s.enrollment.slotKeys] } : null,
    }
  })
  const mensalidades: MensalidadeRegistrada[] = (raw?.mensalidades ?? []).map((m) => {
    const ref = m.referenceMonth ?? ''
    const due =
      typeof m.dueDate === 'string' && m.dueDate.length >= 8
        ? m.dueDate.slice(0, 10)
        : `${ref}-01`
    const parcelNumber =
      typeof m.parcelNumber === 'number' && m.parcelNumber >= 1 ? m.parcelNumber : 1
    const waives =
      typeof m.waivesLateFees === 'boolean'
        ? m.waivesLateFees
        : parcelNumber === 1 && (m.discountPercent === 0 || m.discountPercent === undefined)
    const paidAt =
      typeof m.paidAt === 'string' && m.paidAt.length >= 8 ? m.paidAt.slice(0, 10) : undefined
    let status: MensalidadeStatus
    if (paidAt) {
      status = 'pago'
    } else if (m.status === 'cancelado' || m.status === 'pago' || m.status === 'pendente') {
      status = m.status
    } else {
      status = 'pendente'
    }
    return {
      ...m,
      parcelNumber,
      dueDate: due,
      waivesLateFees: waives,
      paidAt,
      status,
    }
  })
  const rawLogs: ClassSessionLog[] = (raw?.lessonLogs ?? []).map((l) => ({ ...l }))
  const lessonLogs = normalizeLessonLogs(students, rawLogs)
  const replacementClasses: ReplacementClass[] = (raw?.replacementClasses ?? []).map((r) => ({
    ...r,
    date: typeof r.date === 'string' ? r.date.slice(0, 10) : '',
    startTime: typeof r.startTime === 'string' ? r.startTime.slice(0, 5) : '',
    duration: r.duration === 60 ? 60 : 30,
    status: r.status === 'realizada' || r.status === 'faltou' ? r.status : 'agendada',
    content: typeof r.content === 'string' ? r.content : '',
    present: typeof r.present === 'boolean' ? r.present : undefined,
  }))
  const settings = raw?.settings ?? { observacoesInternas: '' }
  return reconcileTeacherSchedulesWithStudents({
    courses,
    teachers,
    students,
    mensalidades,
    lessonLogs,
    replacementClasses,
    settings: { ...settings },
  })
}

function normalizeLessonLogs(students: Student[], logs: ClassSessionLog[]): ClassSessionLog[] {
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

function seedTeachers(): Teacher[] {
  const slugs = uniqueInstrumentSlugs(buildDefaultCourses())
  const mk = (
    nome: string,
    id: string,
    login: string,
    email: string,
  ): Teacher => ({
    id,
    nome,
    dataNascimento: '1985-06-15',
    naturalidade: 'Porto Velho - RO',
    filiacao: '—',
    rg: '',
    cpf: '',
    endereco: 'Porto Velho, RO',
    contatos: '(69) 90000-0000',
    email,
    celular: '(69) 90000-0000',
    login,
    senha: 'prof123',
    instrumentSlugs: [...slugs],
    schedule: ensureSchedule(createEmptySchedule() as ScheduleMap),
  })
  return [
    mk('Helena Prado', 'teacher-1', 'helena.prado', 'helena.prado@emvl.local'),
    mk('Ricardo Mendes', 'teacher-2', 'ricardo.mendes', 'ricardo.mendes@emvl.local'),
  ]
}

function loadRaw(): Partial<SchoolState> | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return null
    return JSON.parse(s) as Partial<SchoolState>
  } catch {
    return null
  }
}

function saveRaw(st: SchoolState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st))
}

function clearStudentFromAllSchedules(teachers: Teacher[], studentId: string): Teacher[] {
  return teachers.map((t) => {
    const sch = { ...t.schedule }
    let changed = false
    for (const k of Object.keys(sch)) {
      const cell = sch[k]
      if (cell?.status === 'busy' && cell.studentId === studentId) {
        sch[k] = { status: 'free' }
        changed = true
      }
    }
    return changed ? { ...t, schedule: sch } : t
  })
}

/** Alinha grades com regras de cancelamento (data) e matrículas ativas. */
function reconcileTeacherSchedulesWithStudents(state: SchoolState): SchoolState {
  const today = new Date().toISOString().slice(0, 10)
  let teachers: Teacher[] = state.teachers.map((t) => ({
    ...t,
    schedule: { ...t.schedule },
  }))

  for (let ti = 0; ti < teachers.length; ti++) {
    const t = teachers[ti]!
    const sch = { ...t.schedule }
    for (const k of Object.keys(sch)) {
      const c = sch[k]
      if (c?.status !== 'busy') continue
      const st = state.students.find((s) => s.id === c.studentId)
      if (!st || !shouldStudentOccupyScheduleSlot(st, today)) {
        sch[k] = { status: 'free' }
      }
    }
    teachers[ti] = { ...t, schedule: sch }
  }

  for (const s of state.students) {
    if (!s.enrollment || !shouldStudentOccupyScheduleSlot(s, today)) continue
    const tIdx = teachers.findIndex((x) => x.id === s.enrollment!.teacherId)
    if (tIdx < 0) continue
    const courseLabel = state.courses.find((c) => c.id === s.enrollment!.courseId)?.instrumentLabel
    const t = teachers[tIdx]!
    teachers[tIdx] = bookSlotsOnTeacher(t, s, s.enrollment.slotKeys, courseLabel)
  }

  return { ...state, teachers }
}

function assertSlotsBookable(
  schedule: ScheduleMap,
  slotKeys: string[],
  studentId: string,
) {
  for (const k of slotKeys) {
    const cell = schedule[k]
    if (!cell) throw new Error(`Horário inválido: ${k}`)
    if (cell.status === 'unavailable') throw new Error(`Horário indisponível: ${k}`)
    if (cell.status === 'busy' && cell.studentId !== studentId) {
      throw new Error(`Conflito: horário já ocupado (${k})`)
    }
  }
}

function bookSlotsOnTeacher(
  teacher: Teacher,
  student: Student,
  slotKeys: string[],
  instrumentLabel: string | undefined,
): Teacher {
  const sch = { ...teacher.schedule }
  for (const k of slotKeys) {
    sch[k] = {
      status: 'busy',
      studentId: student.id,
      studentName: student.nome,
      ...(instrumentLabel ? { instrumentLabel } : {}),
    }
  }
  return { ...teacher, schedule: sch }
}

function tryCommitStudent(
  prev: SchoolState,
  draft: Student,
): { state: SchoolState } | { error: string } {
  const teachers = clearStudentFromAllSchedules(prev.teachers, draft.id)
  let students = prev.students.filter((s) => s.id !== draft.id)
  const nextStudent: Student = {
    ...draft,
    enrollment: draft.enrollment
      ? { ...draft.enrollment, slotKeys: [...draft.enrollment.slotKeys] }
      : null,
  }
  students = [...students, nextStudent]

  if (nextStudent.enrollment) {
    const en = nextStudent.enrollment
    const t = teachers.find((x) => x.id === en.teacherId)
    if (!t) return { error: 'Professor não encontrado.' }
    const todayIso = new Date().toISOString().slice(0, 10)
    const occupy = shouldStudentOccupyScheduleSlot(nextStudent, todayIso)
    if (occupy) {
      try {
        assertSlotsBookable(t.schedule, en.slotKeys, nextStudent.id)
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Conflito de horário.' }
      }
      const courseLabel = prev.courses.find((c) => c.id === en.courseId)?.instrumentLabel
      const booked = teachers.map((x) =>
        x.id === t.id
          ? bookSlotsOnTeacher(x, nextStudent, en.slotKeys, courseLabel)
          : x,
      )
      let nextState: SchoolState = { ...prev, teachers: booked, students }
      nextState = replaceMensalidadesForStudent(nextState, nextStudent)
      return { state: nextState }
    }
    let nextState: SchoolState = { ...prev, teachers, students }
    nextState = replaceMensalidadesForStudent(nextState, nextStudent)
    return { state: nextState }
  }

  let nextState: SchoolState = { ...prev, teachers, students }
  nextState = replaceMensalidadesForStudent(nextState, nextStudent)
  return { state: nextState }
}

function replaceMensalidadesForStudent(state: SchoolState, student: Student): SchoolState {
  const withoutStudent = state.mensalidades.filter((m) => m.studentId !== student.id)
  if (!student.enrollment) {
    return { ...state, mensalidades: withoutStudent }
  }
  const en = student.enrollment
  const course = state.courses.find((c) => c.id === en.courseId)
  if (!course) {
    return { ...state, mensalidades: withoutStudent }
  }
  const oldRows = state.mensalidades.filter((m) => m.studentId === student.id)
  const oldByParcel = new Map(oldRows.map((m) => [m.parcelNumber, m]))
  const generatedAt = new Date().toISOString()
  let merged: MensalidadeRegistrada[] = buildTwelveMensalidades(
    student,
    course,
    en,
    generatedAt,
  ).map((r) => {
    const o = oldByParcel.get(r.parcelNumber)
    if (o?.paidAt) {
      return { ...r, id: o.id, paidAt: o.paidAt, status: 'pago' as const }
    }
    if (o?.status === 'cancelado') {
      const today = new Date().toISOString().slice(0, 10)
      if (student.status === 'ativo' && o.dueDate >= today) {
        return { ...r, id: o.id, status: 'pendente' as const }
      }
      return { ...r, id: o.id, status: 'cancelado' as const }
    }
    return { ...r, status: 'pendente' as const }
  })

  if (student.status === 'inativo' && student.dataCancelamento) {
    const dc = student.dataCancelamento.slice(0, 10)
    merged = merged.map((m) => {
      if (m.status === 'pago') return m
      if (m.dueDate > dc) return { ...m, status: 'cancelado' as const }
      return m
    })
  }

  return { ...state, mensalidades: [...withoutStudent, ...merged] }
}

function resyncStudentsAfterTeacherSave(
  students: Student[],
  teacher: Teacher,
): Student[] {
  return students.map((st) => {
    if (st.enrollment?.teacherId !== teacher.id) return st
    const keys = sortSlotKeys(
      Object.entries(teacher.schedule)
        .filter(([, v]) => v.status === 'busy' && v.studentId === st.id)
        .map(([k]) => k),
    )
    if (!st.enrollment) return st
    if (keys.length === 0) {
      if (st.status === 'inativo' && st.enrollment) {
        return st
      }
      return { ...st, enrollment: null }
    }
    return {
      ...st,
      enrollment: { ...st.enrollment, slotKeys: keys },
    }
  })
}

export type SchoolContextValue = {
  state: SchoolState
  persist: () => void
  resetDemoData: () => void
  getCourse: (id: string) => Course | undefined
  getTeacher: (id: string) => Teacher | undefined
  getStudent: (id: string) => Student | undefined
  setCourses: (courses: Course[]) => void
  saveSettings: (settings: SchoolSettings) => void
  saveTeacher: (draft: Teacher) => void
  saveStudent: (draft: Student) => { ok: true } | { ok: false; message: string }
  registerMensalidadePayment: (mensalidadeId: string, paidDate: string) => void
  saveLessonLog: (payload: {
    teacherId: string
    studentId: string
    lessonDate: string
    slotKey: string
    present: boolean
    content: string
    id?: string
  }) => void
  scheduleReplacementClass: (payload: {
    studentId: string
    teacherId: string
    date: string
    startTime: string
    duration: 30 | 60
  }) => { ok: true } | { ok: false; message: string }
  saveReplacementClassResult: (payload: {
    replacementClassId: string
    present: boolean
    content: string
  }) => { ok: true } | { ok: false; message: string }
}

const SchoolContext = createContext<SchoolContextValue | null>(null)

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SchoolState>(() => {
    const raw = loadRaw()
    const n = normalizeState(raw)
    if (!raw?.teachers?.length) {
      return { ...n, teachers: seedTeachers() }
    }
    return n
  })

  useEffect(() => {
    saveRaw(state)
  }, [state])

  const persist = useCallback(() => saveRaw(state), [state])

  const resetDemoData = useCallback(() => {
    const n = normalizeState(null)
    setState({
      ...n,
      teachers: seedTeachers(),
      students: [],
      mensalidades: [],
      lessonLogs: [],
      replacementClasses: [],
      settings: { observacoesInternas: '' },
    })
  }, [])

  const getCourse = useCallback(
    (id: string) => state.courses.find((c) => c.id === id),
    [state.courses],
  )

  const getTeacher = useCallback(
    (id: string) => state.teachers.find((t) => t.id === id),
    [state.teachers],
  )

  const getStudent = useCallback(
    (id: string) => state.students.find((s) => s.id === id),
    [state.students],
  )

  const setCourses = useCallback((courses: Course[]) => {
    setState((prev) => ({ ...prev, courses: courses.map((c) => ({ ...c })) }))
  }, [])

  const saveSettings = useCallback((settings: SchoolSettings) => {
    setState((prev) => ({ ...prev, settings: { ...settings } }))
  }, [])

  const saveTeacher = useCallback((draft: Teacher) => {
    setState((prev) => {
      const savedRow: Teacher = { ...draft, schedule: { ...draft.schedule } }
      const exists = prev.teachers.some((t) => t.id === savedRow.id)
      const teachers = exists
        ? prev.teachers.map((t) => (t.id === savedRow.id ? savedRow : t))
        : [...prev.teachers, savedRow]
      const saved = teachers.find((t) => t.id === savedRow.id)!
      const students = resyncStudentsAfterTeacherSave(prev.students, saved)
      return { ...prev, teachers, students }
    })
  }, [])

  const saveStudent = useCallback((draft: Student) => {
    let err: string | null = null
    setState((prev) => {
      const r = tryCommitStudent(prev, draft)
      if ('error' in r) {
        err = r.error
        return prev
      }
      return r.state
    })
    return err ? { ok: false as const, message: err } : { ok: true as const }
  }, [])

  const registerMensalidadePayment = useCallback((mensalidadeId: string, paidDate: string) => {
    setState((prev) => {
      const target = prev.mensalidades.find((m) => m.id === mensalidadeId)
      if (!target || target.status === 'cancelado') return prev
      const d = paidDate.slice(0, 10)
      return {
        ...prev,
        mensalidades: prev.mensalidades.map((m) =>
          m.id === mensalidadeId ? { ...m, paidAt: d, status: 'pago' as const } : m,
        ),
      }
    })
  }, [])

  const saveLessonLog = useCallback(
    (payload: {
      teacherId: string
      studentId: string
      lessonDate: string
      slotKey: string
      present: boolean
      content: string
      id?: string
    }) => {
      setState((prev) => {
        const student = prev.students.find((s) => s.id === payload.studentId)
        const en = student?.enrollment
        const canonical = en
          ? canonicalLessonLogSlotKey(en.lessonMode, en.slotKeys, payload.slotKey)
          : payload.slotKey
        const pair =
          en?.lessonMode === '60x1' && en.slotKeys.length === 2
            ? sixtyMinutePairKeys(en.slotKeys)
            : new Set<string>([canonical])

        const sibling = prev.lessonLogs.find(
          (l) =>
            l.teacherId === payload.teacherId &&
            l.studentId === payload.studentId &&
            l.lessonDate === payload.lessonDate &&
            pair.has(l.slotKey),
        )

        const filtered = prev.lessonLogs.filter((l) => {
          if (
            l.teacherId !== payload.teacherId ||
            l.studentId !== payload.studentId ||
            l.lessonDate !== payload.lessonDate
          ) {
            return true
          }
          return !pair.has(l.slotKey)
        })

        const id =
          payload.id ??
          sibling?.id ??
          `${payload.teacherId}-${payload.studentId}-${payload.lessonDate}-${canonical}`.replace(
            /\|/g,
            '',
          )

        const row: ClassSessionLog = {
          ...payload,
          slotKey: canonical,
          id,
          updatedAt: new Date().toISOString(),
        }
        return { ...prev, lessonLogs: [...filtered, row] }
      })
    },
    [],
  )

  const scheduleReplacementClass = useCallback(
    (payload: {
      studentId: string
      teacherId: string
      date: string
      startTime: string
      duration: 30 | 60
    }) => {
      let err: string | null = null
      setState((prev) => {
        const student = prev.students.find((s) => s.id === payload.studentId)
        const teacher = prev.teachers.find((t) => t.id === payload.teacherId)
        if (!student || !teacher) {
          err = 'Aluno ou professor não encontrado.'
          return prev
        }
        const date = payload.date.slice(0, 10)
        const labels = allSlotLabels()
        const startIdx = labels.indexOf(payload.startTime)
        if (startIdx < 0) {
          err = 'Horário de início inválido.'
          return prev
        }
        const d = new Date(date + 'T12:00:00')
        const jsDay = d.getDay() // 0 domingo .. 6 sábado
        if (Number.isNaN(jsDay) || jsDay === 0) {
          err = 'Data inválida para a grade (domingo não possui aulas).'
          return prev
        }
        const dayIndex = jsDay - 1 // segunda=0
        const needed =
          payload.duration === 60
            ? [slotKey(dayIndex, startIdx), slotKey(dayIndex, startIdx + 1)]
            : [slotKey(dayIndex, startIdx)]
        if (payload.duration === 60 && !canStart60MinuteLesson(startIdx)) {
          err = 'Para 60 min, selecione um horário com dois blocos consecutivos no mesmo período.'
          return prev
        }
        for (const k of needed) {
          const cell = teacher.schedule[k]
          if (!cell || cell.status !== 'free') {
            err = 'Escolha um horário livre na grade do professor.'
            return prev
          }
        }
        const conflicts = prev.replacementClasses.some((r) => {
          if (r.teacherId !== payload.teacherId || r.date !== date) return false
          const rStart = labels.indexOf(r.startTime)
          if (rStart < 0) return false
          const rKeys = r.duration === 60 ? [rStart, rStart + 1] : [rStart]
          return rKeys.includes(startIdx) || (payload.duration === 60 && rKeys.includes(startIdx + 1))
        })
        if (conflicts) {
          err = 'Já existe reposição nesse horário para este professor.'
          return prev
        }
        const row: ReplacementClass = {
          id: crypto.randomUUID(),
          studentId: student.id,
          studentNome: student.nome,
          teacherId: teacher.id,
          teacherNome: teacher.nome,
          date,
          startTime: payload.startTime,
          duration: payload.duration,
          status: 'agendada',
          content: '',
        }
        return { ...prev, replacementClasses: [...prev.replacementClasses, row] }
      })
      return err ? { ok: false as const, message: err } : { ok: true as const }
    },
    [],
  )

  const saveReplacementClassResult = useCallback(
    (payload: { replacementClassId: string; present: boolean; content: string }) => {
      let err: string | null = null
      setState((prev) => {
        const exists = prev.replacementClasses.some((r) => r.id === payload.replacementClassId)
        if (!exists) {
          err = 'Aula de reposição não encontrada.'
          return prev
        }
        return {
          ...prev,
          replacementClasses: prev.replacementClasses.map((r) =>
            r.id === payload.replacementClassId
              ? {
                  ...r,
                  present: payload.present,
                  content: payload.content.trim(),
                  status: payload.present ? 'realizada' as const : 'faltou' as const,
                }
              : r,
          ),
        }
      })
      return err ? { ok: false as const, message: err } : { ok: true as const }
    },
    [],
  )

  const value = useMemo(
    () => ({
      state,
      persist,
      resetDemoData,
      getCourse,
      getTeacher,
      getStudent,
      setCourses,
      saveSettings,
      saveTeacher,
      saveStudent,
      registerMensalidadePayment,
      saveLessonLog,
      scheduleReplacementClass,
      saveReplacementClassResult,
    }),
    [
      state,
      persist,
      resetDemoData,
      getCourse,
      getTeacher,
      getStudent,
      setCourses,
      saveSettings,
      saveTeacher,
      saveStudent,
      registerMensalidadePayment,
      saveLessonLog,
      scheduleReplacementClass,
      saveReplacementClassResult,
    ],
  )

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

/** App context hook: provider lives in this module alongside `SchoolProvider`. */
export function useSchool() {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider')
  return ctx
}
