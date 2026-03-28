import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Course, Student } from '../domain/types'
import { PRESET_INSTRUMENT_ORDER } from '../domain/coursesCatalog'
import type { InstrumentKey } from '../domain/types'
import { CourseForm } from '../components/CourseForm'
import { FormActions } from '../components/FormActions'
import { useSchool } from '../state/SchoolContext'

const inputClass =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 tabular-nums outline-none transition focus:border-[#00AEEF] focus:ring-2 focus:ring-[#00AEEF]/25'
const labelClass = 'text-sm font-semibold text-[#003366]'

type NewLevelDraft = { levelLabel: string; monthlyPrice: number }

function defaultNewLevels(): NewLevelDraft[] {
  return [
    { levelLabel: '1º estágio', monthlyPrice: 380 },
    { levelLabel: '2º estágio', monthlyPrice: 400 },
    { levelLabel: '3º estágio', monthlyPrice: 420 },
  ]
}

function coursesFingerprint(list: Course[]) {
  return list.map((c) => `${c.id}:${c.monthlyPrice}:${c.instrumentLabel}:${c.levelLabel}`).join('|')
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

function sortCoursesWithinInstrument(a: Course, b: Course) {
  return a.levelLabel.localeCompare(b.levelLabel, 'pt-BR', { numeric: true })
}

function newCourseRowId(slug: string) {
  return `${slug}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function hasStudentEnrolledInCourse(students: Student[], courseId: string) {
  return students.some((s) => s.enrollment?.courseId === courseId)
}

export function Cursos() {
  const navigate = useNavigate()
  const { state, setCourses } = useSchool()
  return (
    <CursosEditor
      initialCourses={state.courses}
      students={state.students}
      onSave={async (c) => {
        await setCourses(c)
      }}
      onCancelNavigate={() => navigate('/cursos', { replace: true })}
    />
  )
}

function CursosEditor({
  initialCourses,
  students,
  onSave,
  onCancelNavigate,
}: {
  initialCourses: Course[]
  students: Student[]
  onSave: (c: Course[]) => void | Promise<void>
  onCancelNavigate: () => void
}) {
  const { setCourses: persistCourses, deleteCourse, updateInstrumentLabel } = useSchool()
  const [draft, setDraft] = useState(() => initialCourses.map((c) => ({ ...c })))
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [newInstrumentLabel, setNewInstrumentLabel] = useState('')
  const [newLevels, setNewLevels] = useState<NewLevelDraft[]>(defaultNewLevels)
  const [savingFooter, setSavingFooter] = useState(false)
  const [savingNewInstrument, setSavingNewInstrument] = useState(false)
  const saveNewInstrumentInFlightRef = useRef(false)
  /** Fingerprint do `draft` ao abrir o modal de edição — para distinguir “fechar sem mudança” de “só adicionar níveis”. */
  const editModalOpenBaselineFp = useRef<string | null>(null)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const serverCoursesFp = coursesFingerprint(initialCourses)
  /** Só quando o catálogo do servidor muda (navegação, PUT em outro fluxo, etc.). Com modal de edição aberto, não sobrescrever o rascunho. */
  useEffect(() => {
    if (editingCourseId) return
    setDraft(initialCourses.map((c) => ({ ...c })))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dependência estável via serverCoursesFp
  }, [serverCoursesFp, editingCourseId])

  useLayoutEffect(() => {
    if (!editingCourseId) {
      editModalOpenBaselineFp.current = null
      return
    }
    editModalOpenBaselineFp.current = coursesFingerprint(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline só ao abrir/trocar o curso em edição
  }, [editingCourseId])

  const grouped = useMemo(() => {
    const map = new Map<string, Course[]>()
    for (const c of draft) {
      const list = map.get(c.instrument) ?? []
      list.push(c)
      map.set(c.instrument, list)
    }
    for (const list of map.values()) {
      list.sort(sortCoursesWithinInstrument)
    }
    return map
  }, [draft])

  const orderedInstrumentKeys = useMemo(
    () => sortInstrumentKeys([...grouped.keys()]),
    [grouped],
  )

  const closeModal = () => {
    setModalOpen(false)
    setNewInstrumentLabel('')
    setNewLevels(defaultNewLevels())
  }

  const handleEditInstrumentName = async (instrument: string, currentLabel: string) => {
    const next = window.prompt(
      'Novo nome do instrumento (como aparece nas telas):',
      currentLabel,
    )
    if (next === null) return
    const trimmed = next.trim()
    if (!trimmed) {
      window.alert('O nome não pode ser vazio.')
      return
    }
    if (trimmed === currentLabel) return
    try {
      await updateInstrumentLabel(instrument, trimmed)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDeleteInstrument = async (instrument: string, displayLabel: string) => {
    const ok = window.confirm(
      `Excluir todo o instrumento "${displayLabel}" e todos os níveis?\n\nEsta ação não pode ser desfeita.`,
    )
    if (!ok) return
    try {
      await deleteCourse(instrument)
      setEditingCourseId((prev) => {
        if (!prev) return null
        const row = draft.find((x) => x.id === prev)
        return row?.instrument === instrument ? null : prev
      })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  const saveNewInstrument = async () => {
    const label = newInstrumentLabel.trim()
    if (!label) {
      window.alert('Informe o nome do instrumento.')
      return
    }
    const trimmedLevels = newLevels.map((r) => ({
      levelLabel: r.levelLabel.trim(),
      monthlyPrice: r.monthlyPrice,
    }))
    if (trimmedLevels.some((r) => !r.levelLabel)) {
      window.alert('Preencha o Nível / Ano de cada linha ou remova linhas vazias.')
      return
    }
    const levelSet = new Set(trimmedLevels.map((r) => r.levelLabel.toLowerCase()))
    if (levelSet.size !== trimmedLevels.length) {
      window.alert('Os níveis / anos precisam ser diferentes entre si neste instrumento.')
      return
    }
    const slug = `custom-${slugifyInstrumentName(label)}-${crypto.randomUUID().slice(0, 8)}`
    const exists = draft.some((c) => c.instrument === slug)
    if (exists) {
      window.alert('Tente novamente (identificador duplicado).')
      return
    }
    const rows: Course[] = trimmedLevels.map((r) => ({
      id: newCourseRowId(slug),
      instrument: slug,
      instrumentLabel: label,
      levelLabel: r.levelLabel,
      monthlyPrice: r.monthlyPrice,
    }))
    const next = [...draft, ...rows]
    if (saveNewInstrumentInFlightRef.current) return
    saveNewInstrumentInFlightRef.current = true
    setSavingNewInstrument(true)
    try {
      await persistCourses(next)
      setDraft(next)
      closeModal()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      window.alert(
        'Não foi possível salvar o novo instrumento. Verifique a API e tente de novo.\n\n' + msg,
      )
    } finally {
      saveNewInstrumentInFlightRef.current = false
      setSavingNewInstrument(false)
    }
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
          Cadastre níveis livres por instrumento (ex.: Pré, 1º ano, 4º/5º ano). Inclua novos instrumentos
          com <strong>+ Novo Curso</strong>.
        </p>
      </div>

      <div className="space-y-6">
        {orderedInstrumentKeys.map((instKey) => (
          <section
            key={instKey}
            className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
              <h3 className="text-base font-semibold text-[#003366]">
                {grouped.get(instKey)?.[0]?.instrumentLabel ?? instKey}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleEditInstrumentName(
                      instKey,
                      grouped.get(instKey)?.[0]?.instrumentLabel ?? instKey,
                    )
                  }
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#003366] shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/40"
                >
                  Editar nome do curso
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteInstrument(
                      instKey,
                      grouped.get(instKey)?.[0]?.instrumentLabel ?? instKey,
                    )
                  }
                  className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 shadow-sm transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300/50"
                >
                  Excluir curso
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-white text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Curso</th>
                    <th className="px-4 py-3">Mensalidade (R$)</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(grouped.get(instKey) ?? []).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {c.instrumentLabel} - {c.levelLabel}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-900">
                        {c.monthlyPrice.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingCourseId(c.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#003366] shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/40"
                        >
                          Editar
                        </button>
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
        isSaving={savingFooter}
        onCancel={() => {
          setDraft(initialCourses.map((c) => ({ ...c })))
          onCancelNavigate()
        }}
        onSave={() => {
          void (async () => {
            setSavingFooter(true)
            try {
              await onSave(draft)
            } catch (e) {
              window.alert(
                'Erro ao salvar cursos: ' + (e instanceof Error ? e.message : String(e)),
              )
            } finally {
              if (mountedRef.current) setSavingFooter(false)
            }
          })()
        }}
      />

      <CourseForm
        open={editingCourseId != null}
        course={editingCourseId ? draft.find((x) => x.id === editingCourseId) ?? null : null}
        lockMonthlyPrice={
          editingCourseId != null && hasStudentEnrolledInCourse(students, editingCourseId)
        }
        onClose={() => setEditingCourseId(null)}
        onAddLevel={({ levelLabel: newLevelLabel, monthlyPrice: newMonthlyPrice, instrumentLabel }) => {
          if (!editingCourseId) return
          setDraft((prev) => {
            const row = prev.find((x) => x.id === editingCourseId)
            if (!row) return prev
            const lvl = newLevelLabel.trim()
            const dup = prev.some(
              (c) =>
                c.instrument === row.instrument &&
                c.levelLabel.trim().toLowerCase() === lvl.toLowerCase(),
            )
            if (dup) {
              window.alert('Já existe um nível com esse nome neste instrumento.')
              return prev
            }
            const label = instrumentLabel.trim() || row.instrumentLabel
            const added: Course = {
              id: `temp-${crypto.randomUUID()}`,
              instrument: row.instrument,
              instrumentLabel: label,
              levelLabel: lvl,
              monthlyPrice: newMonthlyPrice,
            }
            return [...prev, added]
          })
        }}
        onSubmit={async ({ instrumentLabel, levelLabel, monthlyPrice }) => {
          if (!editingCourseId) {
            throw new Error('Sessão de edição inválida. Feche o modal e tente de novo.')
          }
          const row = draft.find((x) => x.id === editingCourseId)
          if (!row) {
            throw new Error('Curso não encontrado no rascunho. Recarregue a página.')
          }
          const lock = hasStudentEnrolledInCourse(students, editingCourseId)
          const inst = row.instrument
          const labelTrim = instrumentLabel.trim()
          const levelTrim = levelLabel.trim()
          const price = lock ? row.monthlyPrice : monthlyPrice

          const next = draft.map((c) => {
            if (c.instrument !== inst) return { ...c }
            if (c.id === editingCourseId) {
              return {
                ...c,
                instrumentLabel: labelTrim,
                levelLabel: levelTrim,
                monthlyPrice: price,
              }
            }
            return { ...c, instrumentLabel: labelTrim }
          })

          const fpNext = coursesFingerprint(next)
          if (
            editModalOpenBaselineFp.current !== null &&
            fpNext === editModalOpenBaselineFp.current
          ) {
            setEditingCourseId(null)
            return
          }

          await persistCourses(next)
          setDraft(next.map((c) => ({ ...c })))
        }}
      />

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingNewInstrument) closeModal()
          }}
        >
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-labelledby="novo-curso-titulo"
            noValidate
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void saveNewInstrument()
            }}
          >
            <h3 id="novo-curso-titulo" className="text-lg font-semibold text-[#003366]">
              Novo instrumento
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Defina o nome e, para cada nível, o texto do nível/ano e o valor da mensalidade. Adicione ou
              remova linhas conforme a estrutura do instrumento.
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
                  disabled={savingNewInstrument}
                />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={labelClass}>Níveis e mensalidades</span>
                  <button
                    type="button"
                    disabled={savingNewInstrument}
                    onClick={() =>
                      setNewLevels((rows) => [...rows, { levelLabel: '', monthlyPrice: 380 }])
                    }
                    className="text-sm font-medium text-[#00AEEF] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Adicionar nível
                  </button>
                </div>
                {newLevels.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <label className="block sm:col-span-1">
                      <span className="text-xs font-semibold text-slate-600">Nível / Ano</span>
                      <input
                        type="text"
                        className={`${inputClass} mt-1`}
                        value={row.levelLabel}
                        disabled={savingNewInstrument}
                        onChange={(e) =>
                          setNewLevels((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, levelLabel: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder='Ex.: Pré, 1º ano…'
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600">R$</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={`${inputClass} mt-1`}
                        value={row.monthlyPrice}
                        disabled={savingNewInstrument}
                        onChange={(e) =>
                          setNewLevels((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? { ...r, monthlyPrice: Number.parseFloat(e.target.value) || 0 }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="flex items-end justify-end sm:justify-center">
                      <button
                        type="button"
                        disabled={newLevels.length <= 1 || savingNewInstrument}
                        onClick={() => setNewLevels((rows) => rows.filter((_, i) => i !== idx))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Remover nível"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={savingNewInstrument}
                className="rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingNewInstrument}
                className="rounded-lg bg-[#003366] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#00264d] focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingNewInstrument ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
