import type { jsPDF } from 'jspdf'

/** Margens laterais e altura de linha mínima ~1,5× para evitar sobreposição. */
export const PDF_MARGIN_X = 18
export const PDF_LINE_HEIGHT_MULT = 1.52

const PT_TO_MM = 25.4 / 72

export function contentWidthMm(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - 2 * PDF_MARGIN_X
}

export function lineHeightMm(doc: jsPDF, mult = PDF_LINE_HEIGHT_MULT): number {
  return doc.getFontSize() * mult * PT_TO_MM
}

/** Quebra em linhas e desenha; retorna Y após o bloco. */
export function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  yStart: number,
  maxWidth: number,
  opts?: { font?: 'normal' | 'bold'; size?: number; lineMult?: number },
): number {
  const size = opts?.size ?? 10
  const font = opts?.font ?? 'normal'
  const mult = opts?.lineMult ?? PDF_LINE_HEIGHT_MULT
  doc.setFont('helvetica', font)
  doc.setFontSize(size)
  doc.setLineHeightFactor(mult)
  const lines = doc.splitTextToSize(text.trim(), maxWidth)
  const lh = lineHeightMm(doc, mult)
  let y = yStart
  const pageH = doc.internal.pageSize.getHeight()
  const bottom = pageH - PDF_MARGIN_X
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (y + lh > bottom) {
      doc.addPage()
      y = PDF_MARGIN_X
    }
    doc.text(line, x, y)
    y += lh
  }
  return y
}

/** Fluxo com troca normal/negrito e quebra de linha dentro de maxWidth. */
export function drawSegmentParagraph(
  doc: jsPDF,
  segments: { text: string; bold?: boolean }[],
  x: number,
  yStart: number,
  maxWidth: number,
  fontSize = 10,
  lineMult = PDF_LINE_HEIGHT_MULT,
): number {
  type Piece = { t: string; bold: boolean }
  const pieces: Piece[] = []
  for (const seg of segments) {
    const b = Boolean(seg.bold)
    for (const raw of seg.text.split(/(\s+)/)) {
      if (raw) pieces.push({ t: raw, bold: b })
    }
  }

  let y = yStart
  let xCursor = x
  const lh = fontSize * lineMult * PT_TO_MM
  const right = x + maxWidth
  const pageBottom = () => doc.internal.pageSize.getHeight() - PDF_MARGIN_X

  const newLine = () => {
    y += lh
    xCursor = x
    if (y > pageBottom()) {
      doc.addPage()
      y = PDF_MARGIN_X
    }
  }

  for (const p of pieces) {
    doc.setFont('helvetica', p.bold ? 'bold' : 'normal')
    doc.setFontSize(fontSize)
    const w = doc.getTextWidth(p.t)
    if (xCursor + w > right && xCursor > x + 0.1) {
      newLine()
    }
    if (xCursor + w > right && xCursor <= x + 0.1 && p.t.trim()) {
      doc.setFont('helvetica', p.bold ? 'bold' : 'normal')
      const chunks = doc.splitTextToSize(p.t.trim(), maxWidth)
      for (let i = 0; i < chunks.length; i++) {
        const part = chunks[i] as string
        doc.text(part, x, y)
        if (i < chunks.length - 1) newLine()
        else xCursor = x + doc.getTextWidth(part)
      }
      continue
    }
    doc.text(p.t, xCursor, y)
    xCursor += w
  }
  return y + lh * 0.4
}
