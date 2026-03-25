export type CourseStage = 1 | 2 | 3

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
  stage: CourseStage
  monthlyPrice: number
}

export type LessonMode = '60x1' | '30x2'

export type SlotStatus = 'free' | 'unavailable'

export type SlotState =
  | { status: 'free' }
  | { status: 'unavailable' }
  | { status: 'busy'; studentId: string; studentName: string }

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

export interface Student {
  id: string
  codigo: string
  nome: string
  dataNascimento: string
  rg: string
  cpf: string
  filiacao: string
  responsavel?: Responsible
  enrollment: Enrollment | null
}

export interface SchoolSettings {
  observacoesInternas: string
}

/** Primeira mensalidade gerada ao salvar matrícula (integração com Financeiro) */
export interface MensalidadeRegistrada {
  id: string
  studentId: string
  studentNome: string
  courseId: string
  courseLabel: string
  /** Mês de referência YYYY-MM (vencimento dia 01) */
  referenceMonth: string
  baseAmount: number
  discountPercent: 0 | 5 | 10
  liquidAmount: number
  generatedAt: string
}

export interface SchoolState {
  courses: Course[]
  teachers: Teacher[]
  students: Student[]
  mensalidades: MensalidadeRegistrada[]
  settings: SchoolSettings
}
