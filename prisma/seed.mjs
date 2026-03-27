import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function adminEmail() {
  const e = process.env.VITE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'secretaria@escola.br'
  return e.trim().toLowerCase()
}

function adminPlainPassword() {
  return process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123'
}

async function main() {
  const email = adminEmail()
  const plain = adminPlainPassword()
  const passwordHash = await bcrypt.hash(plain, 10)
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  })
  console.log('[seed] Administrador sincronizado no banco:', email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
