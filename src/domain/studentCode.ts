export function generateStudentCode() {
  const partA = Math.floor(10 + Math.random() * 90)
  const partB = Math.floor(100 + Math.random() * 900)
  return `${partA}.${partB}`
}

export function isValidStudentCode(s: string) {
  return /^\d{2}\.\d{3}$/.test(s.trim())
}
