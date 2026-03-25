import { useMemo, useState } from 'react'
import type { Course } from '../domain/types'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { calcAgeYears } from '../domain/age'
import { createEmptySchedule } from '../domain/schedule'
import type { ScheduleMap, SlotState, Teacher } from '../domain/types'
import { FormActions } from '../components/FormActions'
import { ScheduleGrid, ScheduleLegend } from '../components/ScheduleGrid'
import { useSchool } from '../state/SchoolContext'
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
    instrumentSlugs: [],
    schedule: ensureSchedule(createEmptySchedule() as ScheduleMap),
  }
}

export function ProfessorForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, saveTeacher } = useSchool()
  const [novoId] = useState(() => crypto.randomUUID())

  const baseline = useMemo((): Teacher | null => {
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
}: {
  mode: 'novo' | 'edit'
  baseline: Teacher
  onCancelNavigate: () => void
  onDone: () => void
  saveTeacher: (t: Teacher) => void
  courses: Course[]
}) {
  const [draft, setDraft] = useState(() => cloneTeacher(baseline))

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
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {mode === 'novo' ? 'Novo professor' : 'Editar professor'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Segunda a sábado, 08h–12h e 14h–20h em blocos de 30 minutos.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Dados pessoais</h3>
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
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Endereço completo
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.endereco}
              onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Contatos
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2"
              value={draft.contatos}
              onChange={(e) => setDraft((d) => ({ ...d, contatos: e.target.value }))}
            />
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
          onToggle={(key, cell) => onScheduleToggle(key, cell)}
        />
      </section>

      <FormActions
        cancelLabel="Cancelar"
        saveLabel="Salvar"
        onCancel={() => {
          setDraft(cloneTeacher(baseline))
          onCancelNavigate()
        }}
        onSave={() => {
          if (draft.instrumentSlugs.length === 0) {
            window.alert('Selecione ao menos um instrumento que o professor leciona.')
            return
          }
          saveTeacher(draft)
          onDone()
        }}
      />
    </div>
  )
}
