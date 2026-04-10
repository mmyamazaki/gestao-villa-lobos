/**
 * Ponto de entrada Node em produção (muitos painéis exigem "Entry file" = index.js).
 * Bootstrap: scripts/start-production.mjs → carrega dist-server/server/index.js (Express).
 */
console.log('[boot] index.js iniciado')

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err)
})

try {
  await import('./scripts/start-production.mjs')
  console.log('[boot] import de produção concluído')
} catch (err) {
  console.error('[boot] falha ao carregar produção:', err)
  process.exit(1)
}
