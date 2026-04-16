import { sanitizeDatabaseUrlFromPanel } from './sanitizeDatabaseUrl.js'

/**
 * Alguns painéis (ex.: Hostinger) truncam variáveis longas. Coloque o início em
 * `DATABASE_URL` e o resto **sem espaço** em `DATABASE_URL_APPEND`.
 */
export function combineRawDatabaseUrlFromEnv(): string {
  const a = process.env.DATABASE_URL?.trim() ?? ''
  const b = process.env.DATABASE_URL_APPEND?.trim() ?? ''
  return sanitizeDatabaseUrlFromPanel(a + b)
}

export function hasDatabaseUrlConfigured(): boolean {
  return Boolean(
    (process.env.DATABASE_URL?.trim() ?? '') || (process.env.DATABASE_URL_APPEND?.trim() ?? ''),
  )
}

/** Dicas quando `new URL` falha (sem expor password). */
export function databaseUrlParseHints(raw: string): string[] {
  const hints: string[] = []
  const afterScheme = raw.replace(/^postgres(?:ql)?:\/\//i, '')
  const atCount = (afterScheme.match(/@/g) ?? []).length
  if (atCount > 1) {
    hints.push(
      'Mais de um @ após o esquema — a password pode ter @ sem %40, ou a URL foi cortada a meio.',
    )
  }
  if (raw.includes(' ') || raw.includes('\t')) hints.push('Contém espaços/tabs — remova ou codifique na password.')
  if (raw.includes('\n') || raw.includes('\r')) hints.push('Contém quebra de linha — deve ser uma única linha.')
  if (raw.length >= 80 && raw.length <= 100 && /^postgres(?:ql)?:\/\//i.test(raw)) {
    hints.push(
      'URL com ~80–100 caracteres: o painel pode estar a cortar — use DATABASE_URL_APPEND com o sufixo em falta (sem espaço).',
    )
  }
  return hints
}
