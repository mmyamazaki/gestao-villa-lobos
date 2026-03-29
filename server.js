/**
 * Entrada em JavaScript para hosts que só aceitam "Entry file" .js (ex.: Hostinger).
 * Carrega o servidor Express em TypeScript via tsx.
 *
 * Sem top-level await: o launcher da Hostinger (lsnode) usa require() e falha com
 * ERR_REQUIRE_ASYNC_MODULE se este ficheiro tiver await no nível superior.
 *
 * register() do tsx é síncrono; depois import() dinâmico carrega o .ts.
 */
import { register } from 'tsx/esm/api'

register()

import('./server/index.ts').catch((err) => {
  console.error('[server.js]', err)
  process.exit(1)
})
