export type InstrumentKey =
  | 'violao'
  | 'guitarra'
  | 'baixo'
  | 'bateria'
  | 'sax'
  | 'violino'
  | 'piano'

export interface Course {
  id: string
  /** Identificador do instrumento (presets ou `custom-*` para cursos adicionados pelo usuário) */
  instrument: string
  instrumentLabel: string
  /** Nível / ano (texto livre), ex.: "Pré", "1º ano", "4º/5º ano". */
  levelLabel: string
  monthlyPrice: number
}

export type LessonMode = '60x1' | '30x2'

export type SlotStatus = 'free' | 'unavailable'

export type SlotState =
  | { status: 'free' }
  | { status: 'unavailable' }
  | {
      status: 'busy'
      studentId: string
      studentName: string
      /** Instrumento do curso matriculado (exibição na grade) */
      instrumentLabel?: string
    }

export type ScheduleMap = Record<string, SlotState>

export interface Teacher {
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
  /** Credenciais do portal do professor */
  login: string
  senha: string
  /** Slugs de instrumento (`course.instrument`) que o professor leciona */
  instrumentSlugs: string[]
  schedule: ScheduleMap
}

export interface Responsible {
  nome: string
  parentesco: string
  profissao: string
  rg: string
  cpf: string
  contato: string
  endereco: string
}

export interface Enrollment {
  courseId: string
  teacherId: string
  lessonMode: LessonMode
  slotKeys: string[]
  discountPercent: 0 | 5 | 10
  matriculatedAt: string
}

export type StudentStatus = 'ativo' | 'inativo'

/** Situação da parcela no financeiro. */
export type MensalidadeStatus = 'pendente' | 'pago' | 'cancelado'

export interface Student {
  id: string
  codigo: string
  nome: string
  dataNascimento: string
  rg: string
  cpf: string
  filiacao: string
  /** Endereço completo (obrigatório para todos os alunos) */
  endereco: string
  telefone: string
  email: string
  /** Credenciais do portal do aluno */
  login: string
  senha: string
  responsavel?: Responsible
  enrollment: Enrollment | null
  /** Situação cadastral (cancelamento = inativo + datas abaixo). */
  status: StudentStatus
  /** YYYY-MM-DD — início da liberação de grade / corte de parcelas futuras. */
  dataCancelamento?: string
  observacoesCancelamento?: string
}

export interface SchoolSettings {
  observacoesInternas: string
}

/** Parcela da anuidade (12 mensalidades ao matricular) */
export interface MensalidadeRegistrada {
  id: string
  studentId: string
  studentNome: string
  courseId: string
  courseLabel: string
  /** 1 a 12 */
  parcelNumber: number
  /** Mês de referência YYYY-MM */
  referenceMonth: string
  /** YYYY-MM-DD — 1ª parcela: data da matrícula; demais: dia 01 */
  dueDate: string
  baseAmount: number
  discountPercent: 0 | 5 | 10
  liquidAmount: number
  generatedAt: string
  /** 1ª parcela: sem multa/juros no sistema */
  waivesLateFees: boolean
  /** Data em que o pagamento foi registrado (YYYY-MM-DD) */
  paidAt?: string
  status: MensalidadeStatus
}

/** Registro de presença e conteúdo por aula (professor ↔ aluno). */
export interface ClassSessionLog {
  id: string
  teacherId: string
  studentId: string
  /** YYYY-MM-DD */
  lessonDate: string
  slotKey: string
  present: boolean
  content: string
  updatedAt: string
}

export type ReplacementClassStatus = 'agendada' | 'realizada' | 'faltou'

/** Aula de reposição (não recorrente e sem cobrança). */
export interface ReplacementClass {
  id: string
  studentId: string
  studentNome: string
  teacherId: string
  teacherNome: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm (rótulo da grade de 30 min, ex.: 08:00, 08:30) */
  startTime: string
  duration: 30 | 60
  status: ReplacementClassStatus
  content: string
  present?: boolean
}

export interface SchoolState {
  courses: Course[]
  teachers: Teacher[]
  students: Student[]
  mensalidades: MensalidadeRegistrada[]
  lessonLogs: ClassSessionLog[]
  replacementClasses: ReplacementClass[]
  settings: SchoolSettings
}
