/**
 * Entrada em JavaScript para painéis que fixam "Entry file" = server.js.
 * O servidor real é JS compilado em dist-server/ (build: tsc), sem tsx/esbuild em runtime —
 * evita EACCES ao binário @esbuild/linux-x64 em alojamentos partilhados (ex.: Hostinger).
 */
import './dist-server/server/index.js'
