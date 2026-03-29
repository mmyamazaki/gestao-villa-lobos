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
   - **Comando de construção / Build:** `npm ci && npm run build` ou `npm run build` (Vite → `dist/` + **TypeScript** → `dist-server/`; o `npm start` corre JS compilado, **sem** `tsx`/esbuild em runtime).
   - **Ficheiro de entrada / Entry file:** **`server.js`** na raiz (importa `./dist-server/server/index.js`). O build tem de correr **antes** do start para existir `dist-server/`.
   - **Comando de arranque / Start:** `npm start` (equivale a `node server.js`)
4. Em **Variáveis de ambiente**, adiciona (os mesmos nomes do teu `.env` local):
   - `NODE_ENV=production`
   - `HOST` no painel é **opcional** — o servidor fixa sempre `0.0.0.0` no código (recomendação do suporte: evitar 503 por bind em `127.0.0.1`).
   - `DATABASE_URL` — connection string do Supabase/Postgres
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`
   - **`PORT`** — muitos hosts **injeta** automaticamente; confirma nos logs de runtime a linha `listening on http://0.0.0.0:PORT`. Se o painel **não** definir `PORT`, adiciona manualmente a porta que o painel indica (ex.: a mesma do URL interno da app).
   - Não uses `API_PORT` em produção no painel (é só para desenvolvimento local); em produção vale só `PORT`.
   - Opcional: `ALLOWED_ORIGINS=https://teu-dominio.com` (se o CORS reclamar)
5. **Guardar** e **Reimplantar / Deploy**.

### Erro 503 no browser

Quase sempre o **Node não está a escutar** na porta que o proxy espera, ou o processo **nem arrancou** (crash antes do `listen`). Depois do redeploy, abre os **logs de runtime** e procura **`listening on http://0.0.0.0:`** — se não aparecer, cola as últimas linhas do log (erros de Prisma, `EADDRINUSE`, etc.).

### `ERR_REQUIRE_ASYNC_MODULE`

O **`server.js`** não usa top-level await; importa só JS já compilado.

### `TransformError` / `esbuild` / **`EACCES`**

Em alojamento partilhado o binário `@esbuild/linux-x64` pode falhar por **permissão**. O projeto faz duas coisas: (1) após `npm install`, o **`postinstall`** corre um script que aplica **`chmod` 755** nesse binário (quando existe), antes do `prisma generate`; (2) o **`npm start` não usa `tsx`** — a API vai em **`dist-server/`** compilada com **`tsc`**, para o runtime não depender do esbuild.

## O que o projeto já garante (para não precisares de mudar código)

- `npm start` → `node server.js` → `./dist-server/server/index.js` (sem esbuild em runtime).
- **`server.js`** na raiz para painéis que exigem **Entry file** `.js`.
- `npm run build` → `dist/` (Vite) + `dist-server/` (API compilada); o Express serve `dist/` + `/api` no **mesmo processo** (`dist` via `process.cwd()`).
- `postinstall` → `prisma generate` após `npm install`.
- Escuta com `app.listen(PORT, '0.0.0.0')` — em **`NODE_ENV=production`** usa **apenas** `process.env.PORT` (injeta a plataforma); em dev, `PORT` / `SERVER_PORT` / `HTTP_PORT` ou `API_PORT` / `3333`.

## Se não aparecer “Node.js App” no teu plano

Aí a Hostinger **não oferece** processo Node nesse produto — opções: subir noutro serviço (ex. `DEPLOY.md` → Render) ou VPS, e usar domínio/DNS na Hostinger.
