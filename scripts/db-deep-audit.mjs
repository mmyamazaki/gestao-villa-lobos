import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeDatabaseUrlForPrisma } from './lib/normalize-database-url.mjs'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') })

const raw = process.env.DATABASE_URL?.trim()
const url = raw ? normalizeDatabaseUrlForPrisma(raw) : undefined
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined)

const REQUIRED_TABLE_COLUMNS = {
  Course: ['id', 'instrument', 'instrumentLabel', 'levelLabel', 'monthlyPrice'],
  Teacher: ['id', 'nome', 'instrumentSlugs', 'schedule'],
  Student: ['id', 'codigo', 'nome', 'enrollment', 'status'],
  Mensalidade: ['id', 'studentId', 'courseId', 'manual_fine', 'manual_interest', 'adjustment_notes'],
  LessonLog: ['id', 'teacherId', 'studentId', 'lessonDate', 'slotKey'],
  ReplacementClass: ['id', 'studentId', 'teacherId', 'date', 'startTime'],
  SchoolSettings: ['id', 'observacoesInternas'],
  admins: ['id', 'email', 'password_hash', 'created_at', 'updated_at'],
}

async function main() {
  const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
  const cols = await prisma.$queryRaw`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`
  const policies = await prisma.$queryRaw`SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname='public'`

  const tableSet = new Set(tables.map((x) => x.table_name))
  const colsMap = new Map()
  for (const c of cols) {
    const set = colsMap.get(c.table_name) ?? new Set()
    set.add(c.column_name)
    colsMap.set(c.table_name, set)
  }

  const missingTables = []
  const missingColumns = []
  for (const [table, required] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
    if (!tableSet.has(table)) {
      missingTables.push(table)
      continue
    }
    const set = colsMap.get(table) ?? new Set()
    const miss = required.filter((c) => !set.has(c))
    if (miss.length > 0) missingColumns.push({ table, columns: miss })
  }

  const anonPolicies = policies.filter((p) => (p.roles ?? []).some((r) => r === 'anon' || r === 'public'))

  const report = {
    ok: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
    anonPolicies: anonPolicies.map((p) => ({ table: p.tablename, policy: p.policyname })),
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 2
}

main()
  .catch((e) => {
    console.error('[db-deep-audit] failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
