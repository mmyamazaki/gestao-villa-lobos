import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { applyDiscount } from '../domain/finance'
import { buildDefaultCourses } from '../domain/coursesCatalog'
import { createEmptySchedule } from '../domain/schedule'
import type {
  Course,
  MensalidadeRegistrada,
  SchoolSettings,
  SchoolState,
  Student,
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
    instrumentSlugs:
      Array.isArray(t.instrumentSlugs) && t.instrumentSlugs.length > 0
        ? [...t.instrumentSlugs]
        : [...fallbackSlugs],
    schedule: ensureSchedule(t.schedule),
  }))
  const students = (raw?.students ?? []).map((s) => ({
    ...s,
    enrollment: s.enrollment ? { ...s.enrollment, slotKeys: [...s.enrollment.slotKeys] } : null,
  }))
  const mensalidades: MensalidadeRegistrada[] = (raw?.mensalidades ?? []).map((m) => ({ ...m }))
  const settings = raw?.settings ?? { observacoesInternas: '' }
  return { courses, teachers, students, mensalidades, settings: { ...settings } }
}

function seedTeachers(): Teacher[] {
  const slugs = uniqueInstrumentSlugs(buildDefaultCourses())
  const mk = (nome: string, id: string): Teacher => ({
    id,
    nome,
    dataNascimento: '1985-06-15',
    naturalidade: 'Porto Velho - RO',
    filiacao: '—',
    rg: '',
    cpf: '',
    endereco: 'Porto Velho, RO',
    contatos: '(69) 90000-0000',
    instrumentSlugs: [...slugs],
    schedule: ensureSchedule(createEmptySchedule() as ScheduleMap),
  })
  return [mk('Helena Prado', 'teacher-1'), mk('Ricardo Mendes', 'teacher-2')]
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
): Teacher {
  const sch = { ...teacher.schedule }
  for (const k of slotKeys) {
    sch[k] = { status: 'busy', studentId: student.id, studentName: student.nome }
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
    try {
      assertSlotsBookable(t.schedule, en.slotKeys, nextStudent.id)
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Conflito de horário.' }
    }
    const booked = teachers.map((x) =>
      x.id === t.id ? bookSlotsOnTeacher(x, nextStudent, en.slotKeys) : x,
    )
    let nextState: SchoolState = { ...prev, teachers: booked, students }
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
  const course = state.courses.find((c) => c.id === student.enrollment!.courseId)
  if (!course) {
    return { ...state, mensalidades: withoutStudent }
  }
  const refMonth = student.enrollment.matriculatedAt.slice(0, 7)
  const base = course.monthlyPrice
  const disc = student.enrollment.discountPercent
  const liquid = applyDiscount(base, disc)
  const id = `mens-${student.id}-${refMonth}-${course.id}`
  const row: MensalidadeRegistrada = {
    id,
    studentId: student.id,
    studentNome: student.nome,
    courseId: course.id,
    courseLabel: `${course.instrumentLabel} · ${course.stage}º`,
    referenceMonth: refMonth,
    baseAmount: base,
    discountPercent: disc,
    liquidAmount: liquid,
    generatedAt: new Date().toISOString(),
  }
  return { ...state, mensalidades: [...withoutStudent, row] }
}

function resyncStudentsAfterTeacherSave(
  students: Student[],
  teacher: Teacher,
): Student[] {
  return students.map((st) => {
    if (st.enrollment?.teacherId !== teacher.id) return st
    const keys = Object.entries(teacher.schedule)
      .filter(([, v]) => v.status === 'busy' && v.studentId === st.id)
      .map(([k]) => k)
      .sort()
    if (!st.enrollment) return st
    if (keys.length === 0) {
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
