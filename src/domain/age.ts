export function calcAgeYears(dataNascimento: string): number | null {
  if (!dataNascimento) return null
  const d = new Date(dataNascimento + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return null
  const t = new Date()
  let age = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--
  return Math.max(0, age)
}
