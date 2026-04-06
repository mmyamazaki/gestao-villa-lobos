import { useCallback, useEffect, useState } from 'react'
import { FormActions } from '../components/FormActions'
import { isSupabaseConfigured } from '../integrations/supabase/client'
import { getPrimaryAdminEmailLower } from '../lib/adminEnv'
import {
  createAdminInSupabase,
  deleteAdminInSupabase,
  fetchAdminList,
  updateAdminInSupabase,
  type AdminListItem,
} from '../services/adminsSupabase'
const field =
  'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-500/30 focus:border-emerald-600 focus:ring-2'

export function Configuracoes() {
  const primaryLower = getPrimaryAdminEmailLower()

  const [admins, setAdmins] = useState<AdminListItem[]>([])
  const [loadError, setLoadError] = useState('')
  const [loadingList, setLoadingList] = useState(true)

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoadError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para gerenciar administradores.')
      setAdmins([])
      setLoadingList(false)
      return
    }
    setLoadingList(true)
    setLoadError('')
    const r = await fetchAdminList()
    setLoadingList(false)
    if (!r.ok) {
      setLoadError(r.error)
      setAdmins([])
      return
    }
    setAdmins(r.data)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleAdd() {
    setFormError('')
    setIsSaving(true)
    try {
      const r = await createAdminInSupabase({
        email: newEmail,
        name: newName,
        password: newPassword,
      })
      if (!r.ok) {
        setFormError(r.error)
        return
      }
      setNewEmail('')
      setNewName('')
      setNewPassword('')
      await refresh()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(a: AdminListItem) {
    if (!window.confirm(`Remover o administrador ${a.name} (${a.email})?`)) return
    const r = await deleteAdminInSupabase(a)
    if (!r.ok) {
      window.alert(r.error)
      return
    }
    if (editingId === a.id) {
      setEditingId(null)
      setEditError('')
    }
    await refresh()
  }

  function startEdit(a: AdminListItem) {
    setEditingId(a.id)
    setEditName(a.name)
    setEditEmail(a.email)
    setEditPassword('')
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditPassword('')
    setEditError('')
  }

  async function handleSaveEdit(a: AdminListItem) {
    setEditError('')
    setIsSavingEdit(true)
    try {
      const r = await updateAdminInSupabase(a, {
        name: editName,
        email: editEmail,
        password: editPassword,
      })
      if (!r.ok) {
        setEditError(r.error)
        return
      }
      cancelEdit()
      await refresh()
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Configurações</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gerencie os administradores da secretaria (editar, excluir ou adicionar). O administrador
          principal definido em{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">VITE_ADMIN_EMAIL</code> continua válido
          para login mesmo sem registro na lista; não pode ser excluído e o e-mail dele não pode ser
          alterado aqui.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Administradores cadastrados</h3>
        {loadError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {loadError}
          </p>
        )}
        {loadingList && !loadError && <p className="mt-4 text-sm text-slate-500">Carregando…</p>}
        {!loadingList && isSupabaseConfigured() && (
          <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {admins.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhum registro na tabela admins.</li>
            )}
            {admins.map((a) => {
              const isPrimary = a.email.trim().toLowerCase() === primaryLower
              const isEditing = editingId === a.id
              return (
                <li key={a.id} className="px-4 py-3">
                  {!isEditing ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{a.name}</p>
                        <p className="text-sm text-slate-600">{a.email}</p>
                        {isPrimary && (
                          <p className="mt-1 text-xs font-medium text-emerald-700">Administrador principal</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-[44px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                          onClick={() => startEdit(a)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={isPrimary}
                          title={isPrimary ? 'O administrador principal não pode ser excluído' : 'Excluir'}
                          className="min-h-[44px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-rose-800 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => void handleRemove(a)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
                      <p className="text-sm font-medium text-slate-800">Editar administrador</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="text-sm font-medium text-slate-700">Nome completo</span>
                          <input
                            className={field}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoComplete="name"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-sm font-medium text-slate-700">E-mail (login)</span>
                          <input
                            type="email"
                            className={field}
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            autoComplete="email"
                            readOnly={isPrimary}
                            title={
                              isPrimary
                                ? 'E-mail do administrador principal vem de VITE_ADMIN_EMAIL'
                                : undefined
                            }
                          />
                          {isPrimary && (
                            <span className="mt-1 block text-xs text-slate-500">
                              E-mail fixo: definido em VITE_ADMIN_EMAIL no ambiente.
                            </span>
                          )}
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-sm font-medium text-slate-700">Nova senha (opcional)</span>
                          <input
                            type="password"
                            className={field}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder="Deixe em branco para manter a senha atual"
                          />
                        </label>
                      </div>
                      {editError && <p className="text-sm text-red-700">{editError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          className="min-h-[44px] rounded-lg bg-[#003366] px-4 py-2 text-sm font-medium text-white hover:bg-[#00264d] disabled:opacity-50"
                          onClick={() => void handleSaveEdit(a)}
                        >
                          {isSavingEdit ? 'Salvando…' : 'Salvar alterações'}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Adicionar novo administrador</h3>
        <p className="mt-1 text-sm text-slate-600">
          A senha é armazenada apenas como hash (bcrypt) no Supabase. Mínimo 8 caracteres.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Nome completo</span>
            <input className={field} value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">E-mail (login)</span>
            <input
              type="email"
              className={field}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Senha</span>
            <input
              type="password"
              className={field}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>
        {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
        <div className="mt-4">
          <FormActions
            onCancel={() => {
              setNewEmail('')
              setNewName('')
              setNewPassword('')
              setFormError('')
            }}
            onSave={() => void handleAdd()}
            saveLabel="Adicionar administrador"
            isSaving={isSaving}
            savingLabel="Salvando…"
          />
        </div>
      </section>
    </div>
  )
}
