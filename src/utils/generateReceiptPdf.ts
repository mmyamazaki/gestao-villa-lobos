import { jsPDF } from 'jspdf'
import { daysLateAfterDueDate, lateFeesOnGross } from '../domain/finance'
import type { MensalidadeRegistrada } from '../domain/types'
import { drawPdfHeader } from './pdfHeader'
import { PDF_LINE_HEIGHT_MULT, PDF_MARGIN_X, contentWidthMm, drawWrappedText } from './pdfText'

export type ReceiptKind = 'launch' | 'payment'

function money(n: number) {
  return `R$ ${n.toFixed(2)}`
}

const PT_TO_MM = 25.4 / 72

function lineStepMm(fontSize: number): number {
  return fontSize * PDF_LINE_HEIGHT_MULT * PT_TO_MM
}

export async function generateMensalidadeReceiptPdf(
  m: MensalidadeRegistrada,
  opts: { kind: ReceiptKind; paymentDate?: string },
) {
  if (m.status === 'cancelado') {
    window.alert('Esta parcela está cancelada; não é possível gerar recibo.')
    return
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = await drawPdfHeader(doc, 12)
  y += 8

  const margin = PDF_MARGIN_X
  const pageW = doc.internal.pageSize.getWidth()
  const boxW = pageW - 2 * margin
  const maxW = contentWidthMm(doc)

  const title =
    opts.kind === 'launch'
      ? 'DEMONSTRATIVO — LANÇAMENTO DE MENSALIDADE'
      : 'RECIBO DE PAGAMENTO'

  y = drawWrappedText(doc, title, margin, y, maxW, {
    font: 'bold',
    size: 12,
    lineMult: PDF_LINE_HEIGHT_MULT,
  })
  y += lineStepMm(10) * 0.4

  const vencimento = m.dueDate.split('-').reverse().join('/')
  const payDay =
    opts.kind === 'payment' && opts.paymentDate
      ? opts.paymentDate.split('-').reverse().join('/')
      : '—'

  const pay =
    opts.kind === 'payment' && opts.paymentDate
      ? new Date(opts.paymentDate + 'T12:00:00')
      : null
  const due = new Date(m.dueDate + 'T12:00:00')

  let diasAtraso = 0
  let multa = 0
  let juros = 0
  let total = m.liquidAmount
  let descontoReais = m.baseAmount - m.liquidAmount

  if (opts.kind === 'payment' && pay) {
    if (m.waivesLateFees) {
      diasAtraso = 0
      multa = 0
      juros = 0
      total = m.liquidAmount
      descontoReais = m.baseAmount - m.liquidAmount
    } else {
      diasAtraso = daysLateAfterDueDate(pay, due)
      if (diasAtraso <= 0) {
        multa = m.manualFine != null ? m.manualFine : 0
        juros = m.manualInterest != null ? m.manualInterest : 0
        descontoReais = m.baseAmount - m.liquidAmount
        total = Math.round((m.liquidAmount + multa + juros) * 100) / 100
      } else {
        descontoReais = 0
        const auto = lateFeesOnGross(m.baseAmount, diasAtraso)
        multa = m.manualFine != null ? m.manualFine : auto.fine
        juros = m.manualInterest != null ? m.manualInterest : auto.interest
        total = m.baseAmount + multa + juros
      }
    }
  } else {
    multa = 0
    juros = 0
    total = m.liquidAmount
    descontoReais = m.baseAmount - m.liquidAmount
  }

  const bottomSafe = () => doc.internal.pageSize.getHeight() - margin

  const drawBox = (
    boxTitle: string,
    rows: { label: string; value: string; valueBold?: boolean }[],
  ) => {
    if (y > bottomSafe() - 35) {
      doc.addPage()
      y = margin
    }
    const top = y
    let iy = y + 6
    doc.setDrawColor(150)
    doc.setLineWidth(0.28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setLineHeightFactor(PDF_LINE_HEIGHT_MULT)
    doc.text(boxTitle, margin + 3, iy)
    const lh = lineStepMm(9.5)
    iy += lh * 1.2

    for (const row of rows) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setLineHeightFactor(PDF_LINE_HEIGHT_MULT)
      const labelMax = boxW * 0.55
      const valueMax = boxW * 0.38
      const labelLines = doc.splitTextToSize(row.label, labelMax)
      const vb = row.valueBold !== false
      doc.setFont('helvetica', vb ? 'bold' : 'normal')
      const valueLines = doc.splitTextToSize(row.value, valueMax)
      doc.setFont('helvetica', 'normal')
      const lines = Math.max(labelLines.length, valueLines.length)
      for (let i = 0; i < lines; i++) {
        const lab = labelLines[i] as string | undefined
        if (lab) {
          doc.setFont('helvetica', 'normal')
          doc.text(lab, margin + 3, iy)
        }
        const val = valueLines[i] as string | undefined
        if (val) {
          doc.setFont('helvetica', vb ? 'bold' : 'normal')
          doc.text(val, margin + boxW - 3, iy, { align: 'right' })
        }
        iy += lh * 1.02
      }
      iy += lh * 0.2
    }
    const boxH = iy - top + 4
    doc.rect(margin, top, boxW, boxH)
    y = top + boxH + 6
  }

  drawBox('Identificação', [
    { label: 'Aluno', value: m.studentNome },
    { label: 'Curso', value: m.courseLabel },
    {
      label: 'Parcela',
      value: `${m.parcelNumber} de 12 (ref. ${m.referenceMonth})`,
    },
  ])

  drawBox('Datas', [
    { label: 'Vencimento', value: vencimento, valueBold: true },
    ...(opts.kind === 'payment'
      ? ([{ label: 'Pagamento', value: payDay, valueBold: true }] as const)
      : []),
  ])

  drawBox('Valores', [
    { label: 'Valor bruto (tabela)', value: money(m.baseAmount), valueBold: true },
    {
      label: `Desconto contratual (${m.discountPercent}%)`,
      value: money(descontoReais),
    },
    {
      label: 'Base após desconto (em prazo)',
      value: money(m.liquidAmount),
    },
    { label: 'Dias de atraso', value: String(diasAtraso) },
    {
      label:
        m.manualFine != null
          ? 'Multa (valor aplicado na baixa)'
          : 'Multa (2% sobre o bruto em atraso)',
      value: money(multa),
    },
    {
      label:
        m.manualInterest != null
          ? 'Juros (valor aplicado na baixa)'
          : 'Juros (0,3% ao dia sobre o bruto em atraso)',
      value: money(juros),
    },
    {
      label: opts.kind === 'payment' ? 'Total pago' : 'Total',
      value: money(total),
      valueBold: true,
    },
  ])

  if (opts.kind === 'payment' && m.adjustmentNotes?.trim()) {
    y += 2
    y = drawWrappedText(
      doc,
      `Observações (ajuste manual): ${m.adjustmentNotes.trim()}`,
      margin,
      y,
      maxW,
      { font: 'normal', size: 9, lineMult: PDF_LINE_HEIGHT_MULT },
    )
    y += lineStepMm(9) * 0.3
  }

  const suf = opts.kind === 'launch' ? 'lancamento' : 'pagamento'
  doc.save(`recibo-mensalidade-${m.parcelNumber}-mes${m.referenceMonth}-${suf}.pdf`)
}
