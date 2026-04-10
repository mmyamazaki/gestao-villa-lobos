/**
 * Ponto de entrada Node em produção (muitos painéis exigem "Entry file" = index.js).
 * Garante dist-server antes de carregar a API (ver scripts/start-production.mjs).
 *
 * Diagnóstico Hostinger/Kodee: `import` estático corre antes do corpo do módulo;
 * usamos import dinâmico para este log e handlers aparecerem primeiro nos Runtime logs.
 */
console.log('app iniciada')

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err)
})

await import('./scripts/start-production.mjs')
