import { applyDiscount, daysLateAfterDueDate, lateFeesOnGross } from './finance'
import type { MensalidadeRegistrada } from './types'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * Parcela em aberto: valores conforme a **data de pagamento** escolhida no painel.
 * Até ao vencimento (inclusive): aplica desconto contratual (`applyDiscount`).
 * Após o vencimento: sem desconto; multa e juros sobre o bruto.
 * 1ª parcela (`waivesLateFees`): sempre bruto integral, sem desconto contratual no modelo.
 */
export function projectUnpaidMensalidade(
  m: MensalidadeRegistrada,
  paymentDateIso: string,
): {
  late: number
  contractualDiscountReais: number
  displayLiquid: number
  fees: { fine: number; interest: number; total: number }
} {
  if (m.status === 'cancelado') {
    return {
      late: 0,
      contractualDiscountReais: round2(Math.max(0, m.baseAmount - m.liquidAmount)),
      displayLiquid: m.liquidAmount,
      fees: { fine: 0, interest: 0, total: 0 },
    }
  }

  const due = new Date(m.dueDate + 'T12:00:00')
  const pay = new Date(paymentDateIso.slice(0, 10) + 'T12:00:00')

  if (m.waivesLateFees) {
    const b = round2(m.baseAmount)
    return {
      late: 0,
      contractualDiscountReais: 0,
      displayLiquid: b,
      fees: { fine: 0, interest: 0, total: b },
    }
  }

  const late = daysLateAfterDueDate(pay, due)
  if (late <= 0) {
    const displayLiquid = round2(applyDiscount(m.baseAmount, m.discountPercent))
    const contractualDiscountReais = round2(m.baseAmount - displayLiquid)
    return {
      late: 0,
      contractualDiscountReais,
      displayLiquid,
      fees: { fine: 0, interest: 0, total: displayLiquid },
    }
  }

  const auto = lateFeesOnGross(m.baseAmount, late)
  const fine = m.manualFine != null ? round2(m.manualFine) : round2(auto.fine)
  const interest = m.manualInterest != null ? round2(m.manualInterest) : round2(auto.interest)
  return {
    late,
    contractualDiscountReais: 0,
    displayLiquid: round2(m.baseAmount),
    fees: {
      fine,
      interest,
      total: round2(m.baseAmount + fine + interest),
    },
  }
}
