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
   - **Comando de construção / Build:** preferir **`npm run build`** (Vite + `tsc`). Se o painel só correr **`vite build`**, o **`npm start`** ainda assim **recompila a API** quando `server/**/*.ts` é mais novo que `dist-server/` (o `prestart` corre `tsc`). Sem `typescript` instalado no servidor, esse passo falha — mantenha **`typescript` em `dependencies`** (já está no projeto).
   - **Ficheiro de entrada / Entry file:** **`index.js`** (na raiz do repo). Alguns painéis só aceitam este nome; **`server.js`** na raiz reexporta o mesmo e também funciona. Em Linux, `dist-server` ≠ `Dist-Server`.
   - **Comando de arranque / Start:** **`npm start`** — corre **`prestart`** (`ensure-dist-server.mjs`): se faltar `dist-server/server/index.js`, tenta **`tsc`** de novo. **Evita** `node server.js` direto no painel (o `prestart` não corre).
4. Em **Variáveis de ambiente**, adiciona (os mesmos nomes do teu `.env` local):
   - `NODE_ENV=production`
   - **`HOST` com domínio público** → ignorado; bind **`0.0.0.0`** no código. **`LISTEN_HOST` / `BIND_ALL_INTERFACES`**: ver `DEPLOY.md`.
   - `DATABASE_URL` — connection string do Supabase/Postgres
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`
   - `ADMIN_SESSION_SECRET` (mín. 8 caracteres, aleatório — assina o cookie de sessão da secretaria; **obrigatório** em produção)
   - **`PORT`** ou **`API_PORT`** — lógica interna da app (muitas vezes **3000**). **LiteSpeed** (Hostinger) pode expor a app por **socket Unix** (`extapp-sock/..._.sock`): o log `socket.address()` mostra esse caminho — **não** há serviço em `curl 127.0.0.1:3000` nesse modo; o auto-teste usa o socket Unix. O 503 no browser costuma ser **domínio / site errado no hPanel**, não “porta TCP”.
   - Opcional: `ALLOWED_ORIGINS=https://teu-dominio.com` (se o CORS reclamar)
5. **Guardar** e **Reimplantar / Deploy**.

### Erro *Cannot find module* … *dist-server/server/index.js*

O build não gerou a pasta **`dist-server/`** (comando de build errado, `tsc` falhou, ou deploy por ZIP sem correr `npm run build`). Corrige o **Build** no painel e usa **`npm start`**.

### Erro 503 no browser

Se o log mostrar **`socket.address()`** como **`/usr/local/lsws/extapp-sock/..._.sock`**, é **LiteSpeed + socket Unix**: ignora **`ECONNREFUSED` em `127.0.0.1:3000`** (normal). O log deve mostrar **`auto-teste unix:... → HTTP 200`**. Com app OK e 503 → confirma no hPanel que o **domínio** está na **mesma Node Web App** e que não há **outro site estático** a “roubar” o domínio; fala com o suporte Hostinger se o `.htaccess` em `public_html` não encaminhar para a app Node.

### Vários `[boot] index.js carregado` seguidos (mesma porta)

Se o painel **arranca o mesmo `npm start` várias vezes em paralelo**, vários processos disputam a porta **3000**. O lock é uma **pasta** `gestao-villa-lobos.node.lock/` criada com `mkdir` (atómico) com ficheiro `pid` dentro — evita a corrida que permitia **dois** `LISTENING` e **503**. Lock legado em **ficheiro** com o mesmo nome é ainda respeitado até migrar. O lock **não** é apagado em SIGTERM. `EADDRINUSE` → saída código **0**. Bind explícito **`0.0.0.0`** por defeito em produção. Uma única app Node por domínio.

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
- Escuta: `app.listen(port, host)` com **`0.0.0.0`** por defeito (nunca `listen(port)` só). `BIND_ALL_INTERFACES=1` → **`0.0.0.0`**. Log **`socket.address()`** + auto-teste loopback.

## Se não aparecer “Node.js App” no teu plano

Aí a Hostinger **não oferece** processo Node nesse produto — opções: subir noutro serviço (ex. `DEPLOY.md` → Render) ou VPS, e usar domínio/DNS na Hostinger.
