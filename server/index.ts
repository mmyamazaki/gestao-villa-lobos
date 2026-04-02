/**
 * API com Prisma — cursos, professores e alunos persistidos no Supabase/Postgres.
 * Em produção pode servir também o frontend (pasta dist/) no mesmo processo.
 * Inicie com: npm run server (dev/tsx), npm start ou node server.js (produção → dist-server).
 */
import 'dotenv/config'

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { Prisma } from '@prisma/client'
import type { Course, MensalidadeRegistrada, Student, Teacher } from '../src/domain/types.js'
import { prisma } from './prisma.js'
import {
  courseFromPrisma,
  courseToPrisma,
  mensalidadeFromPrisma,
  mensalidadeToPrismaUnchecked,
  normalizeCourseFromClient,
  studentFromPrisma,
  studentToPrisma,
  teacherFromPrisma,
  teacherToPrisma,
} from './mappers.js'
const app = express()

const NODE_ENV = process.env.NODE_ENV ?? 'development'

/** Padrão Node / Hostinger (Kodee): `process.env.PORT` com fallback 3000 */
const port = Number(process.env.PORT || 3000)

/** Diagnóstico Hostinger: deve aparecer em Runtime logs se o processo arrancar. */
console.log('BOOT', { port: process.env.PORT, cwd: process.cwd() })

/** `dist/` fica na raiz do projeto; em produção o código compilado vive em dist-server/server/. */
const distDir = join(process.cwd(), 'dist')

function resolveCorsOrigin(): boolean | string | RegExp | (string | RegExp)[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim()
  if (!raw) return true
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (list.length === 0) return true
  return list.length === 1 ? list[0]! : list
}

if (!process.env.DATABASE_URL?.trim()) {
  console.warn(
    '[api] AVISO: DATABASE_URL ausente ou vazio no .env. Copie .env.example para .env e cole a connection string do Supabase.',
  )
}

/** courseId presente em algum aluno com matrícula ativa (JSON enrollment). */
async function getCourseIdsWithEnrollment(): Promise<Set<string>> {
  const rows = await prisma.student.findMany({ select: { enrollment: true } })
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.enrollment == null || typeof r.enrollment !== 'object') continue
    const en = r.enrollment as { courseId?: string }
    if (en.courseId) ids.add(en.courseId)
  }
  return ids
}

app.use(
  cors({
    origin: resolveCorsOrigin(),
    credentials: true,
  }),
)
app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'gestao-villa-lobos-api' })
})

app.get('/api/school/core', async (_req: Request, res: Response) => {
  try {
    const [courses, teachers, students] = await Promise.all([
      prisma.course.findMany({ orderBy: { id: 'asc' } }),
      prisma.teacher.findMany({ orderBy: { nome: 'asc' } }),
      prisma.student.findMany({ orderBy: { nome: 'asc' } }),
    ])
    res.json({
      courses: courses.map(courseFromPrisma),
      teachers: teachers.map(teacherFromPrisma),
      students: students.map(studentFromPrisma),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro no servidor' })
  }
})

async function syncCourses(list: Course[]) {
  const existing = await prisma.course.findMany()
  const byId = new Map(existing.map((c) => [c.id, c]))
  const blockedPriceChange = await getCourseIdsWithEnrollment()
  for (const c of list) {
    const prev = byId.get(c.id)
    if (!prev) continue
    const prevPrice = Number(prev.monthlyPrice)
    if (c.monthlyPrice !== prevPrice && blockedPriceChange.has(c.id)) {
      throw new Error(
        'Não é possível alterar o valor da mensalidade: existem alunos matriculados neste curso. Crie um novo curso para novos valores.',
      )
    }
  }

  const ids = list.map((c) => c.id)
  await prisma.$transaction(async (tx) => {
    if (ids.length === 0) {
      await tx.course.deleteMany()
      return
    }
    await tx.course.deleteMany({ where: { id: { notIn: ids } } })
    for (const c of list) {
      const data = courseToPrisma(c)
      await tx.course.upsert({
        where: { id: c.id },
        create: data,
        update: {
          instrument: data.instrument,
          instrumentLabel: data.instrumentLabel,
          levelLabel: data.levelLabel,
          monthlyPrice: data.monthlyPrice,
        },
      })
    }
  })
}

app.put('/api/courses', async (req: Request, res: Response) => {
  if (process.env.API_DEBUG === '1') {
    console.log('[PUT /api/courses] body:', req.body)
  }
  try {
    const raw = req.body
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: 'Body deve ser um array de cursos.' })
      return
    }
    const list: Course[] = raw.map((item, i) => normalizeCourseFromClient(item, i))
    await syncCourses(list)
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[PUT /api/courses]', e)
    const msg = e instanceof Error ? e.message : 'Erro ao salvar cursos'
    const isBusiness =
      msg.includes('Não é possível alterar o valor') ||
      msg.includes('obrigatório') ||
      msg.includes('inválid') ||
      msg.includes('formato') ||
      msg.includes('Curso ')
    if (res.headersSent) return
    res.status(isBusiness ? 400 : 500).json({ error: msg })
  }
})

/** Remove todos os níveis (linhas) de um instrumento (Course.instrument). */
app.delete('/api/courses/:instrument', async (req: Request, res: Response) => {
  const raw = routeParamId(req.params.instrument)
  if (!raw) {
    res.status(400).json({ error: 'Instrumento inválido.' })
    return
  }
  let instrument: string
  try {
    instrument = decodeURIComponent(raw)
  } catch {
    res.status(400).json({ error: 'Instrumento inválido (encoding).' })
    return
  }
  try {
    const toRemove = await prisma.course.findMany({
      where: { instrument },
      select: { id: true },
    })
    if (toRemove.length === 0) {
      res.status(404).json({ error: 'Nenhum curso encontrado para este instrumento.' })
      return
    }
    const blocked = await getCourseIdsWithEnrollment()
    for (const row of toRemove) {
      if (blocked.has(row.id)) {
        res.status(400).json({
          error:
            'Não é possível excluir: existem alunos matriculados em cursos deste instrumento.',
        })
        return
      }
    }
    await prisma.course.deleteMany({ where: { instrument } })
    const courses = await prisma.course.findMany({ orderBy: { id: 'asc' } })
    res.status(200).json({ courses: courses.map(courseFromPrisma) })
  } catch (e) {
    console.error('[DELETE /api/courses/:instrument]', e)
    if (res.headersSent) return
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao excluir cursos' })
  }
})

function routeParamId(p: string | string[] | undefined): string | undefined {
  if (p == null) return undefined
  return typeof p === 'string' ? p : p[0]
}

/** Atualiza só o nome exibido (instrumentLabel) em todas as linhas do mesmo instrument (slug). */
app.patch('/api/courses/instrument/:instrument', async (req: Request, res: Response) => {
  const raw = routeParamId(req.params.instrument)
  if (!raw) {
    res.status(400).json({ error: 'Instrumento inválido.' })
    return
  }
  let instrument: string
  try {
    instrument = decodeURIComponent(raw)
  } catch {
    res.status(400).json({ error: 'Instrumento inválido (encoding).' })
    return
  }
  const body = req.body as { instrumentLabel?: unknown }
  const instrumentLabel =
    body.instrumentLabel !== undefined ? String(body.instrumentLabel).trim() : ''
  if (!instrumentLabel) {
    res.status(400).json({ error: 'Envie instrumentLabel com o novo nome do curso.' })
    return
  }
  try {
    const count = await prisma.course.count({ where: { instrument } })
    if (count === 0) {
      res.status(404).json({ error: 'Nenhum curso encontrado para este instrumento.' })
      return
    }
    await prisma.course.updateMany({
      where: { instrument },
      data: { instrumentLabel },
    })
    const courses = await prisma.course.findMany({ orderBy: { id: 'asc' } })
    res.status(200).json({ courses: courses.map(courseFromPrisma) })
  } catch (e) {
    console.error('[PATCH /api/courses/instrument/:instrument]', e)
    if (res.headersSent) return
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao atualizar nome do curso' })
  }
})

/** Atualiza um curso: nome (todos os estágios do mesmo instrumento) e/ou mensalidade (só este id). */
app.patch('/api/courses/:id', async (req: Request, res: Response) => {
  if (process.env.API_DEBUG === '1') {
    console.log('[PATCH /api/courses/:id]', req.params, req.body)
  }
  try {
    const id = routeParamId(req.params.id)
    if (!id) {
      res.status(400).json({ error: 'ID do curso inválido.' })
      return
    }
    const body = req.body as {
      instrumentLabel?: unknown
      levelLabel?: unknown
      monthlyPrice?: unknown
    }
    const course = await prisma.course.findUnique({ where: { id } })
    if (!course) {
      res.status(404).json({ error: 'Curso não encontrado.' })
      return
    }

    const instrumentLabel =
      body.instrumentLabel !== undefined ? String(body.instrumentLabel).trim() : undefined
    if (instrumentLabel !== undefined && instrumentLabel.length === 0) {
      res.status(400).json({ error: 'Nome do curso não pode ser vazio.' })
      return
    }

    const levelLabel =
      body.levelLabel !== undefined ? String(body.levelLabel).trim() : undefined
    if (levelLabel !== undefined && levelLabel.length === 0) {
      res.status(400).json({ error: 'Nível / Ano não pode ser vazio.' })
      return
    }

    let monthlyPrice: number | undefined
    if (body.monthlyPrice !== undefined) {
      const n = Number(body.monthlyPrice)
      if (Number.isNaN(n) || n < 0) {
        res.status(400).json({ error: 'Valor da mensalidade inválido.' })
        return
      }
      monthlyPrice = n
    }

    if (instrumentLabel === undefined && levelLabel === undefined && monthlyPrice === undefined) {
      res.status(400).json({ error: 'Envie instrumentLabel, levelLabel e/ou monthlyPrice.' })
      return
    }

    const currPrice = Number(course.monthlyPrice)
    if (monthlyPrice !== undefined && monthlyPrice !== currPrice) {
      const blocked = await getCourseIdsWithEnrollment()
      if (blocked.has(id)) {
        res.status(400).json({
          error:
            'Não é possível alterar o valor pois existem alunos matriculados neste curso. Crie um novo curso para novos valores.',
        })
        return
      }
    }

    await prisma.$transaction(async (tx) => {
      if (instrumentLabel !== undefined) {
        await tx.course.updateMany({
          where: { instrument: course.instrument },
          data: { instrumentLabel },
        })
      }
      const rowPatch: { levelLabel?: string; monthlyPrice?: Prisma.Decimal } = {}
      if (levelLabel !== undefined) rowPatch.levelLabel = levelLabel
      if (monthlyPrice !== undefined) {
        rowPatch.monthlyPrice = new Prisma.Decimal(monthlyPrice)
      }
      if (Object.keys(rowPatch).length > 0) {
        await tx.course.update({
          where: { id },
          data: rowPatch,
        })
      }
    })

    const courses = await prisma.course.findMany({ orderBy: { id: 'asc' } })
    res.status(200).json({ courses: courses.map(courseFromPrisma) })
  } catch (e) {
    console.error('[PATCH /api/courses/:id]', e)
    if (res.headersSent) return
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao atualizar curso' })
  }
})

app.put('/api/teachers/:id', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body
    if (rawBody == null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      res.status(400).json({ error: 'Corpo da requisição inválido: esperado JSON do professor.' })
      return
    }
    const t = rawBody as Teacher
    const paramId = routeParamId(req.params.id)
    if (!paramId || typeof t.id !== 'string' || !t.id.trim()) {
      res.status(400).json({ error: 'ID do professor ausente ou inválido no corpo JSON.' })
      return
    }
    if (paramId !== t.id) {
      res.status(400).json({ error: 'ID inconsistente entre URL e corpo.' })
      return
    }
    const data = teacherToPrisma(t)
    await prisma.teacher.upsert({
      where: { id: t.id },
      create: data,
      update: {
        nome: data.nome,
        dataNascimento: data.dataNascimento,
        naturalidade: data.naturalidade,
        filiacao: data.filiacao,
        rg: data.rg,
        cpf: data.cpf,
        endereco: data.endereco,
        contatos: data.contatos,
        email: data.email,
        celular: data.celular,
        login: data.login,
        senha: data.senha,
        instrumentSlugs: data.instrumentSlugs,
        schedule: data.schedule,
      },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao salvar professor' })
  }
})

/** Remove o professor apenas se nenhum aluno tiver matrícula vinculada a ele. */
async function handleTeacherDelete(req: Request, res: Response) {
  try {
    const id = (routeParamId(req.params.id) ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'ID do professor obrigatório.' })
      return
    }

    const allStudents = await prisma.student.findMany({
      select: { id: true, nome: true, enrollment: true },
    })
    const blocking = allStudents.filter((row) => {
      const en = row.enrollment
      if (en == null || typeof en !== 'object' || Array.isArray(en)) return false
      return (en as { teacherId?: string }).teacherId === id
    })
    if (blocking.length > 0) {
      const lista = blocking.map((s) => s.nome || s.id).join(', ')
      res.status(400).json({
        error:
          `Existem ${blocking.length} aluno(s) matriculado(s) com este professor. ` +
          `Transfira cada um para outro professor e horários na aba Alunos (editar matrícula) antes de excluir. ` +
          `Alunos: ${lista}.`,
      })
      return
    }

    const del = await prisma.teacher.deleteMany({ where: { id } })
    if (del.count === 0) {
      res.status(404).json({ error: 'Professor não encontrado.' })
      return
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('[DELETE/POST teacher]', e)
    if (res.headersSent) return
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao excluir professor' })
  }
}

app.delete('/api/teachers/:id', handleTeacherDelete)
/** Alguns proxies só encaminham GET/POST; o cliente usa esta rota como principal. */
app.post('/api/teachers/:id/delete', handleTeacherDelete)

app.put('/api/students/:id', async (req: Request, res: Response) => {
  try {
    const s = req.body as Student
    const paramId = routeParamId(req.params.id)
    if (!paramId || paramId !== s.id) {
      res.status(400).json({ error: 'ID inconsistente.' })
      return
    }
    const data = studentToPrisma(s)
    await prisma.student.upsert({
      where: { id: s.id },
      create: data,
      update: {
        codigo: data.codigo,
        nome: data.nome,
        dataNascimento: data.dataNascimento,
        rg: data.rg,
        cpf: data.cpf,
        filiacao: data.filiacao,
        endereco: data.endereco,
        telefone: data.telefone,
        email: data.email,
        login: data.login,
        senha: data.senha,
        responsavel: data.responsavel,
        enrollment: data.enrollment,
        status: data.status,
        dataCancelamento: data.dataCancelamento,
        observacoesCancelamento: data.observacoesCancelamento,
      },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao salvar aluno' })
  }
})

app.get('/api/mensalidades', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.mensalidade.findMany({
      orderBy: [{ studentId: 'asc' }, { parcelNumber: 'asc' }],
    })
    res.json(rows.map(mensalidadeFromPrisma))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao listar mensalidades' })
  }
})

app.put('/api/mensalidades/:id', async (req: Request, res: Response) => {
  try {
    const paramId = routeParamId(req.params.id)
    const body = req.body as MensalidadeRegistrada
    if (!paramId || paramId !== body?.id?.trim()) {
      res.status(400).json({ error: 'ID inconsistente ou ausente.' })
      return
    }
    const data = mensalidadeToPrismaUnchecked(body)
    await prisma.mensalidade.upsert({
      where: { id: body.id },
      create: data,
      update: data,
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao salvar mensalidade' })
  }
})

if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }))
  app.use((req: Request, res: Response, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next()
      return
    }
    res.sendFile(join(distDir, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log('LISTENING', port)
  console.log(
    `[api] NODE_ENV=${NODE_ENV} process.env.PORT=${process.env.PORT ?? '(unset)'} → listening on http://0.0.0.0:${port}`,
  )
  if (existsSync(distDir)) {
    console.log(`[api] servindo frontend estático de ${distDir}`)
  }
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[api] Porta ${port} já está em uso. Encerre o outro processo ou ajuste PORT no ambiente.`,
    )
  } else {
    console.error('[api] Erro ao abrir o servidor:', err.message)
  }
  process.exit(1)
})
