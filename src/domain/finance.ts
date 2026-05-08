/** Mensalidade vence dia 01. Multa 2% + juros 0,3% ao dia sobre o valor em atraso (após o vencimento). */
export function applyDiscount(baseMonthly: number, discountPercent: 0 | 5 | 10) {
  return baseMonthly * (1 - discountPercent / 100)
}

function atMidday(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Ajusta vencimento para o próximo dia útil quando cair em fim de semana.
 * Regras atuais:
 * - sábado -> segunda
 * - domingo -> segunda
 */
export function effectiveDueDateForLateFees(dueDate: Date) {
  const due = atMidday(dueDate)
  const dow = due.getDay()
  if (dow === 6) {
    const shifted = new Date(due)
    shifted.setDate(shifted.getDate() + 2)
    return shifted
  }
  if (dow === 0) {
    const shifted = new Date(due)
    shifted.setDate(shifted.getDate() + 1)
    return shifted
  }
  return due
}

export function lateFees(
  amountAfterDiscount: number,
  /** Dias corridos após o dia 01 (dia 02 = 1 dia de atraso) */
  daysLate: number,
) {
  if (daysLate <= 0) {
    return { fine: 0, interest: 0, total: amountAfterDiscount }
  }
  const fine = amountAfterDiscount * 0.02
  const interest = amountAfterDiscount * 0.003 * daysLate
  const total = amountAfterDiscount + fine + interest
  return { fine, interest, total }
}

export function daysLateFromPaymentDate(paymentDate: Date, referenceMonth: Date) {
  const due = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1)
  const pay = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate())
  const effectiveDue = effectiveDueDateForLateFees(due)
  if (pay <= effectiveDue) return 0
  const ms = pay.getTime() - effectiveDue.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/** Dias corridos após o vencimento (dia seguinte ao vencimento = 1). */
export function daysLateAfterDueDate(paymentDate: Date, dueDate: Date) {
  const pay = atMidday(paymentDate)
  const due = effectiveDueDateForLateFees(dueDate)
  if (pay <= due) return 0
  const ms = pay.getTime() - due.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/** Multa 2% + juros 0,3% ao dia sobre o valor bruto (regra painel do aluno em atraso). */
export function lateFeesOnGross(gross: number, daysLate: number) {
  if (daysLate <= 0) {
    return { fine: 0, interest: 0, total: gross }
  }
  const fine = gross * 0.02
  const interest = gross * 0.003 * daysLate
  return { fine, interest, total: gross + fine + interest }
}

