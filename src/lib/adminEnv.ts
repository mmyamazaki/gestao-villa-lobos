/**
 * E-mail do administrador principal (env público no build, só identificação na UI).
 * A senha fica apenas na tabela `admins` (hash) e o login valida no servidor (`/api/auth/admin/login`).
 */
export function getPrimaryAdminEmailLower(): string {
  return (import.meta.env.VITE_ADMIN_EMAIL ?? 'secretaria@escola.br').trim().toLowerCase()
}

