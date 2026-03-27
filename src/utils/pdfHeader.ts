import type { jsPDF } from 'jspdf'

export const SCHOOL_DISPLAY_NAME = 'Escola de Música Villa-Lobos Ltda'
export const SCHOOL_CNPJ = '07.513.759/0001-17'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/** Cabeçalho universal: logomarca à esquerda, nome ao centro, CNPJ abaixo do nome. Retorna Y após o bloco. */
export async function drawPdfHeader(doc: jsPDF, startY: number): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth()
  let y = startY
  const logoH = 12
  const logoW = 42

  try {
    const res = await fetch(`${window.location.origin}/logo-emvl-horizontal.png`)
    if (res.ok) {
      const dataUrl = await blobToDataUrl(await res.blob())
      doc.addImage(dataUrl, 'PNG', 18, y, logoW, logoH)
    }
  } catch {
    /* sem logo */
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(SCHOOL_DISPLAY_NAME, pageW / 2, y + 7, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`CNPJ: ${SCHOOL_CNPJ}`, pageW / 2, y + 13, { align: 'center' })

  y += Math.max(logoH, 16) + 4
  return y
}
