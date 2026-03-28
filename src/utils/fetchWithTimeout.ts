/** fetch com timeout para não ficar pendurado se a API não responder (proxy/porta). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 45_000, ...rest } = init
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...rest, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(
        'Tempo esgotado ao contatar o servidor. Verifique npm run dev, se API_PORT no .env bate com a API e se o proxy /api no Vite está ativo.',
      )
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}
