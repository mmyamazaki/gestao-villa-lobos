import { applyDiscount } from './finance'
import type { Course, Enrollment, MensalidadeRegistrada, Student } from './types'

function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

/** Adiciona n meses a YYYY-MM (calendário local). */
export function addCalendarMonthsYm(ym: string, delta: number): string {
  const [yS, mS] = ym.split('-')
  const y = Number(yS)
  const m = Number(mS)
  if (!y || !m) return ym
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/**
 * Anuidade (12 parcelas): 1ª integral, sem desconto, vencimento na data da matrícula, sem multa/juros no sistema.
 * Demais com desconto da matrícula, vencimento dia 01 de cada mês de referência.
 */
export function buildTwelveMensalidades(
  student: Student,
  course: Course,
  enrollment: Enrollment,
  generatedAt: string,
): MensalidadeRegistrada[] {
  const mat = enrollment.matriculatedAt
  const startYm = mat.slice(0, 7)
  const base = course.monthlyPrice
  const contractDisc = enrollment.discountPercent
  const rows: MensalidadeRegistrada[] = []

  for (let p = 1; p <= 12; p++) {
    const referenceMonth = addCalendarMonthsYm(startYm, p - 1)
    if (p === 1) {
      rows.push({
        id: `mens-${student.id}-p${p}-${course.id}-${referenceMonth}`,
        studentId: student.id,
        studentNome: student.nome,
        courseId: course.id,
        courseLabel: `${course.instrumentLabel} · ${course.levelLabel}`,
        parcelNumber: p,
        referenceMonth,
        dueDate: mat,
        baseAmount: base,
        discountPercent: 0,
        liquidAmount: base,
        waivesLateFees: true,
        generatedAt,
        status: 'pendente',
      })
    } else {
      const liquid = applyDiscount(base, contractDisc)
      rows.push({
        id: `mens-${student.id}-p${p}-${course.id}-${referenceMonth}`,
        studentId: student.id,
        studentNome: student.nome,
        courseId: course.id,
        courseLabel: `${course.instrumentLabel} · ${course.levelLabel}`,
        parcelNumber: p,
        referenceMonth,
        dueDate: `${referenceMonth}-01`,
        baseAmount: base,
        discountPercent: contractDisc,
        liquidAmount: liquid,
        waivesLateFees: false,
        generatedAt,
        status: 'pendente',
      })
    }
  }
  return rows
}
