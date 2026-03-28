/**
 * Lista única de variáveis obrigatórias no .env (predev, verify-env, check-quick).
 */
export const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'API_PORT',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_ADMIN_EMAIL',
  'VITE_ADMIN_PASSWORD',
]
