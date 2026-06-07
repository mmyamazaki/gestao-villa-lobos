/**
 * Aplica (idempotente) a coluna `cycle` na tabela Mensalidade, reusando o caminho de ligação do app
 * (driver `pg`, porta de sessão). Seguro para reaplicar: usa ADD COLUMN IF NOT EXISTS.
 *
 * Uso: node scripts/apply-cycle-column.mjs
 */
import 'dotenv/config'

import { makePrismaClient } from './lib/make-prisma.mjs'

const prisma = makePrismaClient()

try {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Mensalidade" ADD COLUMN IF NOT EXISTS "cycle" INTEGER NOT NULL DEFAULT 1;',
  )
  const [{ count }] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS count FROM "Mensalidade" WHERE "cycle" = 1;',
  )
  console.log(`[apply-cycle-column] OK. Parcelas com cycle=1: ${count}.`)
} catch (e) {
  console.error('[apply-cycle-column] FALHOU:', e?.message ?? e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
