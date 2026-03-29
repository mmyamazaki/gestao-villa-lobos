function timeoutHint(): string {
  if (import.meta.env.DEV) {
    return ' Verifique se a API está no ar (npm run dev), API_PORT no .env e o proxy /api no Vite.'
  }
  return ' Verifique se o processo Node da API está rodando no host e se DATABASE_URL está correto.'
}

/**
 * fetch com limite de tempo usando Promise.race — evita ficar pendurado quando o motor não
 * rejeita o fetch após AbortSignal (comportamento inconsistente entre browsers).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 45_000, ...rest } = init
  const ctrl = new AbortController()
  const timedOutError = new Error(`Tempo esgotado ao contatar o servidor.${timeoutHint()}`)
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort()
      reject(timedOutError)
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      fetch(input, { ...rest, signal: ctrl.signal }),
      timeoutPromise,
    ])
  } catch (e) {
    if (e === timedOutError) throw timedOutError
    if (e instanceof DOMException && e.name === 'AbortError') throw timedOutError
    if (e instanceof Error && e.name === 'AbortError') throw timedOutError
    throw e
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Lê res.text() com teto de tempo (evita pendurar se o servidor não fechar o corpo). */
export async function readResponseTextWithTimeout(
  res: Response,
  timeoutMs = 30_000,
): Promise<string> {
  const slow = new Error('Tempo esgotado ao ler a resposta do servidor.')
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(slow), timeoutMs)
  })
  try {
    return await Promise.race([res.text(), timeoutPromise])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
