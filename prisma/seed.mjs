import bcrypt from 'bcryptjs'

import { makePrismaClient } from '../scripts/lib/make-prisma.mjs'

const prisma = makePrismaClient()

function adminEmail() {
  const e = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'secretaria@escola.br'
  return e.trim().toLowerCase()
}

function adminPlainPassword() {
  return process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || 'admin123'
}

function adminDisplayName() {
  return process.env.ADMIN_NAME?.trim() || 'Administrador principal'
}

async function main() {
  const email = adminEmail()
  const plain = adminPlainPassword()
  const passwordHash = await bcrypt.hash(plain, 10)
  const name = adminDisplayName()
  await prisma.admin.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { passwordHash },
  })
  console.log('[seed] Administrador sincronizado na tabela admins:', email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
