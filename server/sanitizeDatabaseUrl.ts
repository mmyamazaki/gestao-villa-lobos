/**
 * Variáveis no hPanel (Hostinger, etc.) por vezes vêm com aspas literais ou BOM,
 * o que faz `new URL(DATABASE_URL)` falhar sem o utilizador ver o problema.
 * Não altera o interior da string — só remove envoltório óbvio.
 */
export function sanitizeDatabaseUrlFromPanel(raw: string): string {
  let s = raw.trim().replace(/^\uFEFF/, '')
  for (let depth = 0; depth < 3; depth += 1) {
    if (s.length < 2) break
    const a = s[0]
    const b = s[s.length - 1]
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      s = s.slice(1, -1).trim().replace(/^\uFEFF/, '')
      continue
    }
    break
  }
  return s.trim()
}
