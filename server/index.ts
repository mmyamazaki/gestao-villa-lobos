/**
 * API com Prisma — cursos, professores e alunos persistidos no Supabase/Postgres.
 * Em produção pode servir também o frontend (pasta dist/) no mesmo processo.
 * Inicie com: npm run server (dev/tsx), npm start ou node server.js (produção → dist-server).
 */
import 'dotenv/config'

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import bcrypt from 'bcryptjs'
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
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_MS,
  readCookie,
  signAdminSessionToken,
  verifyAdminSessionToken,
} from './adminSession.js'
import {
  bootstrapAdminEmailLower,
  provisionalPasswordMatches,
  readProvisionalPasswordEnv,
} from './provisionalAdminAuth.js'

const MIN_ADMIN_PASSWORD_LEN = 8

function adminSessionEmailOrNull(req: Request): string | null {
  const token = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE)
  if (!token) return null
  return verifyAdminSessionToken(token)?.email ?? null
}

function primaryAdminEmailLowerServer(): string | null {
  return bootstrapAdminEmailLower()
}

const app = express()

const NODE_ENV = process.env.NODE_ENV ?? 'development'

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

/** Padrão Node / Hostinger (Kodee): `process.env.PORT` com fallback 3000 */
const port = Number(process.env.PORT || 3000)

/** Diagnóstico Hostinger: deve aparecer em Runtime logs se o processo arrancar. */
console.log('BOOT', { port: process.env.PORT, cwd: process.cwd() })

/**
 * Pasta `dist/` do Vite: em alguns hosts `process.cwd()` não é a raiz do repo (entry file
 * ou script de arranque), e `join(cwd,'dist')` fica vazio/incompleto — o fallback SPA acaba
 * por servir `index.html` para `/assets/*.css` e o layout “desaparece”.
 */
function resolveDistDir(): string {
  const here = fileURLToPath(new URL('.', import.meta.url))
  const candidates = [
    join(process.cwd(), 'dist'),
    join(here, '..', 'dist'),
    join(here, '..', '..', 'dist'),
  ]
  for (const d of candidates) {
    if (existsSync(join(d, 'index.html'))) return d
  }
  return candidates[0]!
}

const distDir = resolveDistDir()

function shouldServeSpaIndexHtml(req: Request): boolean {
  if (req.method !== 'GET') return false
  const p = req.path
  if (p.startsWith('/api')) return false
  if (p.startsWith('/assets/')) return false
  if (/\.(css|js|mjs|map|ico|png|jpe?g|gif|webp|svg|avif|woff2?|ttf|eot|txt|pdf|json)$/i.test(p))
    return false
  return true
}

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

app.get('/api/health/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, database: true })
  } catch (e) {
    console.error('[api/health/db]', e)
    res.status(503).json({
      ok: false,
      database: false,
      error: e instanceof Error ? e.message : 'database_unavailable',
    })
  }
})

app.post('/api/auth/admin/login', async (req: Request, res: Response) => {
  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!emailRaw || !password) {
      res.status(400).json({ ok: false, error: 'E-mail e senha são obrigatórios.' })
      return
    }
    const provisional = readProvisionalPasswordEnv()
    let admin = await prisma.admin.findUnique({ where: { email: emailRaw } })
    let provisioned = false

    if (!admin) {
      const boot = bootstrapAdminEmailLower()
      const canBootstrap =
        Boolean(provisional) &&
        boot === emailRaw &&
        provisionalPasswordMatches(password, provisional)
      if (!canBootstrap) {
        res.status(401).json({ ok: false, error: 'Credenciais inválidas.' })
        return
      }
      const passwordHash = await bcrypt.hash(password, 10)
      const name =
        process.env.ADMIN_NAME?.trim() ||
        process.env.ADMIN_BOOTSTRAP_NAME?.trim() ||
        'Administrador principal'
      try {
        admin = await prisma.admin.create({
          data: { email: emailRaw, name, passwordHash },
        })
        provisioned = true
        console.warn(
          '[api/auth/admin/login] Primeiro admin criado via ADMIN_PROVISIONAL_PASSWORD. Defina a senha em Configurações e remova ADMIN_PROVISIONAL_PASSWORD do painel.',
        )
      } catch (createErr) {
        console.error('[api/auth/admin/login] Falha ao criar admin (RLS ou permissões?)', createErr)
        res.status(500).json({
          ok: false,
          error:
            'Não foi possível criar o administrador. No Supabase, desative RLS em `admins` ou rode o seed com DATABASE_URL.',
        })
        return
      }
    } else {
      const hashOk = await bcrypt.compare(password, admin.passwordHash)
      const provOk = provisionalPasswordMatches(password, provisional)
      if (!hashOk && !provOk) {
        res.status(401).json({ ok: false, error: 'Credenciais inválidas.' })
        return
      }
      if (!hashOk && provOk) {
        console.warn(
          '[api/auth/admin/login] Login com ADMIN_PROVISIONAL_PASSWORD. Troque a senha em Configurações e remova a variável no servidor.',
        )
      }
    }

    const token = signAdminSessionToken(admin.email)
    const secure = NODE_ENV === 'production'
    res.cookie(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_MS,
    })
    res.json({ ok: true, provisioned })
  } catch (e) {
    console.error('[api/auth/admin/login]', e)
    res.status(500).json({ ok: false, error: 'Erro no servidor.' })
  }
})

/** 200 + { ok: false } quando não há sessão — evita 401 no DevTools em carregamento normal. */
app.get('/api/auth/admin/me', (req: Request, res: Response) => {
  try {
    const token = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE)
    if (!token) {
      res.json({ ok: false })
      return
    }
    const payload = verifyAdminSessionToken(token)
    if (!payload) {
      res.json({ ok: false })
      return
    }
    res.json({ ok: true, email: payload.email })
  } catch (e) {
    console.error('[api/auth/admin/me]', e)
    res.status(500).json({ ok: false })
  }
})

app.post('/api/auth/admin/logout', (_req: Request, res: Response) => {
  const secure = NODE_ENV === 'production'
  res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/', secure, sameSite: 'lax' })
  res.json({ ok: true })
})

/** CRUD de administradores só com cookie de sessão secretaria — não expor `admins` à chave anon. */
app.get('/api/admins', async (req: Request, res: Response) => {
  if (!adminSessionEmailOrNull(req)) {
    res.status(401).json({ error: 'Não autorizado.' })
    return
  }
  try {
    const rows = await prisma.admin.findMany({
      orderBy: { email: 'asc' },
      select: { id: true, email: true, name: true },
    })
    res.json(rows)
  } catch (e) {
    console.error('[api/admins GET]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao listar administradores.' })
  }
})

app.post('/api/admins', async (req: Request, res: Response) => {
  if (!adminSessionEmailOrNull(req)) {
    res.status(401).json({ error: 'Não autorizado.' })
    return
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!name || !email) {
    res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' })
    return
  }
  if (password.length < MIN_ADMIN_PASSWORD_LEN) {
    res
      .status(400)
      .json({ error: `A senha deve ter pelo menos ${MIN_ADMIN_PASSWORD_LEN} caracteres.` })
    return
  }
  try {
    await prisma.admin.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
      },
    })
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(400).json({ error: 'Já existe um administrador com este e-mail.' })
      return
    }
    console.error('[api/admins POST]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao criar administrador.' })
  }
})

app.patch('/api/admins/:id', async (req: Request, res: Response) => {
  if (!adminSessionEmailOrNull(req)) {
    res.status(401).json({ error: 'Não autorizado.' })
    return
  }
  const id = routeParamId(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'ID inválido.' })
    return
  }
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!name || !email) {
    res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' })
    return
  }
  if (password.length > 0 && password.length < MIN_ADMIN_PASSWORD_LEN) {
    res
      .status(400)
      .json({ error: `A senha deve ter pelo menos ${MIN_ADMIN_PASSWORD_LEN} caracteres.` })
    return
  }

  const primary = primaryAdminEmailLowerServer()
  try {
    const existing = await prisma.admin.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Administrador não encontrado.' })
      return
    }
    const wasPrimary = primary != null && existing.email.toLowerCase() === primary
    if (wasPrimary && email !== existing.email.toLowerCase()) {
      res.status(400).json({
        error:
          'O e-mail do administrador principal não pode ser alterado (VITE_ADMIN_EMAIL / ADMIN_EMAIL).',
      })
      return
    }
    if (email !== existing.email.toLowerCase()) {
      const clash = await prisma.admin.findUnique({ where: { email } })
      if (clash && clash.id !== id) {
        res.status(400).json({ error: 'Já existe um administrador com este e-mail.' })
        return
      }
    }
    const data: { name: string; email: string; passwordHash?: string } = { name, email }
    if (password.length > 0) {
      data.passwordHash = await bcrypt.hash(password, 10)
    }
    await prisma.admin.update({ where: { id }, data })
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(400).json({ error: 'Já existe um administrador com este e-mail.' })
      return
    }
    console.error('[api/admins PATCH]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao atualizar administrador.' })
  }
})

app.delete('/api/admins/:id', async (req: Request, res: Response) => {
  if (!adminSessionEmailOrNull(req)) {
    res.status(401).json({ error: 'Não autorizado.' })
    return
  }
  const id = routeParamId(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'ID inválido.' })
    return
  }
  const primary = primaryAdminEmailLowerServer()
  try {
    const row = await prisma.admin.findUnique({ where: { id } })
    if (!row) {
      res.status(404).json({ error: 'Administrador não encontrado.' })
      return
    }
    if (primary != null && row.email.toLowerCase() === primary) {
      res.status(400).json({ error: 'O administrador principal não pode ser excluído.' })
      return
    }
    await prisma.admin.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error('[api/admins DELETE]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao excluir administrador.' })
  }
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

/**
 * Tabela/colunas em falta no Postgres (migração não aplicada) → devolve [] com 200 para o SPA
 * não ficar com 500 no DevTools; PANIC/ligação Prisma continua a ser 500.
 */
function shouldReturnEmptyMensalidadesForSchemaDrift(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  if (/panic|timer has gone away/i.test(msg)) return false
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === 'P2021' || e.code === 'P2022'
  }
  return (
    (/does not exist|não existe|Could not find the table/i.test(msg) &&
      /Mensalidade|mensalidade|manual_fine|manual_interest|adjustment_notes/i.test(msg)) ||
    (/column/i.test(msg) && /does not exist/i.test(msg))
  )
}

app.get('/api/mensalidades', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.mensalidade.findMany({
      orderBy: [{ studentId: 'asc' }, { parcelNumber: 'asc' }],
    })
    res.json(rows.map(mensalidadeFromPrisma))
  } catch (e) {
    console.error('[api/mensalidades]', e)
    if (shouldReturnEmptyMensalidadesForSchemaDrift(e)) {
      console.warn(
        '[api/mensalidades] schema desatualizado — lista vazia. No Supabase: `npx prisma db push` (com DATABASE_URL) ou SQL em prisma/sql/add_mensalidade_manual_fees.sql',
      )
      res.json([])
      return
    }
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
  const assetsDir = join(distDir, 'assets')
  if (!existsSync(assetsDir)) {
    console.warn(
      `[api] AVISO: pasta assets ausente em ${assetsDir} — corra npm run build e redeploy (CSS/JS).`,
    )
  }
  app.use(express.static(distDir, { index: false }))
  app.use((req: Request, res: Response, next) => {
    if (!shouldServeSpaIndexHtml(req)) {
      next()
      return
    }
    res.sendFile(join(distDir, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
} else {
  console.warn(`[api] AVISO: dist não encontrada (${distDir}) — só API ou cwd errado.`)
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log('LISTENING', port)
  console.log(
    `[api] NODE_ENV=${NODE_ENV} process.env.PORT=${process.env.PORT ?? '(unset)'} → listening on http://0.0.0.0:${port}`,
  )
  if (existsSync(join(distDir, 'index.html'))) {
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
