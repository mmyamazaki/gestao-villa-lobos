console.log('[boot] index.js carregado')

;(async () => {
  try {
    await import('./scripts/start-production.mjs')
    console.log('[boot] start-production.mjs carregado')
  } catch (err) {
    console.error('[boot] erro fatal ao iniciar:', err)
    process.exit(1)
  }
})()

process.on('uncaughtException', (err) => {
  console.error('[boot] uncaughtException:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('[boot] unhandledRejection:', err)
})
