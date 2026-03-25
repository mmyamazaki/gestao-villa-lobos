import { jsPDF } from 'jspdf'
import { applyDiscount, lateFees } from '../domain/finance'
import { calcAgeYears } from '../domain/age'
import type { Course, Student, Teacher } from '../domain/types'
import { formatSlotKeyLabel } from '../domain/schedule'

const SCHOOL = 'Escola de Musica Villa-Lobos'
const CITY = 'Porto Velho - RO'

export function generateEnrollmentContractPdf(
  student: Student,
  teacher: Teacher,
  course: Course,
) {
  if (!student.enrollment) return

  const en = student.enrollment
  const base = course.monthlyPrice
  const afterDisc = applyDiscount(base, en.discountPercent)
  const demoLate = lateFees(afterDisc, 5)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 18
  const line = (t: string, gap = 6) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(t, 18, y, { maxWidth: 175 })
    y += gap
    if (y > 270) {
      doc.addPage()
      y = 18
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('CONTRATO DE MATRICULA - AULA PARTICULAR DE MUSICA', 18, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  line(`${SCHOOL}, ${CITY}.`)
  line(
    `Pelos dados a seguir, o aluno abaixo matricula-se no curso de ${course.instrumentLabel}, ` +
      `${en.lessonMode === '60x1' ? '1x 60min semanal' : '2x 30min semanais'}, ` +
      `com o professor ${teacher.nome}.`,
    7,
  )

  doc.setFont('helvetica', 'bold')
  line('Dados do aluno', 8)
  doc.setFont('helvetica', 'normal')
  line(`Nome: ${student.nome}`)
  line(`Codigo: ${student.codigo}`)
  line(`Data de nascimento: ${student.dataNascimento || '---'}`)
  line(`RG: ${student.rg || '---'}   CPF: ${student.cpf || '---'}`)
  line(`Filiacao: ${student.filiacao || '---'}`)

  const age = calcAgeYears(student.dataNascimento)
  if (age !== null && age < 18 && student.responsavel) {
    doc.setFont('helvetica', 'bold')
    line('Dados do responsavel', 8)
    doc.setFont('helvetica', 'normal')
    const r = student.responsavel
    line(`Nome: ${r.nome}`)
    line(`Parentesco: ${r.parentesco}   Profissao: ${r.profissao}`)
    line(`RG: ${r.rg}   CPF: ${r.cpf}`)
    line(`Contato: ${r.contato}`)
    line(`Endereco: ${r.endereco}`)
  }

  doc.setFont('helvetica', 'bold')
  line('Plano de aula e horarios', 8)
  doc.setFont('helvetica', 'normal')
  en.slotKeys
    .slice()
    .sort()
    .forEach((k) => line(` - ${formatSlotKeyLabel(k)}`))

  line(`Data da matricula: ${en.matriculatedAt}`, 7)

  doc.setFont('helvetica', 'bold')
  line('Valores e condicoes', 8)
  doc.setFont('helvetica', 'normal')
  line(`Mensalidade base do estagio (tabela): R$ ${base.toFixed(2)}`)
  line(
    `Desconto contratual: ${en.discountPercent}% ` +
      `(valor liquido mensal: R$ ${afterDisc.toFixed(2)})`,
  )
  line(
    'Vencimento: dia 01 de cada mes. Apos o vencimento: multa de 2% + juros de ' +
      '0,3% ao dia sobre o valor em atraso (exemplo com 5 dias: ' +
      `total aprox. R$ ${demoLate.total.toFixed(2)}).`,
    7,
  )

  line(
    'As partes elegem o foro da comarca de Porto Velho/RO para dirimir pendencias.',
    7,
  )

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('_______________________________', 18, y)
  doc.text('_______________________________', 120, y)
  y += 6
  doc.setFontSize(9)
  doc.text('Assinatura do responsavel / aluno', 18, y)
  doc.text('Assinatura da escola', 120, y)

  doc.save(`contrato-matricula-${student.codigo.replace('.', '-')}.pdf`)
}
