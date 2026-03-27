function pad2(n: number) {
  return n.toString().padStart(2, '0')
}

/** Normaliza nascimento para YYYY-MM-DD (input date, ou DD/MM/AAAA, DD-MM-AAAA). */
export function normalizeBirthToIso(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (br) {
    const day = Number(br[1])
    const month = Number(br[2])
    const y = Number(br[3])
    if (day < 1 || day > 31 || month < 1 || month > 12 || y < 1900) return ''
    return `${y}-${pad2(month)}-${pad2(day)}`
  }
  return ''
}

function ageFromCalendar(y: number, month1: number, day: number): number {
  const t = new Date()
  const ty = t.getFullYear()
  const tm = t.getMonth() + 1
  const td = t.getDate()
  let age = ty - y
  if (tm < month1 || (tm === month1 && td < day)) age--
  return Math.max(0, age)
}

/**
 * Calcula idade em anos completos a partir de YYYY-MM-DD (input type="date")
 * ou, em último caso, de uma data interpretável por Date — sempre no calendário local.
 */
export function calcAgeYears(dataNascimento: string): number | null {
  const raw = dataNascimento.trim()
  if (!raw) return null

  const normalized = normalizeBirthToIso(raw)
  const toParse = normalized || raw
  const iso = toParse.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const day = Number(iso[3])
    if (!y || m < 1 || m > 12 || day < 1 || day > 31) return null
    return ageFromCalendar(y, m, day)
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return ageFromCalendar(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
