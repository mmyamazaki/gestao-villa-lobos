import { getPrimaryAdminEmailLower } from '../lib/adminEnv'
import { apiUrl } from '../utils/apiBase'

export type AdminListItem = {
  id: string
  email: string
  name: string
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    if (typeof j.error === 'string' && j.error.trim()) return j.error.trim()
  } catch {
    /* ignore */
  }
  return `Erro HTTP ${res.status}`
}

export async function fetchAdminList(): Promise<{ ok: true; data: AdminListItem[] } | { ok: false; error: string }> {
  const r = await fetch(apiUrl('/api/admins'), { credentials: 'include' })
  if (r.status === 401) {
    return { ok: false, error: 'Sessão expirada ou sem permissão. Entre novamente como secretaria.' }
  }
  if (!r.ok) return { ok: false, error: await readErrorBody(r) }
  const data: unknown = await r.json()
  if (!Array.isArray(data)) return { ok: false, error: 'Resposta inválida da API.' }
  return { ok: true, data: data as AdminListItem[] }
}

export async function createAdminInApi(payload: {
  email: string
  name: string
  password: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch(apiUrl('/api/admins'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      name: payload.name.trim(),
      password: payload.password,
    }),
  })
  if (r.status === 401) return { ok: false, error: 'Não autorizado. Entre como secretaria.' }
  if (!r.ok) return { ok: false, error: await readErrorBody(r) }
  return { ok: true }
}

export async function updateAdminInApi(
  admin: AdminListItem,
  payload: { name: string; email: string; password: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const primary = getPrimaryAdminEmailLower()
  const wasPrimary = admin.email.trim().toLowerCase() === primary
  if (wasPrimary && payload.email.trim().toLowerCase() !== admin.email.trim().toLowerCase()) {
    return {
      ok: false,
      error:
        'O e-mail do administrador principal não pode ser alterado aqui (está ligado a VITE_ADMIN_EMAIL).',
    }
  }

  const r = await fetch(apiUrl(`/api/admins/${encodeURIComponent(admin.id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password.trim(),
    }),
  })
  if (r.status === 401) return { ok: false, error: 'Não autorizado. Entre como secretaria.' }
  if (!r.ok) return { ok: false, error: await readErrorBody(r) }
  return { ok: true }
}

export async function deleteAdminInApi(
  admin: AdminListItem,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const primary = getPrimaryAdminEmailLower()
  if (admin.email.trim().toLowerCase() === primary) {
    return { ok: false, error: 'O administrador principal (definido em VITE_ADMIN_EMAIL) não pode ser excluído.' }
  }
  const r = await fetch(apiUrl(`/api/admins/${encodeURIComponent(admin.id)}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  if (r.status === 401) return { ok: false, error: 'Não autorizado. Entre como secretaria.' }
  if (!r.ok) return { ok: false, error: await readErrorBody(r) }
  return { ok: true }
}
