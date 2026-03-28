function timeoutHint(): string {
  if (import.meta.env.DEV) {
    return ' Verifique se a API está no ar (npm run dev), API_PORT no .env e o proxy /api no Vite.'
  }
  return ' Verifique se o processo Node da API está rodando no host e se DATABASE_URL está correto.'
}

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
      throw new Error(`Tempo esgotado ao contatar o servidor.${timeoutHint()}`)
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}
