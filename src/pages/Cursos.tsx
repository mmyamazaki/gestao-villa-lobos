import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Course } from '../domain/types'
import { PRESET_INSTRUMENT_ORDER } from '../domain/coursesCatalog'
import type { InstrumentKey } from '../domain/types'
import { FormActions } from '../components/FormActions'
import { useSchool } from '../state/SchoolContext'

const inputClass =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 tabular-nums outline-none transition focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25'
const labelClass = 'text-sm font-semibold text-[#003366]'

function coursesFingerprint(list: Course[]) {
  return list.map((c) => `${c.id}:${c.monthlyPrice}`).join('|')
}

function sortInstrumentKeys(keys: string[]) {
  const presetRank = new Map(PRESET_INSTRUMENT_ORDER.map((k, i) => [k, i]))
  return [...keys].sort((a, b) => {
    const ra = presetRank.has(a as InstrumentKey) ? presetRank.get(a as InstrumentKey)! : 1000
    const rb = presetRank.has(b as InstrumentKey) ? presetRank.get(b as InstrumentKey)! : 1000
    if (ra !== rb) return ra - rb
    return a.localeCompare(b, 'pt-BR')
  })
}

function slugifyInstrumentName(name: string) {
  const s = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'instrumento'
}

export function Cursos() {
  const navigate = useNavigate()
  const { state, setCourses } = useSchool()
  return (
    <CursosEditor
      key={coursesFingerprint(state.courses)}
      initialCourses={state.courses}
      onSave={(c) => {
        setCourses(c)
        navigate('/cursos', { replace: true })
      }}
      onCancelNavigate={() => navigate('/cursos', { replace: true })}
    />
  )
}

function CursosEditor({
  initialCourses,
  onSave,
  onCancelNavigate,
}: {
  initialCourses: Course[]
  onSave: (c: Course[]) => void
  onCancelNavigate: () => void
}) {
  const [draft, setDraft] = useState(() => initialCourses.map((c) => ({ ...c })))
  const [modalOpen, setModalOpen] = useState(false)
  const [newInstrumentLabel, setNewInstrumentLabel] = useState('')
  const [p1, setP1] = useState(380)
  const [p2, setP2] = useState(400)
  const [p3, setP3] = useState(420)

  const grouped = useMemo(() => {
    const map = new Map<string, Course[]>()
    for (const c of draft) {
      const list = map.get(c.instrument) ?? []
      list.push(c)
      map.set(c.instrument, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.stage - b.stage)
    }
    return map
  }, [draft])

  const orderedInstrumentKeys = useMemo(
    () => sortInstrumentKeys([...grouped.keys()]),
    [grouped],
  )

  const patchPrice = (id: string, monthlyPrice: number) => {
    setDraft((rows) => rows.map((r) => (r.id === id ? { ...r, monthlyPrice } : r)))
  }

  const closeModal = () => {
    setModalOpen(false)
    setNewInstrumentLabel('')
    setP1(380)
    setP2(400)
    setP3(420)
  }

  const saveNewInstrument = () => {
    const label = newInstrumentLabel.trim()
    if (!label) {
      window.alert('Informe o nome do instrumento.')
      return
    }
    const slug = `custom-${slugifyInstrumentName(label)}-${crypto.randomUUID().slice(0, 8)}`
    const exists = draft.some((c) => c.instrument === slug)
    if (exists) {
      window.alert('Tente novamente (identificador duplicado).')
      return
    }
    const rows: Course[] = [
      { id: `${slug}-1`, instrument: slug, instrumentLabel: label, stage: 1, monthlyPrice: p1 },
      { id: `${slug}-2`, instrument: slug, instrumentLabel: label, stage: 2, monthlyPrice: p2 },
      { id: `${slug}-3`, instrument: slug, instrumentLabel: label, stage: 3, monthlyPrice: p3 },
    ]
    const next = [...draft, ...rows]
    setDraft(next)
    onSave(next)
    closeModal()
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex justify-end border-b border-transparent bg-slate-50/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#003366] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
        >
          <span className="text-lg leading-none">+</span>
          Novo Curso
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Cursos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cadastro por instrumento e estágio (1º, 2º, 3º). Inclua novos instrumentos com <strong>+ Novo Curso</strong>.
        </p>
      </div>

      <div className="space-y-6">
        {orderedInstrumentKeys.map((instKey) => (
          <section
            key={instKey}
            className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <h3 className="text-base font-semibold text-[#003366]">
                {grouped.get(instKey)?.[0]?.instrumentLabel ?? instKey}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-white text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Estágio</th>
                    <th className="px-4 py-3">Mensalidade (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(grouped.get(instKey) ?? []).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.stage}º</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className={`${inputClass} w-36`}
                          value={c.monthlyPrice}
                          onChange={(e) =>
                            patchPrice(c.id, Number.parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <FormActions
        saveLabel="Salvar"
        cancelLabel="Cancelar"
        onCancel={() => {
          setDraft(initialCourses.map((c) => ({ ...c })))
          onCancelNavigate()
        }}
        onSave={() => {
          onSave(draft)
        }}
      />

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-labelledby="novo-curso-titulo"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="novo-curso-titulo" className="text-lg font-semibold text-[#003366]">
              Novo instrumento
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Defina o nome e os valores mensais para cada estágio (1º, 2º e 3º).
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className={labelClass}>Nome do instrumento</span>
                <input
                  type="text"
                  className={`${inputClass} mt-1.5`}
                  value={newInstrumentLabel}
                  onChange={(e) => setNewInstrumentLabel(e.target.value)}
                  placeholder="Ex.: Ukulele, Canto, Teclado…"
                  autoFocus
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClass}>1º estágio (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={`${inputClass} mt-1.5`}
                    value={p1}
                    onChange={(e) => setP1(Number.parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>2º estágio (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={`${inputClass} mt-1.5`}
                    value={p2}
                    onChange={(e) => setP2(Number.parseFloat(e.target.value) || 0)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>3º estágio (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={`${inputClass} mt-1.5`}
                    value={p3}
                    onChange={(e) => setP3(Number.parseFloat(e.target.value) || 0)}
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNewInstrument}
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
