/**
 * Tokens visuais alinhados à grade semanal (`ScheduleGrid`): livre, ocupado, reposição.
 * Use nos portais e listas para manter a mesma identidade de cor.
 */
export const scheduleUi = {
  /** Cartão / bloco de horário de aula regular (ocupado na grade) */
  cardOcupado:
    'rounded-lg border border-indigo-500/40 bg-indigo-100 px-4 py-3 text-sm shadow-sm ring-1 ring-indigo-400/80',
  /** Linha de tabela — aula regular */
  rowOcupado: 'border-l-4 border-indigo-500 bg-indigo-50/95',
  /** Linha de tabela — reposição */
  rowReposicao: 'border-l-4 border-violet-500 bg-violet-100/90',
  /** Destaque do texto de horário (chip) */
  chipHorario: 'inline-block rounded-md bg-indigo-200 px-2 py-0.5 font-bold text-black',
  /** Nome de aluno em destaque (como na grade) */
  nomeAluno: 'font-bold text-black',
  badgeReposicao:
    'rounded bg-violet-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
} as const
