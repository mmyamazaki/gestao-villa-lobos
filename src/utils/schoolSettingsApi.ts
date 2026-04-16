import type { SchoolSettings } from '../domain/types'
import { apiUrl } from './apiBase'
import { fetchWithTimeoutPrismaBootRetry } from './apiPrismaBootWait'
import { fetchWithTimeout, readResponseTextWithTimeout } from './fetchWithTimeout'

/**
 * Carrega observações internas (secretaria): GET /api/school/settings.
 * `null` = API indisponível ou resposta inválida — o cliente mantém o que veio do localStorage.
 */
export async function fetchSchoolSettingsRemoteBestEffort(): Promise<SchoolSettings | null> {
  try {
    const r = await fetchWithTimeoutPrismaBootRetry(apiUrl('/api/school/settings'), {
      timeoutMs: 30_000,
    })
    const text = await readResponseTextWithTimeout(r, 20_000)
    if (!r.ok) {
      console.warn('[schoolSettings] GET', r.status, text.slice(0, 160))
      return null
    }
    try {
      const j = JSON.parse(text) as { observacoesInternas?: unknown }
      const observacoesInternas =
        typeof j.observacoesInternas === 'string' ? j.observacoesInternas : ''
      return { observacoesInternas }
    } catch {
      if (/<!DOCTYPE|<html/i.test(text)) {
        console.warn(
          '[schoolSettings] /api/school/settings devolveu HTML — confirme API Node ou VITE_API_BASE_URL.',
        )
      } else {
        console.warn('[schoolSettings] JSON inválido:', text.slice(0, 100))
      }
      return null
    }
  } catch (e) {
    console.warn('[schoolSettings] rede em GET /api/school/settings', e)
    return null
  }
}

export async function pushSchoolSettingsToApi(settings: SchoolSettings): Promise<void> {
  const res = await fetchWithTimeout(apiUrl('/api/school/settings'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observacoesInternas: settings.observacoesInternas }),
    timeoutMs: 45_000,
  })
  const text = await readResponseTextWithTimeout(res, 20_000)
  if (!res.ok) {
    let msg = text || 'Falha ao salvar configurações no servidor.'
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* usar texto bruto */
    }
    throw new Error(msg)
  }
}
