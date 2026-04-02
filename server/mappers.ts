import { Prisma } from '@prisma/client'
import {
  filiacaoLegacyString,
  normalizeStudentParentsFromDb,
} from '../src/domain/studentParents.js'
import type { Course, MensalidadeRegistrada, Student, Teacher } from '../src/domain/types.js'
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
  const slugs = Array.isArray(t.instrumentSlugs) ? t.instrumentSlugs : []
  const schedule =
    t.schedule != null && typeof t.schedule === 'object' && !Array.isArray(t.schedule)
      ? t.schedule
      : {}
  return {
    id: t.id,
    nome: typeof t.nome === 'string' ? t.nome : '',
    dataNascimento: typeof t.dataNascimento === 'string' ? t.dataNascimento : '',
    naturalidade: typeof t.naturalidade === 'string' ? t.naturalidade : '',
    filiacao: typeof t.filiacao === 'string' ? t.filiacao : '',
    rg: typeof t.rg === 'string' ? t.rg : '',
    cpf: typeof t.cpf === 'string' ? t.cpf : '',
    endereco: typeof t.endereco === 'string' ? t.endereco : '',
    contatos: typeof t.contatos === 'string' ? t.contatos : '',
    email: typeof t.email === 'string' ? t.email : '',
    celular: typeof t.celular === 'string' ? t.celular : '',
    login: typeof t.login === 'string' ? t.login : '',
    senha: typeof t.senha === 'string' ? t.senha : '',
    instrumentSlugs: [...slugs],
    schedule: schedule as Prisma.InputJsonValue,
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
  const nomePai = s.nomePai ?? ''
  const nomeMae = s.nomeMae ?? ''
  return {
    id: s.id,
    codigo: s.codigo,
    nome: s.nome,
    dataNascimento: s.dataNascimento,
    rg: s.rg,
    cpf: s.cpf,
    nomePai,
    nomeMae,
    filiacao: filiacaoLegacyString(nomePai, nomeMae),
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
  nomePai?: string | null
  nomeMae?: string | null
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
  const parents = normalizeStudentParentsFromDb(s.nomePai, s.nomeMae, s.filiacao)
  return {
    id: s.id,
    codigo: s.codigo,
    nome: s.nome,
    dataNascimento: s.dataNascimento,
    rg: s.rg,
    cpf: s.cpf,
    nomePai: parents.nomePai,
    nomeMae: parents.nomeMae,
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

export function mensalidadeToPrismaUnchecked(
  m: MensalidadeRegistrada,
): Prisma.MensalidadeUncheckedCreateInput {
  const disc = typeof m.discountPercent === 'number' ? m.discountPercent : 0
  return {
    id: m.id,
    studentId: m.studentId,
    studentNome: m.studentNome ?? '',
    courseId: m.courseId,
    courseLabel: m.courseLabel ?? '',
    parcelNumber: m.parcelNumber,
    referenceMonth: m.referenceMonth ?? '',
    dueDate: m.dueDate ?? '',
    baseAmount: new Prisma.Decimal(Number(m.baseAmount) || 0),
    discountPercent: disc,
    liquidAmount: new Prisma.Decimal(Number(m.liquidAmount) || 0),
    generatedAt: typeof m.generatedAt === 'string' ? m.generatedAt : '',
    waivesLateFees: Boolean(m.waivesLateFees),
    paidAt: m.paidAt?.slice(0, 10) ?? null,
    status: m.status === 'cancelado' ? 'cancelado' : m.status === 'pago' ? 'pago' : 'pendente',
    manualFine:
      m.manualFine != null && !Number.isNaN(Number(m.manualFine))
        ? new Prisma.Decimal(Number(m.manualFine))
        : null,
    manualInterest:
      m.manualInterest != null && !Number.isNaN(Number(m.manualInterest))
        ? new Prisma.Decimal(Number(m.manualInterest))
        : null,
    adjustmentNotes: m.adjustmentNotes?.trim() || null,
  }
}

export function mensalidadeFromPrisma(row: {
  id: string
  studentId: string
  studentNome: string
  courseId: string
  courseLabel: string
  parcelNumber: number
  referenceMonth: string
  dueDate: string
  baseAmount: unknown
  discountPercent: number
  liquidAmount: unknown
  generatedAt: string
  waivesLateFees: boolean
  paidAt: string | null
  status: string
  manualFine: unknown
  manualInterest: unknown
  adjustmentNotes: string | null
}): MensalidadeRegistrada {
  const dp = row.discountPercent === 5 || row.discountPercent === 10 ? row.discountPercent : 0
  const st = row.status === 'cancelado' ? 'cancelado' : row.status === 'pago' ? 'pago' : 'pendente'
  const paid =
    typeof row.paidAt === 'string' && row.paidAt.length >= 8 ? row.paidAt.slice(0, 10) : undefined
  const mf = row.manualFine == null ? undefined : Number(row.manualFine)
  const mi = row.manualInterest == null ? undefined : Number(row.manualInterest)
  return {
    id: row.id,
    studentId: row.studentId,
    studentNome: row.studentNome,
    courseId: row.courseId,
    courseLabel: row.courseLabel,
    parcelNumber: row.parcelNumber,
    referenceMonth: row.referenceMonth,
    dueDate: row.dueDate,
    baseAmount: Number(row.baseAmount),
    discountPercent: dp as 0 | 5 | 10,
    liquidAmount: Number(row.liquidAmount),
    generatedAt: row.generatedAt,
    waivesLateFees: row.waivesLateFees,
    paidAt: paid,
    status: st,
    manualFine: mf != null && !Number.isNaN(mf) ? mf : undefined,
    manualInterest: mi != null && !Number.isNaN(mi) ? mi : undefined,
    adjustmentNotes: row.adjustmentNotes?.trim() || undefined,
  }
}
