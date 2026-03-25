/** Mensalidade vence dia 01. Multa 2% + juros 0,3% ao dia sobre o valor em atraso (após o vencimento). */
export function applyDiscount(baseMonthly: number, discountPercent: 0 | 5 | 10) {
  return baseMonthly * (1 - discountPercent / 100)
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
  if (pay <= due) return 0
  const ms = pay.getTime() - due.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}
