import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { calcAgeYears, normalizeBirthToIso } from '../domain/age'
import {
  DAY_LABELS,
  SLOT_COUNT,
  allSlotLabels,
  canStart60MinuteLesson,
  formatSlotKeyLabel,
  formatSixtyMinuteLessonLabel,
  mergeSixtyMinuteSlotPairsForTeacher,
  parse60MinuteBlockFromKeys,
  parseSlotKey,
  slotKey,
  sortSlotKeys,
  valid60MinuteStartSlotIndices,
} from '../domain/schedule'
import { generateStudentCode, isValidStudentCode } from '../domain/studentCode'
import { studentNeedsTeacherReassignment } from '../domain/studentStatus'
import type { LessonMode, Responsible, ScheduleMap, Student } from '../domain/types'
import type { SchoolContextValue } from '../state/SchoolContext'
import { FormActions } from '../components/FormActions'
import { ScheduleGrid, ScheduleLegend } from '../components/ScheduleGrid'
import { useSchool } from '../state/SchoolContext'
import {
  formatCpfBR,
  formatPhoneFlexibleBR,
  formatRgNumericBR,
  isCpfComplete,
  isPhoneBrComplete,
  isRgNumericComplete,
  onlyDigits,
} from '../utils/brMasks'
import { generateEnrollmentContractPdf } from '../utils/generateContractPdf'
import { generateMensalidadeReceiptPdf } from '../utils/generateReceiptPdf'

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
  const birthRaw = b.dataNascimento ?? ''
  const birthIso = normalizeBirthToIso(birthRaw) || birthRaw
  const base: Student = {
    ...b,
    dataNascimento: birthIso,
    endereco: b.endereco ?? '',
    telefone: b.telefone ?? '',
    email: b.email ?? '',
    status: b.status === 'inativo' ? 'inativo' : 'ativo',
    dataCancelamento: b.dataCancelamento,
    observacoesCancelamento: b.observacoesCancelamento,
    responsavel: b.responsavel ? { ...b.responsavel } : undefined,
    enrollment: b.enrollment
      ? {
          ...b.enrollment,
          slotKeys: [...b.enrollment.slotKeys],
          matriculatedAt: (b.enrollment.matriculatedAt || new Date().toISOString().slice(0, 10)).slice(
            0,
            10,
          ),
        }
      : null,
  }
  const a = calcAgeYears(base.dataNascimento)
  if (a !== null && a < 18 && !base.responsavel) {
    return { ...base, responsavel: emptyResponsible() }
  }
  return base
}

function derive30DropdownsFromKeys(keys: string[]): {
  firstDay: number | ''
  firstSlot: number | ''
  secondDay: number | ''
  secondSlot: number | ''
} {
  const empty = {
    firstDay: '' as const,
    firstSlot: '' as const,
    secondDay: '' as const,
    secondSlot: '' as const,
  }
  if (keys.length === 0) return empty
  if (keys.length === 1) {
    const p = parseSlotKey(keys[0])
    return p
      ? {
          firstDay: p.dayIndex,
          firstSlot: p.slotIndex,
          secondDay: '',
          secondSlot: '',
        }
      : empty
  }
  const [k1, k2] = sortSlotKeys(keys)
  const p1 = parseSlotKey(k1)
  const p2 = parseSlotKey(k2)
  if (!p1 || !p2) return empty
  return {
    firstDay: p1.dayIndex,
    firstSlot: p1.slotIndex,
    secondDay: p2.dayIndex,
    secondSlot: p2.slotIndex,
  }
}

export function Matricula() {
  const { id } = useParams()
  const navigate = useNavigate()
  const school = useSchool()

  const [novoStudentId] = useState(() => crypto.randomUUID())
  const [novoCodigo] = useState(() => generateStudentCode())

  const baseline = useMemo((): Student | null => {
    if (id == null || id === '') return null
    if (id === 'novo') {
      return {
        id: novoStudentId,
        codigo: novoCodigo,
        nome: '',
        dataNascimento: '',
        rg: '',
        cpf: '',
        filiacao: '',
        endereco: '',
        telefone: '',
        email: '',
        login: '',
        senha: '',
        status: 'ativo',
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
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [lessonMode, setLessonMode] = useState<LessonMode>(
    () => baseline.enrollment?.lessonMode ?? '60x1',
  )
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    () => sortSlotKeys(baseline.enrollment?.slotKeys ?? []),
  )
  const [sixtyDay, setSixtyDay] = useState<number | ''>('')
  const [sixtyStartSlot, setSixtyStartSlot] = useState<number | ''>('')
  const baselineSlotKeysSorted = useMemo(
    () => sortSlotKeys(baseline.enrollment?.slotKeys ?? []),
    [baseline.enrollment?.slotKeys],
  )
  const baseline30 = useMemo(() => {
    const m = baseline.enrollment?.lessonMode ?? '60x1'
    const keys = m === '30x2' ? baselineSlotKeysSorted : []
    return derive30DropdownsFromKeys(keys)
  }, [baseline.enrollment?.lessonMode, baselineSlotKeysSorted])
  /** Opção B — primeira aula 30 min */
  const [thirtyFirstDay, setThirtyFirstDay] = useState<number | ''>(
    () => baseline30.firstDay,
  )
  const [thirtyFirstSlot, setThirtyFirstSlot] = useState<number | ''>(
    () => baseline30.firstSlot,
  )
  /** Opção B — segunda aula 30 min */
  const [thirtySecondDay, setThirtySecondDay] = useState<number | ''>(
    () => baseline30.secondDay,
  )
  const [thirtySecondSlot, setThirtySecondSlot] = useState<number | ''>(
    () => baseline30.secondSlot,
  )

  const resetSchedulePicks = () => {
    setSelectedKeys([])
    setSixtyDay('')
    setSixtyStartSlot('')
    setThirtyFirstDay('')
    setThirtyFirstSlot('')
    setThirtySecondDay('')
    setThirtySecondSlot('')
  }

  const age = calcAgeYears(draft.dataNascimento)
  const minor = age !== null && age < 18
  const teacher = draft.enrollment ? getTeacher(draft.enrollment.teacherId) : undefined

  // Mantém `dataNascimento` sempre no formato ISO quando possível,
  // para que `calcAgeYears()` funcione corretamente e o campo do responsável apareça/oculte na hora.
  useEffect(() => {
    const norm = normalizeBirthToIso(draft.dataNascimento)
    if (!norm) return
    if (norm === draft.dataNascimento) return
    setDraft((d) => ({ ...d, dataNascimento: norm }))
  }, [draft.dataNascimento])

  const selectedCourse = draft.enrollment?.courseId
    ? state.courses.find((c) => c.id === draft.enrollment!.courseId)
    : undefined

  const teachersForCourse = useMemo(() => {
    if (!selectedCourse) return []
    return state.teachers.filter((t) =>
      (t.instrumentSlugs ?? []).includes(selectedCourse.instrument),
    )
  }, [state.teachers, selectedCourse])

  useEffect(() => {
    const a = calcAgeYears(draft.dataNascimento)
    if (a === null || a >= 18) return
    setDraft((d) =>
      d.responsavel ? d : { ...d, responsavel: emptyResponsible() },
    )
  }, [draft.dataNascimento])

  useEffect(() => {
    if (lessonMode !== '60x1') {
      setSixtyDay('')
      setSixtyStartSlot('')
      return
    }
    const b = parse60MinuteBlockFromKeys(selectedKeys)
    if (b) {
      setSixtyDay(b.dayIndex)
      setSixtyStartSlot(b.slotIndex)
    }
  }, [lessonMode, selectedKeys])

  const slotLabels = useMemo(() => allSlotLabels(), [])

  const timeOptionsForDay = useMemo(() => {
    if (sixtyDay === '' || !teacher) return []
    return valid60MinuteStartSlotIndices().filter((slotIndex) => {
      const k1 = slotKey(sixtyDay, slotIndex)
      const k2 = slotKey(sixtyDay, slotIndex + 1)
      for (const key of [k1, k2]) {
        const cell = teacher.schedule[key]
        if (cell?.status === 'unavailable') return false
        if (cell?.status === 'busy' && cell.studentId !== draft.id) return false
      }
      return true
    })
  }, [sixtyDay, teacher, draft.id])

  const thirtyFirstTimeOptions = useMemo(() => {
    if (thirtyFirstDay === '' || !teacher) return []
    const exclude = new Set<string>()
    if (thirtySecondDay !== '' && thirtySecondSlot !== '') {
      exclude.add(slotKey(thirtySecondDay, thirtySecondSlot))
    }
    const r: number[] = []
    for (let s = 0; s < SLOT_COUNT; s++) {
      const k = slotKey(thirtyFirstDay, s)
      if (exclude.has(k)) continue
      const cell = teacher.schedule[k]
      if (cell?.status === 'unavailable') continue
      if (cell?.status === 'busy' && cell.studentId !== draft.id) continue
      r.push(s)
    }
    return r
  }, [thirtyFirstDay, thirtySecondDay, thirtySecondSlot, teacher, draft.id])

  const thirtySecondTimeOptions = useMemo(() => {
    if (
      thirtySecondDay === '' ||
      !teacher ||
      thirtyFirstDay === '' ||
      thirtyFirstSlot === ''
    ) {
      return []
    }
    const ka = slotKey(thirtyFirstDay, thirtyFirstSlot)
    const exclude = new Set<string>([ka])
    const r: number[] = []
    for (let s = 0; s < SLOT_COUNT; s++) {
      const k = slotKey(thirtySecondDay, s)
      if (exclude.has(k)) continue
      const cell = teacher.schedule[k]
      if (cell?.status === 'unavailable') continue
      if (cell?.status === 'busy' && cell.studentId !== draft.id) continue
      r.push(s)
    }
    return r
  }, [thirtySecondDay, thirtyFirstDay, thirtyFirstSlot, teacher, draft.id])

  const first30Complete = thirtyFirstDay !== '' && thirtyFirstSlot !== ''

  const commit30x2Selection = (
    fd: number | '',
    fs: number | '',
    sd: number | '',
    ss: number | '',
  ) => {
    if (!teacher) return
    const t = teacher
    const toKey = (day: number | '', slot: number | ''): string | null => {
      if (day === '' || slot === '') return null
      const k = slotKey(day, slot)
      const cell = t.schedule[k]
      if (cell?.status === 'unavailable') {
        window.alert('Este horário está indisponível na grade do professor.')
        return null
      }
      if (cell?.status === 'busy' && cell.studentId !== draft.id) {
        window.alert('Horário já ocupado por outro aluno.')
        return null
      }
      return k
    }
    const ka = toKey(fd, fs)
    const kb = toKey(sd, ss)
    if (!ka && !kb) {
      setSelectedKeys([])
      return
    }
    if (ka && kb) {
      if (ka === kb) {
        window.alert('As duas aulas precisam ser em horários diferentes.')
        return
      }
      setSelectedKeys(sortSlotKeys([ka, kb]))
      return
    }
    if (ka) {
      setSelectedKeys([ka])
      return
    }
    setSelectedKeys([])
  }

  const displaySchedule = useMemo((): ScheduleMap => {
    if (!teacher) return {}
    const base: ScheduleMap = { ...teacher.schedule }
    const inst = selectedCourse?.instrumentLabel
    const name = draft.nome.trim() || '(Prévia na grade)'
    const isSixty = lessonMode === '60x1' && selectedKeys.length === 2
    const [k0] = isSixty ? sortSlotKeys(selectedKeys) : []
    for (const k of selectedKeys) {
      const orig = base[k]
      if (!orig || orig.status === 'unavailable') continue
      if (orig.status === 'busy' && orig.studentId !== draft.id) continue
      base[k] = {
        status: 'busy',
        studentId: draft.id,
        studentName: isSixty ? (k === k0 ? name : '') : name,
        ...((inst && (!isSixty || k === k0)) ? { instrumentLabel: inst } : {}),
      }
    }
    return base
  }, [teacher, lessonMode, selectedKeys, selectedCourse?.instrumentLabel, draft.id, draft.nome])

  const mergeSlotKeysForPick = useMemo(() => {
    const tid = draft.enrollment?.teacherId
    if (!tid) return [] as string[][]
    const fromOthers = mergeSixtyMinuteSlotPairsForTeacher(
      state.students.filter((s) => s.id !== draft.id),
      tid,
    )
    const fromDraft =
      lessonMode === '60x1' && selectedKeys.length === 2 ? [sortSlotKeys(selectedKeys)] : []
    const sig = (p: string[]) => p.join('|')
    const seen = new Set(fromOthers.map(sig))
    const out = [...fromOthers]
    for (const p of fromDraft) {
      const s = sig(p)
      if (!seen.has(s)) {
        out.push(p)
        seen.add(s)
      }
    }
    return out
  }, [draft.enrollment?.teacherId, draft.id, state.students, lessonMode, selectedKeys])

  const tryApply60Minute = (dayIndex: number, startSlot: number) => {
    if (!draft.enrollment) return
    const t = getTeacher(draft.enrollment.teacherId)
    if (!t) return
    if (!canStart60MinuteLesson(startSlot)) {
      window.alert(
        'Para 1×60min, escolha um horário cuja segunda metade esteja no mesmo período (manhã ou tarde).',
      )
      return
    }
    const k1 = slotKey(dayIndex, startSlot)
    const k2 = slotKey(dayIndex, startSlot + 1)
    for (const key of [k1, k2]) {
      const cell = t.schedule[key]
      if (cell?.status === 'unavailable') {
        window.alert('Um dos blocos está indisponível na grade do professor.')
        return
      }
      if (cell?.status === 'busy' && cell.studentId !== draft.id) {
        window.alert('Horário já ocupado por outro aluno.')
        return
      }
    }
    setSelectedKeys(sortSlotKeys([k1, k2]))
  }

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
      if (selectedKeys.length === 2) {
        const [p0, p1] = sortSlotKeys(selectedKeys)
        if (key === p0 || key === p1) {
          setSelectedKeys([])
          return
        }
      }
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
      setSelectedKeys(sortSlotKeys([key, k2]))
      return
    }

    const set = new Set(selectedKeys)
    if (set.has(key)) {
      set.delete(key)
    } else if (set.size < 2) {
      set.add(key)
    } else {
      window.alert('No modo 2×30min, selecione no máximo dois blocos de 30 minutos.')
      return
    }
    const next = sortSlotKeys([...set])
    const t30 = derive30DropdownsFromKeys(next)
    setThirtyFirstDay(t30.firstDay)
    setThirtyFirstSlot(t30.firstSlot)
    setThirtySecondDay(t30.secondDay)
    setThirtySecondSlot(t30.secondSlot)
    setSelectedKeys(next)
  }

  const buildEnrollment = () => {
    if (!draft.enrollment?.courseId || !draft.enrollment.teacherId) return null
    const mat = (draft.enrollment.matriculatedAt ?? '').trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mat)) return null
    if (!selectedKeys.length) return null
    if (lessonMode === '60x1' && selectedKeys.length !== 2) return null
    if (lessonMode === '30x2' && selectedKeys.length !== 2) return null
    return {
      ...draft.enrollment,
      lessonMode,
      slotKeys: sortSlotKeys(selectedKeys),
      matriculatedAt: mat,
    }
  }

  const commitDraft = (): Student | null => {
    const nextFieldErrors: Record<string, string> = {}
    const matRaw = (draft.enrollment?.matriculatedAt ?? '').trim().slice(0, 10)
    const matOk = /^\d{4}-\d{2}-\d{2}$/.test(matRaw)
    const hasCourseTeacher =
      Boolean(draft.enrollment?.courseId) && Boolean(draft.enrollment?.teacherId)
    const en = buildEnrollment()
    if (!en) {
      if (hasCourseTeacher && !matOk) {
        nextFieldErrors.matriculatedAt =
          'Informe a data da matrícula (inclusive retroativa, para cadastro de alunos já existentes).'
      } else {
        nextFieldErrors.enrollment =
          'Preencha curso, professor, data da matrícula, desconto e selecione os horários corretamente.'
      }
    }
    if (!draft.nome.trim()) {
      nextFieldErrors.nome = 'Informe o nome completo do aluno.'
    }
    const ageYears = calcAgeYears(draft.dataNascimento)
    const requireStudentCpfRg = ageYears === null || ageYears >= 18
    if (requireStudentCpfRg) {
      if (!isCpfComplete(draft.cpf)) {
        nextFieldErrors.cpf = 'CPF do aluno incompleto (11 dígitos).'
      }
      if (!isRgNumericComplete(draft.rg)) {
        nextFieldErrors.rg = 'RG do aluno incompleto (6 a 9 dígitos numéricos).'
      }
    } else {
      const cpfN = onlyDigits(draft.cpf).length
      if (cpfN > 0 && cpfN !== 11) {
        nextFieldErrors.cpf = 'Se informar CPF, use os 11 dígitos.'
      }
      const rgN = onlyDigits(draft.rg).length
      if (rgN > 0 && !isRgNumericComplete(draft.rg)) {
        nextFieldErrors.rg = 'Se informar RG, use entre 6 e 9 dígitos numéricos.'
      }
    }
    if (!isPhoneBrComplete(draft.telefone)) {
      nextFieldErrors.telefone = 'Telefone do aluno incompleto (10 dígitos fixo ou 11 celular).'
    }
    if (
      !draft.endereco.trim() ||
      !draft.email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
    ) {
      if (!draft.endereco.trim()) nextFieldErrors.endereco = 'Preencha o endereço completo.'
      if (!draft.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
        nextFieldErrors.email = 'Informe um e-mail válido.'
      }
    }
    if (!draft.login.trim() || !draft.senha) {
      if (!draft.login.trim()) nextFieldErrors.login = 'Informe o login do aluno.'
      if (!draft.senha) nextFieldErrors.senha = 'Informe a senha do aluno.'
    }
    const lu = draft.login.trim().toLowerCase()
    const dupLogin = state.students.some(
      (s) => s.id !== draft.id && s.login.trim().toLowerCase() === lu,
    )
    if (dupLogin) {
      nextFieldErrors.login = 'Já existe outro aluno com este login.'
    }
    if (minor) {
      const r = draft.responsavel
      if (!r) {
        nextFieldErrors.responsavel = 'Dados do responsável não encontrados.'
      } else {
        if (!r.nome.trim()) {
          nextFieldErrors.responsavelNome = 'Informe o nome do responsável.'
        }
        if (!isCpfComplete(r.cpf)) {
          nextFieldErrors.responsavelCpf = 'CPF do responsável incompleto (11 dígitos).'
        }
        if (!isPhoneBrComplete(r.contato)) {
          nextFieldErrors.responsavelContato =
            'Telefone do responsável incompleto (10 ou 11 dígitos com DDD).'
        }
      }
    }
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) {
      const msg = 'Formulário inválido. Revise os campos destacados em vermelho antes de salvar.'
      setFormError(msg)
      window.alert(msg)
      return null
    }
    if (!en) return null
    return {
      ...draft,
      login: draft.login.trim(),
      enrollment: en,
      responsavel: minor ? draft.responsavel : undefined,
    }
  }

  const resetToBaseline = () => {
    setDraft(cloneStudent(baseline))
    const m = baseline.enrollment?.lessonMode ?? '60x1'
    setLessonMode(m)
    const keys = sortSlotKeys(baseline.enrollment?.slotKeys ?? [])
    setSelectedKeys(keys)
    setSixtyDay('')
    setSixtyStartSlot('')
    if (m === '30x2') {
      const t30 = derive30DropdownsFromKeys(keys)
      setThirtyFirstDay(t30.firstDay)
      setThirtyFirstSlot(t30.firstSlot)
      setThirtySecondDay(t30.secondDay)
      setThirtySecondSlot(t30.secondSlot)
    } else {
      setThirtyFirstDay('')
      setThirtyFirstSlot('')
      setThirtySecondDay('')
      setThirtySecondSlot('')
    }
  }

  return (
    <div className="space-y-8">
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {formError}
        </div>
      )}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {mode === 'novo' ? 'Nova matrícula' : 'Editar matrícula'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Fluxo: Curso → Professor disponível → Modalidade de aula → Horários. Integração automática com a
          grade do professor.
        </p>
      </div>

      {mode === 'edit' && studentNeedsTeacherReassignment(draft, state.teachers) && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Professor e horários precisam ser definidos de novo</p>
          <p className="mt-1 text-amber-900/95">
            Este aluno está sem professor válido na matrícula. Escolha um
            professor disponível para o curso, a modalidade e os horários na grade abaixo; em seguida
            salve.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Identificação do aluno</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Nome completo
            <input
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.nome ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
            />
            {fieldErrors.nome && <span className="mt-1 block text-xs text-red-700">{fieldErrors.nome}</span>}
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
                const raw = e.target.value
                const dataNascimento = normalizeBirthToIso(raw) || raw
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
              Idade (atualizada ao mudar a data): {age !== null ? `${age} anos` : '—'}
            </span>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Filiação <span className="font-normal text-slate-500">(opcional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.filiacao}
              onChange={(e) => setDraft((d) => ({ ...d, filiacao: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            RG
            <input
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.rg ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.rg}
              onChange={(e) => setDraft((d) => ({ ...d, rg: formatRgNumericBR(e.target.value) }))}
            />
            {fieldErrors.rg && <span className="mt-1 block text-xs text-red-700">{fieldErrors.rg}</span>}
            {minor && (
              <span className="mt-1 block text-xs text-slate-500">Opcional para menores de 18 anos.</span>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700">
            CPF
            <input
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.cpf ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.cpf}
              onChange={(e) => setDraft((d) => ({ ...d, cpf: formatCpfBR(e.target.value) }))}
            />
            {fieldErrors.cpf && <span className="mt-1 block text-xs text-red-700">{fieldErrors.cpf}</span>}
            {minor && (
              <span className="mt-1 block text-xs text-slate-500">Opcional para menores de 18 anos.</span>
            )}
          </label>
          <label className="md:col-span-2 text-sm font-medium text-slate-700">
            Endereço completo
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.endereco}
              onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
              placeholder="Rua, número, bairro, cidade…"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Telefone
            <input
              type="tel"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.telefone ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.telefone}
              onChange={(e) =>
                setDraft((d) => ({ ...d, telefone: formatPhoneFlexibleBR(e.target.value) }))
              }
            />
            {fieldErrors.telefone && (
              <span className="mt-1 block text-xs text-red-700">{fieldErrors.telefone}</span>
            )}
          </label>
          <label className="text-sm font-medium text-slate-700">
            E-mail
            <input
              type="email"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.email ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
            {fieldErrors.email && <span className="mt-1 block text-xs text-red-700">{fieldErrors.email}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Login do aluno (portal)
            <input
              autoComplete="username"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.login ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.login}
              onChange={(e) => setDraft((d) => ({ ...d, login: e.target.value }))}
              placeholder="único no sistema"
            />
            {fieldErrors.login && <span className="mt-1 block text-xs text-red-700">{fieldErrors.login}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Senha do aluno (portal)
            <input
              type="password"
              autoComplete="new-password"
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${fieldErrors.senha ? 'border-red-400 bg-red-50/30' : 'border-slate-200'}`}
              value={draft.senha}
              onChange={(e) => setDraft((d) => ({ ...d, senha: e.target.value }))}
            />
            {fieldErrors.senha && <span className="mt-1 block text-xs text-red-700">{fieldErrors.senha}</span>}
          </label>
        </div>
      </section>

      {minor && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-amber-950">Dados do responsável</h3>
          <p className="mt-1 text-sm text-amber-900/90">
            Obrigatórios: nome, telefone e CPF. Os demais campos são opcionais.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(() => {
              const r = draft.responsavel ?? emptyResponsible()
              const patch = (p: Partial<Responsible>) =>
                setDraft((d) => ({ ...d, responsavel: { ...r, ...p } }))
              const errNome = fieldErrors.responsavelNome
              const errCpf = fieldErrors.responsavelCpf
              const errTel = fieldErrors.responsavelContato
              const ringNome = errNome ? 'border-red-400 bg-red-50/30' : 'border-amber-200'
              const ringCpf = errCpf ? 'border-red-400 bg-red-50/30' : 'border-amber-200'
              const ringTel = errTel ? 'border-red-400 bg-red-50/30' : 'border-amber-200'
              return (
                <>
                  <label className="md:col-span-2 text-sm font-medium text-slate-800">
                    Nome <span className="text-red-700">*</span>
                    <input
                      className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${ringNome}`}
                      value={r.nome}
                      onChange={(e) => patch({ nome: e.target.value })}
                    />
                    {errNome && <span className="mt-1 block text-xs text-red-700">{errNome}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Telefone <span className="text-red-700">*</span>
                    <input
                      type="tel"
                      className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${ringTel}`}
                      value={r.contato}
                      onChange={(e) => patch({ contato: formatPhoneFlexibleBR(e.target.value) })}
                    />
                    {errTel && <span className="mt-1 block text-xs text-red-700">{errTel}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    CPF <span className="text-red-700">*</span>
                    <input
                      className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 ${ringCpf}`}
                      value={r.cpf}
                      onChange={(e) => patch({ cpf: formatCpfBR(e.target.value) })}
                    />
                    {errCpf && <span className="mt-1 block text-xs text-red-700">{errCpf}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Parentesco <span className="font-normal text-slate-500">(opcional)</span>
                    <select
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.parentesco}
                      onChange={(e) => patch({ parentesco: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      <option value="Pai">Pai</option>
                      <option value="Mãe">Mãe</option>
                      <option value="Avós">Avós</option>
                      <option value="Responsável legal">Responsável legal</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Profissão <span className="font-normal text-slate-500">(opcional)</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.profissao}
                      onChange={(e) => patch({ profissao: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    RG <span className="font-normal text-slate-500">(opcional)</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                      value={r.rg}
                      onChange={(e) => patch({ rg: formatRgNumericBR(e.target.value) })}
                    />
                  </label>
                  <label className="md:col-span-2 text-sm font-medium text-slate-800">
                    Endereço <span className="font-normal text-slate-500">(opcional)</span>
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
                      matriculatedAt:
                        d.enrollment?.matriculatedAt || new Date().toISOString().slice(0, 10),
                    },
                  }
                })
                resetSchedulePicks()
              }}
            >
              <option value="">Selecione…</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.instrumentLabel} - {c.levelLabel} — R${c.monthlyPrice.toFixed(0)}
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
                    matriculatedAt:
                      d.enrollment?.matriculatedAt || new Date().toISOString().slice(0, 10),
                  },
                }))
                resetSchedulePicks()
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
                resetSchedulePicks()
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
          <label className="md:col-span-2 text-sm font-medium text-slate-700">
            Data da matrícula
            <input
              type="date"
              className={`mt-1 w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${fieldErrors.matriculatedAt ? 'border-red-400 bg-red-50/30' : 'border-slate-200'} `}
              disabled={!draft.enrollment?.courseId}
              value={draft.enrollment?.matriculatedAt?.slice(0, 10) ?? ''}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) =>
                  d.enrollment ? { ...d, enrollment: { ...d.enrollment, matriculatedAt: v } } : d,
                )
                setFieldErrors((prev) => ({ ...prev, matriculatedAt: '' }))
              }}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Data exibida no contrato e usada na 1ª parcela (vencimento) e referência das mensalidades.
              Pode ser anterior à data de hoje para cadastros retroativos.
            </span>
            {fieldErrors.matriculatedAt && (
              <span className="mt-1 block text-xs text-red-700">{fieldErrors.matriculatedAt}</span>
            )}
          </label>
        </div>
      </section>

      {draft.enrollment?.courseId && draft.enrollment.teacherId && teacher && (
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Horário da aula</h3>
          <p className="text-sm text-slate-600">
            Com curso, professor e modalidade definidos, escolha dia e horário nos campos abaixo. A grade
            exibe o nome do aluno e o instrumento como ocupado. Você também pode ajustar clicando na grade.
          </p>

          {lessonMode === '60x1' && (
            <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Dia da semana
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                  value={sixtyDay === '' ? '' : String(sixtyDay)}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      setSixtyDay('')
                      setSixtyStartSlot('')
                      setSelectedKeys([])
                      return
                    }
                    setSixtyDay(Number(v))
                    setSixtyStartSlot('')
                    setSelectedKeys([])
                  }}
                >
                  <option value="">Selecione o dia…</option>
                  {DAY_LABELS.map((label, idx) => (
                    <option key={label} value={String(idx)}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Horário inicial (bloco de 60 min)
                <select
                  disabled={sixtyDay === ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                  value={sixtyStartSlot === '' ? '' : String(sixtyStartSlot)}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || sixtyDay === '') {
                      setSixtyStartSlot('')
                      setSelectedKeys([])
                      return
                    }
                    const slot = Number(v)
                    setSixtyStartSlot(slot)
                    tryApply60Minute(sixtyDay, slot)
                  }}
                >
                  <option value="">
                    {sixtyDay === '' ? 'Primeiro escolha o dia…' : 'Selecione o horário…'}
                  </option>
                  {timeOptionsForDay.map((slotIndex) => (
                    <option key={slotIndex} value={String(slotIndex)}>
                      {slotLabels[slotIndex]}
                      {slotLabels[slotIndex + 1]
                        ? ` – ${slotLabels[slotIndex + 1]} (60 min)`
                        : ''}
                    </option>
                  ))}
                </select>
                {sixtyDay !== '' && timeOptionsForDay.length === 0 && (
                  <span className="mt-1 block text-xs text-amber-800">
                    Não há bloco de 60 min livre neste dia na grade deste professor.
                  </span>
                )}
              </label>
            </div>
          )}

          {lessonMode === '30x2' && (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2">
                <p className="md:col-span-2 text-sm font-semibold text-slate-800">
                  Primeira aula (30 min)
                </p>
                <label className="text-sm font-medium text-slate-700">
                  Dia da semana
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
                    value={thirtyFirstDay === '' ? '' : String(thirtyFirstDay)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        setThirtyFirstDay('')
                        setThirtyFirstSlot('')
                        setThirtySecondDay('')
                        setThirtySecondSlot('')
                        setSelectedKeys([])
                        return
                      }
                      const d = Number(v)
                      setThirtyFirstDay(d)
                      setThirtyFirstSlot('')
                      setThirtySecondDay('')
                      setThirtySecondSlot('')
                      setSelectedKeys([])
                    }}
                  >
                    <option value="">Selecione o dia…</option>
                    {DAY_LABELS.map((label, idx) => (
                      <option key={label} value={String(idx)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Horário (bloco de 30 min)
                  <select
                    disabled={thirtyFirstDay === ''}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={thirtyFirstSlot === '' ? '' : String(thirtyFirstSlot)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '' || thirtyFirstDay === '') {
                        setThirtyFirstSlot('')
                        setThirtySecondDay('')
                        setThirtySecondSlot('')
                        commit30x2Selection(thirtyFirstDay, '', '', '')
                        return
                      }
                      const s = Number(v)
                      setThirtyFirstSlot(s)
                      commit30x2Selection(thirtyFirstDay, s, thirtySecondDay, thirtySecondSlot)
                    }}
                  >
                    <option value="">
                      {thirtyFirstDay === '' ? 'Primeiro escolha o dia…' : 'Selecione o horário…'}
                    </option>
                    {thirtyFirstTimeOptions.map((slotIndex) => (
                      <option key={slotIndex} value={String(slotIndex)}>
                        {slotLabels[slotIndex]}
                      </option>
                    ))}
                  </select>
                  {thirtyFirstDay !== '' && thirtyFirstTimeOptions.length === 0 && (
                    <span className="mt-1 block text-xs text-amber-800">
                      Não há blocos de 30 min livres neste dia (verifique a segunda aula ou a grade).
                    </span>
                  )}
                </label>
              </div>

              <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2">
                <p className="md:col-span-2 text-sm font-semibold text-slate-800">
                  Segunda aula (30 min)
                </p>
                <label className="text-sm font-medium text-slate-700">
                  Dia da semana
                  <select
                    disabled={!first30Complete}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={thirtySecondDay === '' ? '' : String(thirtySecondDay)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        setThirtySecondDay('')
                        setThirtySecondSlot('')
                        commit30x2Selection(thirtyFirstDay, thirtyFirstSlot, '', '')
                        return
                      }
                      const d = Number(v)
                      setThirtySecondDay(d)
                      setThirtySecondSlot('')
                      commit30x2Selection(thirtyFirstDay, thirtyFirstSlot, d, '')
                    }}
                  >
                    <option value="">
                      {first30Complete ? 'Selecione o dia…' : 'Conclua a primeira aula antes…'}
                    </option>
                    {DAY_LABELS.map((label, idx) => (
                      <option key={`b-${label}`} value={String(idx)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Horário (bloco de 30 min)
                  <select
                    disabled={!first30Complete || thirtySecondDay === ''}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={thirtySecondSlot === '' ? '' : String(thirtySecondSlot)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '' || thirtySecondDay === '') {
                        setThirtySecondSlot('')
                        commit30x2Selection(thirtyFirstDay, thirtyFirstSlot, thirtySecondDay, '')
                        return
                      }
                      const s = Number(v)
                      setThirtySecondSlot(s)
                      commit30x2Selection(
                        thirtyFirstDay,
                        thirtyFirstSlot,
                        thirtySecondDay,
                        s,
                      )
                    }}
                  >
                    <option value="">
                      {thirtySecondDay === ''
                        ? 'Primeiro escolha o dia da segunda aula…'
                        : 'Selecione o horário…'}
                    </option>
                    {thirtySecondTimeOptions.map((slotIndex) => (
                      <option key={slotIndex} value={String(slotIndex)}>
                        {slotLabels[slotIndex]}
                      </option>
                    ))}
                  </select>
                  {first30Complete &&
                    thirtySecondDay !== '' &&
                    thirtySecondTimeOptions.length === 0 && (
                      <span className="mt-1 block text-xs text-amber-800">
                        Não há outro bloco de 30 min livre neste dia (já usado na primeira aula ou ocupado).
                      </span>
                    )}
                </label>
              </div>
            </div>
          )}

          <ScheduleLegend />
          <p className="text-sm text-slate-600">
            Selecionados:{' '}
            <strong>
              {selectedKeys.length === 0
                ? 'nenhum'
                : lessonMode === '60x1' && selectedKeys.length === 2
                  ? formatSixtyMinuteLessonLabel(selectedKeys)
                  : selectedKeys.map((k) => formatSlotKeyLabel(k)).join(' · ')}
            </strong>
          </p>
          <ScheduleGrid
            mode="pick"
            pickingStudentId={draft.id}
            schedule={displaySchedule}
            mergeSlotKeys={mergeSlotKeysForPick}
            onToggle={(key) => pickSlot(key)}
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <FormActions
          saveLabel="Salvar matrícula"
          savingLabel="Salvando matrícula..."
          cancelLabel="Cancelar"
          isSaving={isSaving}
          onCancel={() => {
            resetToBaseline()
            setFieldErrors({})
            setFormError(null)
            onCancelNavigate()
          }}
          onSave={async () => {
            setFormError(null)
            if (!isValidStudentCode(draft.codigo)) {
              window.alert('Ajuste o código no formato XX.XXX')
              return
            }
            const next = commitDraft()
            if (!next) return
            const enrollment = buildEnrollment()
            if (!enrollment) return
            const toSave: Student = { ...next, enrollment }
            try {
              setIsSaving(true)
              const result = await saveStudent(toSave)
              if (!result.ok) {
                setFormError(result.message)
                window.alert(result.message)
                return
              }
              onDone()
            } catch {
              const msg = 'Erro ao salvar. Verifique sua conexão ou os campos obrigatórios.'
              setFormError(msg)
              window.alert(msg)
            } finally {
              setIsSaving(false)
            }
          }}
        />
        {draft.enrollment && teacher && getCourse(draft.enrollment.courseId) && (
          <>
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
                void generateEnrollmentContractPdf({ ...draft, enrollment: en }, t, c)
              }}
            >
              Gerar contrato (PDF)
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              onClick={() => {
                const first = state.mensalidades.find(
                  (m) => m.studentId === draft.id && m.parcelNumber === 1,
                )
                if (!first) {
                  window.alert(
                    'Não há 1ª parcela para este aluno. Salve a matrícula para gerar as mensalidades; depois use este botão para o recibo de lançamento.',
                  )
                  return
                }
                void generateMensalidadeReceiptPdf(first, { kind: 'launch' })
              }}
            >
              Gerar recibo 1ª parcela (PDF)
            </button>
          </>
        )}
      </div>
    </div>
  )
}
