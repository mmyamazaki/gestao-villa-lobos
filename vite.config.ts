import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

function apiPortFromEnv(env: Record<string, string>): string {
  const raw = env.API_PORT?.trim()
  if (!raw) return '3333'
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 65535) return '3333'
  return String(n)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = apiPortFromEnv(env as Record<string, string>)

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // 5174 por padrão; se ocupada, o Vite tenta a próxima.
      port: 5174,
      strictPort: false,
      host: true,
      // Mesma porta que server/index.ts (API_PORT no .env)
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          /** Evita proxy pendurado se a API não responder (padrão pode ser indefinido). */
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
      },
    },
  }
})
