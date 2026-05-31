import 'dotenv/config'
import { setTimeout as sleep } from 'node:timers/promises'
import { acquireSingletonLock } from './scripts/singleton-lock.mjs'

console.log('[boot] index.js carregado')

;(async () => {
  try {
    if (!(await acquireSingletonLock())) {
      /**
       * Pausa antes de sair: a saída instantânea de uma cópia que perdeu o lock pode ser lida
       * pelo supervisor da Hostinger como "processo arrancou e morreu" → relança em rajada →
       * Max Processes. A espera trava o ciclo apertado de respawn enquanto a instância dona serve.
       */
      await sleep(2000)
      process.exit(0)
    }
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
