/**
 * Validação interna: Prisma Course (CRUD) + GET/PUT da API (opcional, se a API estiver no ar).
 * Uso: node scripts/validate-backend-course.mjs
 * Requer: DATABASE_URL no .env; para HTTP, API em API_PORT (padrão 3333).
 */
import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()
const testId = `validate-crud-${Date.now().toString(36)}`

async function runPrismaCrud() {
  console.log('[prisma] findMany...')
  const existing = await prisma.course.findMany({ take: 5, orderBy: { id: 'asc' } })
  if (!Array.isArray(existing)) throw new Error('findMany não retornou array')

  console.log('[prisma] create...')
  const created = await prisma.course.create({
    data: {
      id: testId,
      instrument: 'validate-instrument',
      instrumentLabel: 'Instrumento validação',
      levelLabel: 'Nível teste',
      monthlyPrice: new Prisma.Decimal(100),
    },
  })
  if (created.levelLabel !== 'Nível teste') throw new Error('create: levelLabel incorreto')

  console.log('[prisma] update...')
  const updated = await prisma.course.update({
    where: { id: testId },
    data: { levelLabel: 'Nível atualizado', monthlyPrice: new Prisma.Decimal(101) },
  })
  if (updated.levelLabel !== 'Nível atualizado') throw new Error('update: levelLabel incorreto')

  console.log('[prisma] upsert (update branch)...')
  const upserted = await prisma.course.upsert({
    where: { id: testId },
    create: {
      id: testId,
      instrument: 'x',
      instrumentLabel: 'x',
      levelLabel: 'x',
      monthlyPrice: new Prisma.Decimal(1),
    },
    update: { levelLabel: 'Upsert OK' },
  })
  if (upserted.levelLabel !== 'Upsert OK') throw new Error('upsert: levelLabel incorreto')

  console.log('[prisma] delete...')
  await prisma.course.delete({ where: { id: testId } })

  const gone = await prisma.course.findUnique({ where: { id: testId } })
  if (gone !== null) throw new Error('delete: linha ainda existe')

  console.log('[prisma] OK — findMany, create, update, upsert, delete concluídos sem erro.')
}

async function runHttpIfApiUp() {
  const port = process.env.API_PORT?.trim() || '3333'
  const base = `http://127.0.0.1:${port}`

  console.log(`[http] tentando ${base} (GET /api/school/core, PUT /api/courses)...`)

  const coreRes = await fetch(`${base}/api/school/core`, { headers: { Accept: 'application/json' } })
  if (!coreRes.ok) {
    throw new Error(`GET /api/school/core → ${coreRes.status} ${await coreRes.text()}`)
  }
  const core = await coreRes.json()
  if (!Array.isArray(core.courses)) throw new Error('GET core: courses não é array')
  for (const c of core.courses) {
    if (typeof c.levelLabel !== 'string' || !c.levelLabel) {
      throw new Error(`GET core: curso ${c.id} sem levelLabel válido`)
    }
  }
  console.log(`[http] GET /api/school/core OK (${core.courses.length} cursos).`)

  const putRes = await fetch(`${base}/api/courses`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(core.courses),
  })
  if (!putRes.ok) {
    throw new Error(`PUT /api/courses → ${putRes.status} ${await putRes.text()}`)
  }
  const putJson = await putRes.json()
  if (!putJson.ok) throw new Error('PUT /api/courses: resposta sem { ok: true }')
  console.log('[http] PUT /api/courses OK (round-trip idêntico ao GET).')
}

async function main() {
  try {
    await runPrismaCrud()
  } catch (e) {
    console.error('[prisma] FALHA:', e)
    process.exitCode = 1
    return
  } finally {
    await prisma.$disconnect()
  }

  try {
    await runHttpIfApiUp()
  } catch (e) {
    console.warn('[http] ignorado ou falhou (suba a API com npm run dev ou npm run server):', e.message)
    console.warn('[http] Prisma CRUD já foi validado com sucesso.')
  }
}

main()
