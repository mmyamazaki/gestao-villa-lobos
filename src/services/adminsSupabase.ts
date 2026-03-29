import bcrypt from 'bcryptjs'
import { getSupabase } from '../integrations/supabase/client'
import { getPrimaryAdminEmailLower } from '../lib/adminEnv'

export type AdminListItem = {
  id: string
  email: string
  name: string
}

type RowWithHash = { password_hash: string }

export async function fetchAdminList(): Promise<{ ok: true; data: AdminListItem[] } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) {
    return { ok: false, error: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.' }
  }
  const { data, error } = await sb.from('admins').select('id,email,name').order('email', { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []) as AdminListItem[] }
}

export async function createAdminInSupabase(payload: {
  email: string
  name: string
  password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Supabase não configurado.' }
  const email = payload.email.trim().toLowerCase()
  if (!email || !payload.name.trim()) return { ok: false, error: 'E-mail e nome são obrigatórios.' }
  if (payload.password.length < 6) return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' }
  const password_hash = await bcrypt.hash(payload.password, 10)
  const id = crypto.randomUUID()
  const { error } = await sb.from('admins').insert({
    id,
    email,
    name: payload.name.trim(),
    password_hash,
  })
  if (error) {
    if (error.code === '23505' || error.message.includes('unique')) {
      return { ok: false, error: 'Já existe um administrador com este e-mail.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function updateAdminInSupabase(
  admin: AdminListItem,
  payload: { name: string; email: string; password: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Supabase não configurado.' }
  const name = payload.name.trim()
  const email = payload.email.trim().toLowerCase()
  if (!name || !email) return { ok: false, error: 'E-mail e nome são obrigatórios.' }

  const primary = getPrimaryAdminEmailLower()
  const wasPrimary = admin.email.trim().toLowerCase() === primary
  if (wasPrimary && email !== admin.email.trim().toLowerCase()) {
    return {
      ok: false,
      error:
        'O e-mail do administrador principal não pode ser alterado aqui (está ligado a VITE_ADMIN_EMAIL).',
    }
  }

  const emailChanged = email !== admin.email.trim().toLowerCase()
  if (emailChanged) {
    const { data: row } = await sb.from('admins').select('id').eq('email', email).maybeSingle()
    if (row && (row as { id: string }).id !== admin.id) {
      return { ok: false, error: 'Já existe um administrador com este e-mail.' }
    }
  }

  const pwd = payload.password.trim()
  if (pwd.length > 0 && pwd.length < 6) {
    return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' }
  }

  const update: Record<string, string> = { name, email }
  if (pwd.length > 0) {
    update.password_hash = await bcrypt.hash(pwd, 10)
  }

  const { error } = await sb.from('admins').update(update).eq('id', admin.id)
  if (error) {
    if (error.code === '23505' || error.message.includes('unique')) {
      return { ok: false, error: 'Já existe um administrador com este e-mail.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function deleteAdminInSupabase(
  admin: AdminListItem,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const primary = getPrimaryAdminEmailLower()
  if (admin.email.trim().toLowerCase() === primary) {
    return { ok: false, error: 'O administrador principal (definido em VITE_ADMIN_EMAIL) não pode ser excluído.' }
  }
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Supabase não configurado.' }
  const { error } = await sb.from('admins').delete().eq('id', admin.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Valida e-mail + senha contra a tabela `admins` no Supabase. */
export async function verifyAdminCredentials(email: string, plainPassword: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const q = email.trim().toLowerCase()
  const { data, error } = await sb
    .from('admins')
    .select('password_hash')
    .eq('email', q)
    .maybeSingle()
  if (error || !data) return false
  const row = data as RowWithHash
  if (typeof row.password_hash !== 'string') return false
  return bcrypt.compare(plainPassword, row.password_hash)
}
