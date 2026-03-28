import type { Course, InstrumentKey } from './types'

const INSTRUMENT_LABEL: Record<InstrumentKey, string> = {
  violao: 'Violão',
  guitarra: 'Guitarra',
  baixo: 'Baixo',
  bateria: 'Bateria',
  sax: 'Sax',
  violino: 'Violino',
  piano: 'Piano',
}

/** Valores dentro das faixas: demais instrumentos R$380–420; Piano R$400–460 */
const PRICE_MATRIX: Record<InstrumentKey, [number, number, number]> = {
  violao: [380, 400, 420],
  guitarra: [380, 400, 420],
  baixo: [380, 400, 420],
  bateria: [380, 400, 420],
  sax: [380, 400, 420],
  violino: [380, 400, 420],
  piano: [400, 430, 460],
}

/** Níveis padrão por instrumento (piano com nomenclatura da escola). */
const LEVEL_MATRIX: Record<InstrumentKey, [string, string, string]> = {
  violao: ['1º estágio', '2º estágio', '3º estágio'],
  guitarra: ['1º estágio', '2º estágio', '3º estágio'],
  baixo: ['1º estágio', '2º estágio', '3º estágio'],
  bateria: ['1º estágio', '2º estágio', '3º estágio'],
  sax: ['1º estágio', '2º estágio', '3º estágio'],
  violino: ['1º estágio', '2º estágio', '3º estágio'],
  piano: ['Pré', '1º ano', '2º/3º ano'],
}

/** Ordem de exibição dos instrumentos padrão (custom aparece depois) */
export const PRESET_INSTRUMENT_ORDER: InstrumentKey[] = [
  'violao',
  'guitarra',
  'baixo',
  'bateria',
  'sax',
  'violino',
  'piano',
]

export function buildDefaultCourses(): Course[] {
  const courses: Course[] = []
  for (const inst of PRESET_INSTRUMENT_ORDER) {
    const [p1, p2, p3] = PRICE_MATRIX[inst]
    const [l1, l2, l3] = LEVEL_MATRIX[inst]
    courses.push(
      {
        id: `${inst}-1`,
        instrument: inst,
        instrumentLabel: INSTRUMENT_LABEL[inst],
        levelLabel: l1,
        monthlyPrice: p1,
      },
      {
        id: `${inst}-2`,
        instrument: inst,
        instrumentLabel: INSTRUMENT_LABEL[inst],
        levelLabel: l2,
        monthlyPrice: p2,
      },
      {
        id: `${inst}-3`,
        instrument: inst,
        instrumentLabel: INSTRUMENT_LABEL[inst],
        levelLabel: l3,
        monthlyPrice: p3,
      },
    )
  }
  return courses
}
