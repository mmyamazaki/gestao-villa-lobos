import 'dotenv/config'

console.log('[boot] index.js carregado')

/**
 * Sem lock de instância única: o LiteSpeed/LSAPI da Hostinger gere os processos e o `app.listen()`
 * é interceptado para o socket de cada vhost. O lock antigo prendia a app ao socket do domínio
 * temporário e matava os workers do domínio real → 503 + relançamento contínuo (Max Processes).
 * Deixamos a plataforma gerir os workers; vários processos por vhost é o comportamento esperado.
 */
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
