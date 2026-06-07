import { jsPDF } from 'jspdf'

import { drawPdfHeader } from './pdfHeader'

export interface ReportPdfColumn<T> {
  label: string
  /** Largura da coluna em mm. */
  w: number
  align?: 'left' | 'center' | 'right'
  get: (row: T) => string
}

export interface ReportTablePdfOptions<T> {
  title: string
  /** Linhas curtas exibidas abaixo do título (filtros, totais, etc.). */
  subtitleLines?: string[]
  columns: ReportPdfColumn<T>[]
  rows: T[]
  fileName: string
  orientation?: 'portrait' | 'landscape'
  emptyText?: string
}

/**
 * Gera e salva um PDF de tabela com o cabeçalho padrão da escola. Reutilizável pelos relatórios
 * (financeiro, por instrumento, etc.). Texto que excede a largura da coluna é truncado com reticências.
 */
export async function exportReportTablePdf<T>(opts: ReportTablePdfOptions<T>): Promise<void> {
  const orientation = opts.orientation ?? 'landscape'
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  let y = await drawPdfHeader(doc, 10)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(opts.title, pageW / 2, y + 1, { align: 'center' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  for (const line of opts.subtitleLines ?? []) {
    doc.text(line, 14, y)
    y += 4.5
  }
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, y)
  y += 4

  const x = 10
  const tableW = opts.columns.reduce((s, c) => s + c.w, 0)
  const rowH = 7

  const fit = (text: string, wMm: number) => {
    const maxW = wMm - 3
    if (doc.getTextWidth(text) <= maxW) return text
    let t = text
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1)
    return `${t}…`
  }

  const textX = (cx: number, c: ReportPdfColumn<T>) =>
    c.align === 'right' ? cx + c.w - 1.5 : c.align === 'center' ? cx + c.w / 2 : cx + 1.5

  const drawHeader = () => {
    doc.setFillColor(236, 242, 255)
    doc.rect(x, y, tableW, rowH, 'F')
    doc.setDrawColor(170, 184, 214)
    doc.rect(x, y, tableW, rowH)
    let cx = x
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    for (const c of opts.columns) {
      doc.text(c.label, textX(cx, c), y + 4.6, { align: c.align ?? 'left' })
      cx += c.w
    }
    y += rowH
  }

  drawHeader()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  if (opts.rows.length === 0) {
    doc.text(opts.emptyText ?? 'Nenhum registro para os filtros selecionados.', x + 1.5, y + 4.6)
  }

  for (const r of opts.rows) {
    if (y > pageH - 12) {
      doc.addPage()
      y = 12
      drawHeader()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }
    doc.setDrawColor(220, 226, 240)
    doc.rect(x, y, tableW, rowH)
    let cx = x
    for (const c of opts.columns) {
      doc.text(fit(String(c.get(r)), c.w), textX(cx, c), y + 4.6, { align: c.align ?? 'left' })
      cx += c.w
    }
    y += rowH
  }

  doc.save(opts.fileName)
}
