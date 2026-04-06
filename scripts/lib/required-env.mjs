/**
 * Variáveis usadas pelo frontend no build do Vite (import.meta.env) — não exigidas em check-quick
 * quando o painel só injeta variáveis para o Node no prebuild; configure-as no mesmo painel para o
 * passo `vite build` gerar o bundle com os valores corretos.
 */
export const VITE_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ADMIN_EMAIL',
]

/** Obrigatórias em check-quick (prebuild): API + banco — não inclui VITE_*. */
export const CHECK_QUICK_REQUIRED_KEYS = ['DATABASE_URL', 'API_PORT']

/** Lista completa para predev / verify-env. */
export const REQUIRED_ENV_KEYS = [...CHECK_QUICK_REQUIRED_KEYS, ...VITE_ENV_KEYS]
