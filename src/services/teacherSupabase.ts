/**
 * Grava professor direto no Supabase (REST) quando a API Node não está acessível.
 * Requer políticas RLS que permitam INSERT/UPDATE na tabela "Teacher" para o papel em uso.
 */
import { getSupabase } from '../integrations/supabase/client'
import type { Teacher } from '../domain/types'

export async function upsertTeacherInSupabase(t: Teacher): Promise<void> {
  const sb = getSupabase()
  if (!sb) {
    throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  }

  const row = {
    id: t.id,
    nome: t.nome,
    dataNascimento: t.dataNascimento,
    naturalidade: t.naturalidade,
    filiacao: t.filiacao,
    rg: t.rg,
    cpf: t.cpf,
    endereco: t.endereco,
    contatos: t.contatos,
    email: t.email,
    celular: t.celular,
    login: t.login,
    senha: t.senha,
    instrumentSlugs: t.instrumentSlugs ?? [],
    schedule: t.schedule ?? {},
  }

  const { error } = await sb.from('Teacher').upsert(row, { onConflict: 'id' })
  if (error) {
    throw new Error(
      `Não foi possível salvar no Supabase: ${error.message}. ` +
        'Confirme políticas RLS (INSERT/UPDATE em Teacher) ou use a API Node (npm run dev / npm start).',
    )
  }
}

/** Erros típicos quando não há API acessível (proxy, host errado, timeout). */
export function isLikelyNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) {
    const m = String(e.message)
    if (m.includes('fetch') || m.includes('Failed') || m.includes('Network')) return true
  }
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error) {
    const m = e.message
    if (m.includes('Failed to fetch') || m.includes('Tempo esgotado') || m.includes('Load failed')) {
      return true
    }
    if (m.includes('NetworkError')) return true
  }
  return false
}
