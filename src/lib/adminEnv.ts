/** E-mail do administrador principal (.env). Não pode ser excluído na UI. */
export function getPrimaryAdminEmailLower(): string {
  return (import.meta.env.VITE_ADMIN_EMAIL ?? 'secretaria@escola.br').trim().toLowerCase()
}

export function getPrimaryAdminPasswordFromEnv(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? 'admin123'
}
