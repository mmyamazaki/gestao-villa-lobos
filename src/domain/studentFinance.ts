import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { lateFeesOnGross } from './finance'
import type { MensalidadeRegistrada } from './types'

export type StudentParcelStatus = 'pago' | 'aberto' | 'atrasado' | 'cancelado'

export type StudentParcelView = {
  m: MensalidadeRegistrada
  status: StudentParcelStatus
  /** Valor tabela (bruto) */
  valorBruto: number
  /** Valor do desconto contratual em R$ (0 se atrasado — desconto removido) */
  descontoReais: number
  /** Multa e juros (sobre bruto) quando atrasado */
  multa: number
  juros: number
  /** Total a pagar na situação atual */
  total: number
  diasAtraso: number
}

export function computeStudentParcelView(
  m: MensalidadeRegistrada,
  refDate: Date,
): StudentParcelView {
  if (m.status === 'cancelado') {
    return {
      m,
      status: 'cancelado',
      valorBruto: m.baseAmount,
      descontoReais: m.baseAmount - m.liquidAmount,
      multa: 0,
      juros: 0,
      total: 0,
      diasAtraso: 0,
    }
  }

  const today = startOfDay(refDate)
  const due = startOfDay(parseISO(m.dueDate))

  if (m.paidAt) {
    const pay = startOfDay(parseISO(m.paidAt))
    const due = startOfDay(parseISO(m.dueDate))
    const disc = m.baseAmount - m.liquidAmount
    if (m.waivesLateFees || pay <= due) {
      return {
        m,
        status: 'pago',
        valorBruto: m.baseAmount,
        descontoReais: disc,
        multa: 0,
        juros: 0,
        total: m.liquidAmount,
        diasAtraso: 0,
      }
    }
    const diasAtraso = Math.max(0, differenceInCalendarDays(pay, due))
    const auto = lateFeesOnGross(m.baseAmount, diasAtraso)
    const multa = m.manualFine != null ? m.manualFine : auto.fine
    const juros = m.manualInterest != null ? m.manualInterest : auto.interest
    const total = m.baseAmount + multa + juros
    return {
      m,
      status: 'pago',
      valorBruto: m.baseAmount,
      descontoReais: 0,
      multa,
      juros,
      total,
      diasAtraso,
    }
  }

  if (today <= due) {
    const disc = m.baseAmount - m.liquidAmount
    return {
      m,
      status: 'aberto',
      valorBruto: m.baseAmount,
      descontoReais: disc,
      multa: 0,
      juros: 0,
      total: m.liquidAmount,
      diasAtraso: 0,
    }
  }

  const diasAtraso = Math.max(0, differenceInCalendarDays(today, due))
  if (m.waivesLateFees || diasAtraso === 0) {
    return {
      m,
      status: 'atrasado',
      valorBruto: m.baseAmount,
      descontoReais: 0,
      multa: 0,
      juros: 0,
      total: m.baseAmount,
      diasAtraso,
    }
  }

  const { fine, interest, total } = lateFeesOnGross(m.baseAmount, diasAtraso)
  return {
    m,
    status: 'atrasado',
    valorBruto: m.baseAmount,
    descontoReais: 0,
    multa: fine,
    juros: interest,
    total,
    diasAtraso,
  }
}
