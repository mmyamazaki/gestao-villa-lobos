/** Máscaras e validação no padrão brasileiro (entrada incremental). */

export function onlyDigits(s: string) {
  return s.replace(/\D/g, '')
}

export function formatCpfBR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11)
  if (!d) return ''
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function isCpfComplete(formattedOrRaw: string) {
  return onlyDigits(formattedOrRaw).length === 11
}

/** RG numérico “limpo” (somente dígitos, até 9). */
export function formatRgNumericBR(raw: string) {
  return onlyDigits(raw).slice(0, 9)
}

/** RG numérico no cadastro (6 a 9 dígitos, conforme estado/modelo). */
export function isRgNumericComplete(s: string) {
  const n = onlyDigits(s).length
  return n >= 6 && n <= 9
}

/** Celular (11 dígitos): (XX) 9 XXXX-XXXX */
export function formatPhoneMobileBR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 2) return d
  const dd = d.slice(0, 2)
  if (d.length <= 3) return `(${dd}) ${d.slice(2)}`
  if (d.length <= 7) return `(${dd}) ${d.slice(2, 3)} ${d.slice(3)}`
  return `(${dd}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7, 11)}`
}

/** Fixo (10 dígitos): (XX) XXXX-XXXX */
export function formatPhoneLandlineBR(raw: string) {
  const d = onlyDigits(raw).slice(0, 10)
  if (d.length <= 2) return d
  const dd = d.slice(0, 2)
  if (d.length <= 6) return `(${dd}) ${d.slice(2)}`
  return `(${dd}) ${d.slice(2, 6)}-${d.slice(6, 10)}`
}

export function isMobileComplete(s: string) {
  return onlyDigits(s).length === 11
}

export function isLandlineComplete(s: string) {
  return onlyDigits(s).length === 10
}

/** Celular OU fixo completo. */
export function isPhoneBrComplete(s: string) {
  const n = onlyDigits(s).length
  return n === 10 || n === 11
}

/** Durante a digitação: 10 dígitos fixo, 11 celular (9º dígito após DDD). */
export function formatPhoneFlexibleBR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 2) return d
  const dd = d.slice(0, 2)
  if (d.length <= 10) {
    if (d.length <= 6) return `(${dd}) ${d.slice(2)}`
    return `(${dd}) ${d.slice(2, 6)}-${d.slice(6, 10)}`
  }
  return `(${dd}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7, 11)}`
}
