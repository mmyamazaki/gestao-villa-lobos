import { Prisma } from '@prisma/client'
import type { Course, Student, Teacher } from '../src/domain/types.js'
import type { ScheduleMap } from '../src/domain/types.js'

export function courseToPrisma(c: Course): Prisma.CourseCreateInput {
  return {
    id: c.id,
    instrument: c.instrument,
    instrumentLabel: c.instrumentLabel,
    levelLabel: c.levelLabel,
    monthlyPrice: new Prisma.Decimal(c.monthlyPrice),
  }
}

export function courseFromPrisma(c: {
  id: string
  instrument: string
  instrumentLabel: string
  levelLabel: string
  monthlyPrice: unknown
}): Course {
  return {
    id: c.id,
    instrument: c.instrument,
    instrumentLabel: c.instrumentLabel,
    levelLabel: c.levelLabel,
    monthlyPrice: Number(c.monthlyPrice),
  }
}

/**
 * Normaliza o JSON do PUT /api/courses.
 * Aceita opcionalmente `stage` numérico no **body JSON** (clientes muito antigos) — não é coluna do banco;
 * o schema Prisma/Postgres usa apenas `levelLabel`.
 */
export function normalizeCourseFromClient(raw: unknown, index: number): Course {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Curso ${index + 1}: formato inválido.`)
  }
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  if (!id) {
    throw new Error(`Curso ${index + 1}: id obrigatório.`)
  }
  const instrument = typeof o.instrument === 'string' ? o.instrument : ''
  const instrumentLabel =
    typeof o.instrumentLabel === 'string' ? o.instrumentLabel.trim() : ''
  let levelLabel = typeof o.levelLabel === 'string' ? o.levelLabel.trim() : ''
  if (!levelLabel && typeof o.stage === 'number' && Number.isFinite(o.stage)) {
    levelLabel = `${o.stage}º estágio`
  }
  if (!levelLabel) {
    levelLabel = 'Nível'
  }
  const monthlyPrice = Number(o.monthlyPrice)
  if (Number.isNaN(monthlyPrice) || monthlyPrice < 0) {
    throw new Error(`Curso "${id}": mensalidade inválida.`)
  }
  return {
    id,
    instrument,
    instrumentLabel: instrumentLabel || instrument || 'Curso',
    levelLabel,
    monthlyPrice,
  }
}

export function teacherToPrisma(t: Teacher): Prisma.TeacherCreateInput {
  return {
    id: t.id,
    nome: t.nome,
    dataNascimento: t.dataNascimento,
    naturalidade: t.naturalidade,
    filiacao: t.filiacao,
    rg: t.rg,
    cpf: t.cpf,
    endereco: t.endereco,
    contatos: t.contatos,
    email: t.email,
    celular: t.celular,
    login: t.login,
    senha: t.senha,
    instrumentSlugs: [...t.instrumentSlugs],
    schedule: t.schedule as Prisma.InputJsonValue,
  }
}

export function teacherFromPrisma(t: {
  id: string
  nome: string
  dataNascimento: string
  naturalidade: string
  filiacao: string
  rg: string
  cpf: string
  endereco: string
  contatos: string
  email: string
  celular: string
  login: string
  senha: string
  instrumentSlugs: string[]
  schedule: Prisma.JsonValue
}): Teacher {
  return {
    id: t.id,
    nome: t.nome,
    dataNascimento: t.dataNascimento,
    naturalidade: t.naturalidade,
    filiacao: t.filiacao,
    rg: t.rg,
    cpf: t.cpf,
    endereco: t.endereco,
    contatos: t.contatos,
    email: t.email,
    celular: t.celular,
    login: t.login,
    senha: t.senha,
    instrumentSlugs: [...t.instrumentSlugs],
    schedule: (t.schedule ?? {}) as ScheduleMap,
  }
}

export function studentToPrisma(s: Student): Prisma.StudentCreateInput {
  return {
    id: s.id,
    codigo: s.codigo,
    nome: s.nome,
    dataNascimento: s.dataNascimento,
    rg: s.rg,
    cpf: s.cpf,
    filiacao: s.filiacao,
    endereco: s.endereco,
    telefone: s.telefone,
    email: s.email,
    login: s.login,
    senha: s.senha,
    responsavel:
      s.responsavel == null ? Prisma.JsonNull : (s.responsavel as unknown as Prisma.InputJsonValue),
    enrollment: s.enrollment == null ? Prisma.JsonNull : (s.enrollment as unknown as Prisma.InputJsonValue),
    status: s.status,
    dataCancelamento: s.dataCancelamento ?? null,
    observacoesCancelamento: s.observacoesCancelamento ?? null,
  }
}

export function studentFromPrisma(s: {
  id: string
  codigo: string
  nome: string
  dataNascimento: string
  rg: string
  cpf: string
  filiacao: string
  endereco: string
  telefone: string
  email: string
  login: string
  senha: string
  responsavel: Prisma.JsonValue | null
  enrollment: Prisma.JsonValue | null
  status: string
  dataCancelamento: string | null
  observacoesCancelamento: string | null
}): Student {
  return {
    id: s.id,
    codigo: s.codigo,
    nome: s.nome,
    dataNascimento: s.dataNascimento,
    rg: s.rg,
    cpf: s.cpf,
    filiacao: s.filiacao,
    endereco: s.endereco,
    telefone: s.telefone,
    email: s.email,
    login: s.login,
    senha: s.senha,
    responsavel: s.responsavel ? (s.responsavel as unknown as Student['responsavel']) : undefined,
    enrollment: s.enrollment ? (s.enrollment as unknown as Student['enrollment']) : null,
    status: s.status === 'inativo' ? 'inativo' : 'ativo',
    dataCancelamento: s.dataCancelamento ?? undefined,
    observacoesCancelamento: s.observacoesCancelamento ?? undefined,
  }
}
