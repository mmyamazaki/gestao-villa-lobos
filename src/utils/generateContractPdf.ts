import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { applyDiscount, lateFeesOnGross } from '../domain/finance'
import { calcAgeYears } from '../domain/age'
import type { Course, Student, Teacher } from '../domain/types'
import {
  formatSixtyMinuteLessonLabel,
  formatSlotKeyLabel,
  sortSlotKeys,
} from '../domain/schedule'
import { isCpfComplete } from './brMasks'
import { drawPdfHeader, SCHOOL_DISPLAY_NAME } from './pdfHeader'
import {
  PDF_LINE_HEIGHT_MULT,
  PDF_MARGIN_X,
  contentWidthMm,
  drawSegmentParagraph,
  drawWrappedText,
} from './pdfText'

const RAZAO = 'Escola de Musica Villa Lobos Ltda'
const CNPJ = '07.513.759/0001-17'
const END_ESCOLA =
  'Rua Dom Pedro II, 1972 - Bairro: Nossa Senhora das Gracas, nesta capital'
const FORO = 'Porto Velho, capital do Estado de Rondonia'

function splitAddressRough(endereco: string): { logradouro: string; numero: string; bairro: string } {
  const parts = endereco
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return { logradouro: endereco || '_______', numero: '___', bairro: '_______' }
  }
  const bairro = parts[parts.length - 1]
  const logradouro = parts[0]
  let numero = 'S/N'
  for (let i = 1; i < parts.length - 1; i++) {
    const p = parts[i]
    if (/nº|Nº|^\d+/i.test(p) || /^\d+[A-Za-z]?$/.test(p)) {
      numero = p.replace(/nº\s*/gi, '').trim()
      break
    }
  }
  return { logradouro, numero, bairro }
}

function discountPorExtenso(p: 0 | 5 | 10): string {
  const map: Record<number, string> = { 0: 'zero', 5: 'cinco', 10: 'dez' }
  return map[p] ?? String(p)
}

function paraGap(doc: jsPDF) {
  return doc.getFontSize() * PDF_LINE_HEIGHT_MULT * (25.4 / 72) * 0.35
}

export async function generateEnrollmentContractPdf(
  student: Student,
  _teacher: Teacher,
  course: Course,
) {
  if (!student.enrollment) return

  const en = student.enrollment
  const age = calcAgeYears(student.dataNascimento)
  const minorH = age !== null && age < 18 && Boolean(student.responsavel)

  const partyName = minorH ? student.responsavel!.nome : student.nome
  const partyCpf = minorH
    ? student.responsavel!.cpf
    : isCpfComplete(student.cpf)
      ? student.cpf
      : '______________________'
  const partyAddr = minorH ? student.responsavel!.endereco : student.endereco
  const { logradouro, numero, bairro } = splitAddressRough(partyAddr)
  const studentMention = student.nome

  const base = course.monthlyPrice
  const afterDisc = applyDiscount(base, en.discountPercent)
  const demoLate = lateFeesOnGross(base, 5)
  const aulasSemana = en.lessonMode === '60x1' ? '1' : '2'
  const duracaoAula =
    en.lessonMode === '60x1' ? '1 (uma hora)' : 'meia hora cada (total 1 hora semanal)'

  const dataExtenso = format(
    new Date(en.matriculatedAt + 'T12:00:00'),
    "d 'de' MMMM 'de' yyyy",
    { locale: ptBR },
  )

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const maxW = contentWidthMm(doc)
  let y = await drawPdfHeader(doc, 12)
  y += 6

  y = drawWrappedText(
    doc,
    `Contrato de Prestação de Serviços Nº ${student.codigo}`,
    PDF_MARGIN_X,
    y,
    maxW,
    { font: 'bold', size: 12, lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)

  y = drawWrappedText(
    doc,
    'Pelo presente instrumento particular, entre as partes:',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)

  y = drawWrappedText(
    doc,
    `${RAZAO}, cadastrada no CNPJ nº ${CNPJ}, com sede nesta capital, sendo o endereço na ${END_ESCOLA}, e de outro lado`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)

  if (minorH && student.responsavel) {
    const r = student.responsavel
    y = drawWrappedText(
      doc,
      `Aluno ${student.nome}, representado por ${r.nome}, portador do CPF ${r.cpf}.`,
      PDF_MARGIN_X,
      y,
      maxW,
      { lineMult: PDF_LINE_HEIGHT_MULT },
    )
    y += paraGap(doc)
  }

  y = drawSegmentParagraph(
    doc,
    [
      { text: partyName, bold: true },
      { text: ', residente e domiciliado na Rua/Av. ', bold: false },
      { text: logradouro, bold: true },
      { text: ' Nº ', bold: false },
      { text: numero, bold: true },
      { text: ', bairro ', bold: false },
      { text: bairro, bold: true },
      { text: ', portador do CPF nº ', bold: false },
      { text: partyCpf, bold: true },
      { text: ', aluno ou responsável legal pelo menor/aluno(a) ', bold: false },
      { text: studentMention, bold: true },
      { text: ', tem justo e contratado o que segue:', bold: false },
    ],
    PDF_MARGIN_X,
    y,
    maxW,
    10,
    PDF_LINE_HEIGHT_MULT,
  )
  y += paraGap(doc) * 2

  y = drawWrappedText(
    doc,
    '1. A Villa Lobos oferece ao aluno:',
    PDF_MARGIN_X,
    y,
    maxW,
    { font: 'bold', lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)
  y = drawWrappedText(
    doc,
    `1.1 Curso livre de ${course.instrumentLabel} — nível ${course.levelLabel}, no valor mensal de R$ ${base.toFixed(2)}.`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    `1.2 ${aulasSemana} aula(s) prática(s) individual(is) por semana com ${duracaoAula} de duração.`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '1.3 Reposição de aulas que, por culpa exclusiva da escola ou do professor, deixar de ser ministrada.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '1.4 Manutenção dos padrões comportamentais socialmente adequados, estrutura física confortável e ambiente de estudo.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    `1.5 Desconto de ${en.discountPercent}% (${discountPorExtenso(en.discountPercent)} por cento), para pagamentos efetuados até o vencimento, que ocorrerá até o 1º dia útil de cada mês.`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)

  y = drawWrappedText(doc, '2. A Villa Lobos reserva-se ao direito de:', PDF_MARGIN_X, y, maxW, {
    font: 'bold',
    lineMult: PDF_LINE_HEIGHT_MULT,
  })
  y += paraGap(doc)
  y = drawWrappedText(
    doc,
    '2.1 Ter recessos e feriados de acordo com o calendário escolar entregue ao responsável legal, sem obrigação de reposição salvo decisão do professor. Recessos não isentam pagamento.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '2.2 Impedir a frequência de alunos em débito por mais de 60 (sessenta) dias.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '2.3 Rescindir o contrato com estudantes de comportamento prejudicial às aulas, colegas ou professores.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '2.4 Cobrar taxa de R$ 10,00 para provas em segunda chamada, salvo atestado médico ou de trabalho.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '2.5 Não repor aulas a faltosos sem justificativa, salvo atestado; reposição em comum acordo.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)

  y = drawWrappedText(
    doc,
    '3. O aluno/responsável fica ciente da necessidade de:',
    PDF_MARGIN_X,
    y,
    maxW,
    { font: 'bold', lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)
  y = drawWrappedText(
    doc,
    '3.1 Pagar a anuidade (12 meses) no valor da tabela do estágio, com vencimentos mensais.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '3.2 Pagar fielmente até o vencimento, nos moldes do regulamento.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '3.3 Pagar multa de 2% sobre mensalidades em atraso, acrescida de juros de 0,3% por dia de atraso.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '3.4 Frequentar com assiduidade, prestar exames e acompanhar boletim na secretaria.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    '3.5 Rescisão por escrito na secretaria, com multa de uma mensalidade; desistência sem cancelamento exige parcelas vencidas corrigidas.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc)

  y = drawWrappedText(doc, 'Plano de aula e horários', PDF_MARGIN_X, y, maxW, {
    font: 'bold',
    lineMult: PDF_LINE_HEIGHT_MULT,
  })
  y += paraGap(doc)
  if (en.lessonMode === '60x1' && en.slotKeys.length === 2) {
    y = drawWrappedText(
      doc,
      ` - ${formatSixtyMinuteLessonLabel(en.slotKeys)}`,
      PDF_MARGIN_X,
      y,
      maxW,
      { lineMult: PDF_LINE_HEIGHT_MULT },
    )
  } else {
    for (const k of sortSlotKeys(en.slotKeys)) {
      y = drawWrappedText(
        doc,
        ` - ${formatSlotKeyLabel(k)}`,
        PDF_MARGIN_X,
        y,
        maxW,
        { lineMult: PDF_LINE_HEIGHT_MULT },
      )
    }
  }
  y = drawWrappedText(
    doc,
    `Data da matrícula: ${en.matriculatedAt.split('-').reverse().join('/')}`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    `Mensalidade base: R$ ${base.toFixed(2)}; com desconto contratual ${en.discountPercent}%, valor líquido mensal (parcelas após a 1ª): R$ ${afterDisc.toFixed(2)}. Exemplo com 5 dias de atraso (multa e juros sobre o bruto): total aprox. R$ ${demoLate.total.toFixed(2)}.`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    `As partes elegem o Foro da Comarca de ${FORO} para dirimir pendências.`,
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y = drawWrappedText(
    doc,
    'E por estarem justos e acordados, firmam em duas vias, na presença de testemunhas.',
    PDF_MARGIN_X,
    y,
    maxW,
    { lineMult: PDF_LINE_HEIGHT_MULT },
  )
  y += paraGap(doc) * 2

  y = drawSegmentParagraph(
    doc,
    [{ text: 'Porto Velho-RO, ', bold: false }, { text: dataExtenso, bold: true }],
    PDF_MARGIN_X,
    y,
    maxW,
    10,
    PDF_LINE_HEIGHT_MULT,
  )
  y += paraGap(doc) * 3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('_______________________________', PDF_MARGIN_X, y)
  doc.text('_______________________________', 120, y)
  y += 8
  doc.setFontSize(9)
  doc.text('Aluno / Responsável', PDF_MARGIN_X, y)
  doc.text(SCHOOL_DISPLAY_NAME, 120, y)

  doc.save(`contrato-prestacao-servicos-${student.codigo.replace('.', '-')}.pdf`)
}
