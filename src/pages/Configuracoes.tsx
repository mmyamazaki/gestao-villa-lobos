import { useCallback, useEffect, useState } from 'react'
import { FormActions } from '../components/FormActions'
import { isSupabaseConfigured } from '../integrations/supabase/client'
import { getPrimaryAdminEmailLower } from '../lib/adminEnv'
import {
  createAdminInSupabase,
  deleteAdminInSupabase,
  fetchAdminList,
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
    await refresh()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Configurações</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gerencie os administradores da secretaria. O administrador principal definido em{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">VITE_ADMIN_EMAIL</code> continua válido
          para login mesmo sem registro na lista, e não pode ser excluído aqui.
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
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">{a.name}</p>
                    <p className="text-sm text-slate-600">{a.email}</p>
                    {isPrimary && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">Administrador principal</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isPrimary}
                    title={isPrimary ? 'O administrador principal não pode ser excluído' : 'Excluir'}
                    className="min-h-[44px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-rose-800 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => void handleRemove(a)}
                  >
                    Excluir
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Adicionar novo administrador</h3>
        <p className="mt-1 text-sm text-slate-600">
          A senha é armazenada apenas como hash (bcrypt) no Supabase.
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
