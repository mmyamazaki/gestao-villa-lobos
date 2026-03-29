/**
 * Entrada em JavaScript para hosts que só aceitam "Entry file" .js (ex.: Hostinger).
 * Carrega o servidor Express em TypeScript via tsx.
 */
import { register } from 'tsx/esm/api'

await register()
await import('./server/index.ts')
