# Rodar o sistema na Hostinger (Node.js App)

O que **não** funciona: deploy que só tem **“Comando de construção”** + **diretório `dist`** (site estático). Aí **não corre** `npm start` e o Express **não existe**.

O que **funciona**: criar uma **aplicação Node.js** no painel (nome pode variar: *Node.js App*, *Web App*, *Deploy Node.js*) — é o tipo de deploy que tem **Start command**.

## O que fazer no painel (resumo)

1. No hPanel, procura **Node.js** / **Aplicações Node.js** / **Criar aplicação**.
2. Liga o **repositório Git** (ou envia o ficheiro ZIP do projeto).
3. Define:
   - **Versão Node:** **20.x** (recomendado pelo suporte Hostinger para Node App).
   - **Gerenciador de pacotes:** `npm`.
   - **Comando de instalação:** deixa vazio ou `npm install` (muitos painéis fazem automático).
   - **Comando de construção / Build:** **`npm run build`** ou **`npm ci && npm run build`** — **obrigatório** gerar **`dist/`** (Vite) **e** **`dist-server/server/index.js`** (`tsc`). **Não** uses só **`vite build`**: isso **não** cria `dist-server/` e o arranque rebenta com *Cannot find module*.
   - **Ficheiro de entrada / Entry file:** **`index.js`** (na raiz do repo). Alguns painéis só aceitam este nome; **`server.js`** na raiz reexporta o mesmo e também funciona. Em Linux, `dist-server` ≠ `Dist-Server`.
   - **Comando de arranque / Start:** **`npm start`** — corre **`prestart`** (`ensure-dist-server.mjs`): se faltar `dist-server/server/index.js`, tenta **`tsc`** de novo. **Evita** `node server.js` direto no painel (o `prestart` não corre).
4. Em **Variáveis de ambiente**, adiciona (os mesmos nomes do teu `.env` local):
   - `NODE_ENV=production`
   - `HOST` no painel é **opcional** — o servidor fixa sempre `0.0.0.0` no código (recomendação do suporte: evitar 503 por bind em `127.0.0.1`).
   - `DATABASE_URL` — connection string do Supabase/Postgres
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`
   - `ADMIN_SESSION_SECRET` (mín. 16 caracteres, aleatório — assina o cookie de sessão da secretaria; **obrigatório** em produção)
   - **`PORT`** — muitos hosts **injeta** automaticamente; confirma nos logs de runtime a linha `listening on http://0.0.0.0:PORT`. Se o painel **não** definir `PORT`, adiciona manualmente a porta que o painel indica (ex.: a mesma do URL interno da app).
   - Não uses `API_PORT` em produção no painel (é só para desenvolvimento local); em produção vale só `PORT`.
   - Opcional: `ALLOWED_ORIGINS=https://teu-dominio.com` (se o CORS reclamar)
5. **Guardar** e **Reimplantar / Deploy**.

### Erro *Cannot find module* … *dist-server/server/index.js*

O build não gerou a pasta **`dist-server/`** (comando de build errado, `tsc` falhou, ou deploy por ZIP sem correr `npm run build`). Corrige o **Build** no painel e usa **`npm start`**.

### Erro 503 no browser

Quase sempre o **Node não está a escutar** na porta que o proxy espera, ou o processo **nem arrancou** (crash antes do `listen`). Depois do redeploy, abre os **logs de runtime** e procura **`listening on http://0.0.0.0:`** — se não aparecer, cola as últimas linhas do log (erros de Prisma, `EADDRINUSE`, etc.).

### HTTP 500 na API — Prisma `PANIC` / `timer has gone away`

O pooler **transação** do Supabase (**6543**) é problemático para o Prisma. O código **troca para 5432** no mesmo host `*.pooler.supabase.com` (modo sessão). Rotas `/api/...` e variáveis `VITE_*` no browser **não são alteradas**.

### `ERR_REQUIRE_ASYNC_MODULE`

O **`index.js`** / **`server.js`** não usam top-level await; importam só JS já compilado.

### `TransformError` / `esbuild` / **`EACCES`**

Em alojamento partilhado o binário do **esbuild** pode falhar por **permissão**. O **`esbuild`** está em **`devDependencies`** (junto ao Vite). O **`postinstall`** (`scripts/postinstall.mjs`): **`chmod` 755** só em **`node_modules/esbuild/bin/esbuild`**, **`npm rebuild esbuild --force`**, **`npx esbuild --version`**, depois **`prisma generate`**. O **`npm start`** não usa `tsx` — API em **`dist-server/`** (`tsc`); o **Vite** no **`npm run build`** usa o esbuild resolvido a partir da raiz do projeto.

## O que o projeto já garante (para não precisares de mudar código)

- `npm start` → `node index.js` → `./dist-server/server/index.js` (sem esbuild em runtime).
- **`index.js`** na raiz (entrada principal); **`server.js`** reexporta para painéis antigos que fixam esse nome.
- `npm run build` → `dist/` (Vite) + `dist-server/` (API compilada); o Express serve `dist/` + `/api` no **mesmo processo** (`dist` via `process.cwd()`).
- `postinstall` → `node scripts/postinstall.mjs` (chmod + rebuild esbuild + `prisma generate`).
- Escuta com `app.listen(port, '0.0.0.0')` onde `port = Number(process.env.PORT || 3000)`.

## Se não aparecer “Node.js App” no teu plano

Aí a Hostinger **não oferece** processo Node nesse produto — opções: subir noutro serviço (ex. `DEPLOY.md` → Render) ou VPS, e usar domínio/DNS na Hostinger.
