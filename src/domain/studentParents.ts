/** Filiação do aluno: dois campos opcionais + coluna legado `filiacao` no banco. */

export function filiacaoLegacyString(nomePai: string, nomeMae: string): string {
  const p = nomePai.trim()
  const m = nomeMae.trim()
  if (!p && !m) return ''
  const parts: string[] = []
  if (p) parts.push(`Pai: ${p}`)
  if (m) parts.push(`Mãe: ${m}`)
  return parts.join(' | ')
}

export function normalizeStudentParentsFromDb(
  nomePai: string | null | undefined,
  nomeMae: string | null | undefined,
  filiacaoLegacy: string | null | undefined,
): { nomePai: string; nomeMae: string } {
  let np = (nomePai ?? '').trim()
  let nm = (nomeMae ?? '').trim()
  const leg = (filiacaoLegacy ?? '').trim()
  if (!np && !nm && leg) {
    np = leg
  }
  return { nomePai: np, nomeMae: nm }
}
