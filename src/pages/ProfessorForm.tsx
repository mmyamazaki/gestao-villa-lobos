import { useMemo, useState } from 'react'
import type { Course } from '../domain/types'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { calcAgeYears } from '../domain/age'
import { createEmptySchedule, mergeSixtyMinuteSlotPairsForTeacher } from '../domain/schedule'
import type { ScheduleMap, SlotState, Student, Teacher } from '../domain/types'
import { FormActions } from '../components/FormActions'
import { ScheduleGrid, ScheduleLegend } from '../components/ScheduleGrid'
import { useSchool } from '../state/SchoolContext'
import {
  formatCpfBR,
  formatPhoneMobileBR,
  formatRgNumericBR,
  isCpfComplete,
  isMobileComplete,
  isPhoneBrComplete,
  isRgNumericComplete,
  onlyDigits,
} from '../utils/brMasks'
import { ensureSchedule } from '../state/schoolUtils'

function cloneTeacher(t: Teacher): Teacher {
  return {
    ...t,
    instrumentSlugs: [...(t.instrumentSlugs ?? [])],
    schedule: { ...t.schedule },
  }
}

function emptyTeacher(id: string): Teacher {
  return {
    id,
    nome: '',
    dataNascimento: '',
    naturalidade: 'Porto Velho - RO',
    filiacao: '',
    rg: '',
    cpf: '',
    endereco: '',
    contatos: '',
    email: '',
    celular: '',
    login: '',
    senha: '',
    instrumentSlugs: [],
    schedule: ensureSchedule(createEmptySchedule() as ScheduleMap),
  }
}

export function ProfessorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, saveTeacher } = useSchool()
  const students = state.students
  const [novoId] = useState(() => crypto.randomUUID())

  const baseline = useMemo((): Teacher | null => {
    if (id == null || id === '') return null
    if (id === 'novo') return emptyTeacher(novoId)
    return state.teachers.find((t) => t.id === id) ?? null
  }, [id, novoId, state.teachers])

  if (!baseline) return <Navigate to="/professores" replace />

  return (
    <ProfessorFormInner
      key={baseline.id}
      mode={id === 'novo' ? 'novo' : 'edit'}
      baseline={baseline}
      onCancelNavigate={() => navigate('/professores')}
      onDone={() => navigate('/professores')}
      saveTeacher={saveTeacher}
      courses={state.courses}
      allTeachers={state.teachers}
      students={students}
    />
  )
}

function ProfessorFormInner({
  mode,
  baseline,
  onCancelNavigate,
  onDone,
  saveTeacher,
  courses,
  allTeachers,
  students,
}: {
  mode: 'novo' | 'edit'
  baseline: Teacher
  onCancelNavigate: () => void
  onDone: () => void
  saveTeacher: (t: Teacher) => void
  courses: Course[]
  allTeachers: Teacher[]
  students: Student[]
}) {
  const [draft, setDraft] = useState(() => cloneTeacher(baseline))
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const fieldClass = (name: string) =>
    [
      'mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2',
      fieldErrors[name]
        ? 'border-red-400 bg-red-50/30'
        : 'border-slate-200',
    ].join(' ')

  const mergeSlotKeys = useMemo(
    () => mergeSixtyMinuteSlotPairsForTeacher(students, draft.id),
    [students, draft.id],
  )

  const instrumentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of courses) {
      if (!map.has(c.instrument)) map.set(c.instrument, c.instrumentLabel)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [courses])

  const age = calcAgeYears(draft.dataNascimento)

  const toggleInstrument = (slug: string) => {
    setDraft((d) => {
      const set = new Set(d.instrumentSlugs)
      if (set.has(slug)) set.delete(slug)
      else set.add(slug)
      return { ...d, instrumentSlugs: [...set] }
    })
  }

  const onScheduleToggle = (key: string, cell: SlotState) => {
    if (cell.status === 'busy') {
      const ok = window.confirm(
        'Liberar este horário? O vínculo será atualizado na ficha do aluno automaticamente.',
      )
      if (!ok) return
      setDraft((d) => ({
        ...d,
        schedule: { ...d.schedule, [key]: { status: 'free' } },
      }))
      return
    }
    if (cell.status === 'free') {
      setDraft((d) => ({
        ...d,
        schedule: { ...d.schedule, [key]: { status: 'unavailable' } },
      }))
      return
    }
    setDraft((d) => ({
      ...d,
      schedule: { ...d.schedule, [key]: { status: 'free' } },
    }))
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
          {mode === 'novo' ? 'Novo professor' : 'Editar professor'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Marque os <strong>instrumentos</strong> (vinculados aos cursos cadastrados), defina a{' '}
          <strong>grade de horários</strong> e salve. Na matrícula, só aparecem professores compatíveis com o
          curso escolhido.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Dados pessoais</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Nome completo
            <input
              className={fieldClass('nome')}
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
            />
            {fieldErrors.nome && <span className="mt-1 block text-xs text-red-700">{fieldErrors.nome}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Nascimento
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.dataNascimento}
              onChange={(e) => setDraft((d) => ({ ...d, dataNascimento: e.target.value }))}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Idade calculada: {age !== null ? `${age} anos` : '—'}
            </span>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Naturalidade
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.naturalidade}
              onChange={(e) => setDraft((d) => ({ ...d, naturalidade: e.target.value }))}
            />
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
              className={fieldClass('rg')}
              value={draft.rg}
              onChange={(e) => setDraft((d) => ({ ...d, rg: formatRgNumericBR(e.target.value) }))}
            />
            {fieldErrors.rg && <span className="mt-1 block text-xs text-red-700">{fieldErrors.rg}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700">
            CPF
            <input
              className={fieldClass('cpf')}
              value={draft.cpf}
              onChange={(e) => setDraft((d) => ({ ...d, cpf: formatCpfBR(e.target.value) }))}
            />
            {fieldErrors.cpf && <span className="mt-1 block text-xs text-red-700">{fieldErrors.cpf}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Endereço completo
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.endereco}
              onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Contatos (texto livre; se incluir telefone fixo/celular, número completo com DDD)
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.contatos}
              onChange={(e) => setDraft((d) => ({ ...d, contatos: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            E-mail
            <input
              type="email"
              autoComplete="email"
              className={fieldClass('email')}
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
            {fieldErrors.email && <span className="mt-1 block text-xs text-red-700">{fieldErrors.email}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Celular
            <input
              type="tel"
              autoComplete="tel"
              className={fieldClass('celular')}
              value={draft.celular}
              onChange={(e) =>
                setDraft((d) => ({ ...d, celular: formatPhoneMobileBR(e.target.value) }))
              }
            />
            {fieldErrors.celular && (
              <span className="mt-1 block text-xs text-red-700">{fieldErrors.celular}</span>
            )}
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Acesso ao portal do professor</h3>
        <p className="mt-1 text-sm text-slate-600">
          Login e senha usados na tela de entrada do professor (únicos por docente).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Login
            <input
              autoComplete="username"
              className={fieldClass('login')}
              value={draft.login}
              onChange={(e) => setDraft((d) => ({ ...d, login: e.target.value }))}
            />
            {fieldErrors.login && <span className="mt-1 block text-xs text-red-700">{fieldErrors.login}</span>}
          </label>
          <label className="text-sm font-medium text-slate-700">
            Senha
            <input
              type="password"
              autoComplete={mode === 'novo' ? 'new-password' : 'current-password'}
              className={fieldClass('senha')}
              value={draft.senha}
              onChange={(e) => setDraft((d) => ({ ...d, senha: e.target.value }))}
            />
            {fieldErrors.senha && <span className="mt-1 block text-xs text-red-700">{fieldErrors.senha}</span>}
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Instrumentos que leciona</h3>
        <p className="mt-1 text-sm text-slate-600">
          Na matrícula, só aparecem professores que atendem o instrumento do curso escolhido.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {instrumentOptions.length === 0 ? (
            <p className="text-sm text-amber-700">Cadastre cursos em &quot;Cursos&quot; antes.</p>
          ) : (
            instrumentOptions.map(([slug, label]) => (
              <label
                key={slug}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={draft.instrumentSlugs.includes(slug)}
                  onChange={() => toggleInstrument(slug)}
                  className="rounded border-slate-300 text-[#003366] focus:ring-[#00AEEF]"
                />
                <span>{label}</span>
              </label>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Grade de horários</h3>
            <p className="text-sm text-slate-600">
              Verde: livre · Vermelho: indisponível · Com nome: ocupado (clique para liberar).
            </p>
          </div>
        </div>
        <ScheduleLegend />
        <ScheduleGrid
          mode="edit"
          schedule={draft.schedule}
          mergeSlotKeys={mergeSlotKeys}
          onToggle={(key, cell) => onScheduleToggle(key, cell)}
        />
      </section>

      <FormActions
        cancelLabel="Cancelar"
        saveLabel="Salvar"
        onCancel={() => {
          setDraft(cloneTeacher(baseline))
          setFieldErrors({})
          setFormError(null)
          onCancelNavigate()
        }}
        isSaving={isSaving}
        onSave={async () => {
          const nextFieldErrors: Record<string, string> = {}
          setFormError(null)
          if (courses.length === 0 || instrumentOptions.length === 0) {
            const msg =
              'Não há cursos cadastrados. Acesse o menu Cursos e cadastre ao menos um instrumento/curso antes de salvar um professor.'
            setFormError(msg)
            window.alert(msg)
            return
          }
          if (draft.instrumentSlugs.length === 0) {
            nextFieldErrors.instrumentSlugs = 'Selecione ao menos um instrumento.'
          }
          if (!draft.nome.trim()) nextFieldErrors.nome = 'Informe o nome completo.'
          if (!isCpfComplete(draft.cpf)) nextFieldErrors.cpf = 'CPF incompleto (11 dígitos).'
          if (draft.rg.trim() && !isRgNumericComplete(draft.rg)) {
            nextFieldErrors.rg = 'RG inválido: informe de 6 a 9 dígitos ou deixe em branco.'
          }
          if (!draft.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
            nextFieldErrors.email = 'Informe um e-mail válido.'
          }
          if (!isMobileComplete(draft.celular)) {
            nextFieldErrors.celular = 'Celular incompleto (DDD + 9 dígitos).'
          }
          const contDigits = onlyDigits(draft.contatos)
          if (contDigits.length > 0 && !isPhoneBrComplete(draft.contatos)) {
            nextFieldErrors.contatos = 'Telefone em contatos precisa estar completo.'
          }
          if (!draft.login.trim()) nextFieldErrors.login = 'Informe o login.'
          if (!draft.senha) nextFieldErrors.senha = 'Informe a senha.'
          const lu = draft.login.trim().toLowerCase()
          const dupLogin = allTeachers.some(
            (t) => t.id !== draft.id && t.login.trim().toLowerCase() === lu,
          )
          if (dupLogin) {
            nextFieldErrors.login = 'Este login já está em uso.'
          }

          setFieldErrors(nextFieldErrors)
          if (Object.keys(nextFieldErrors).length > 0) {
            const msg =
              'Formulário inválido. Revise os campos destacados em vermelho antes de salvar.'
            setFormError(msg)
            window.alert(msg)
            return
          }

          try {
            setIsSaving(true)
            await saveTeacher({
              ...draft,
              login: draft.login.trim(),
              email: draft.email.trim(),
              celular: draft.celular.trim(),
            })
            setFieldErrors({})
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
    </div>
  )
}
