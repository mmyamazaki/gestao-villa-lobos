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
   - **`HOST` com o domínio do site (ex. `appvillalobosro.com.br`) quebra o proxy** → 503. O código **ignora** esse valor. Em produção, **sem `PORT` definido** (só `API_PORT`, típico no painel), a app escuta em **`127.0.0.1`** para alinhar com o proxy Apache/LiteSpeed. **`BIND_ALL_INTERFACES=1`** força **`0.0.0.0`**. PaaS com `PORT` injetado continuam com **`0.0.0.0`**.
   - `DATABASE_URL` — connection string do Supabase/Postgres
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`
   - `ADMIN_SESSION_SECRET` (mín. 8 caracteres, aleatório — assina o cookie de sessão da secretaria; **obrigatório** em produção)
   - **`PORT`** ou **`API_PORT`** — a app usa **`PORT` primeiro**; se não existir, usa **`API_PORT`** (comum na Hostinger com valor **3000**), senão **3000**. O proxy tem de apontar para a mesma porta que aparece no log `LISTENING`.
   - Opcional: `ALLOWED_ORIGINS=https://teu-dominio.com` (se o CORS reclamar)
5. **Guardar** e **Reimplantar / Deploy**.

### Erro *Cannot find module* … *dist-server/server/index.js*

O build não gerou a pasta **`dist-server/`** (comando de build errado, `tsc` falhou, ou deploy por ZIP sem correr `npm run build`). Corrige o **Build** no painel e usa **`npm start`**.

### Erro 503 no browser

Quase sempre o **Node não está a escutar** na porta que o proxy espera, ou o processo **nem arrancou** (crash antes do `listen`). Depois do redeploy, abre os **logs de runtime** e procura **`listening on http://0.0.0.0:`** — se não aparecer, cola as últimas linhas do log (erros de Prisma, `EADDRINUSE`, etc.).

### Vários `[boot] index.js carregado` seguidos (mesma porta)

Se o painel **arranca o mesmo `npm start` várias vezes em paralelo**, vários processos disputam a porta **3000** e o site fica instável. O projeto usa um **ficheiro de lock** (`gestao-villa-lobos.node.lock` na pasta da app) para só **uma** instância escutar; as outras terminam com mensagem explícita nos logs. O lock **não** é apagado em SIGTERM/SIGINT: no redeploy, apagar o lock ao receber SIGTERM permitia que um segundo processo obtivesse lock enquanto o primeiro ainda escutava na porta → dois `LISTENING` e **503** no proxy. O lock só deixa de valer quando o PID morre (o próximo arranque remove ficheiro obsoleto). O conteúdo do lock é escrito de forma atómica (`wx` + uma escrita); se outro processo vir o ficheiro ainda **vazio** ou incompleto, **espera** em vez de apagar de imediato (corrida que permitia **dois** `LISTENING`). Se a porta já estiver ocupada (`EADDRINUSE`), o processo sai com **código 0**. No hPanel, confirme **uma única** aplicação Node a apontar para este projeto.

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
- Escuta com `app.listen(port, listenHost)` onde `port = PORT` **ou** `API_PORT` **ou** `3000`; em produção **sem** `PORT`, o host de escuta padrão é **`127.0.0.1`** (proxy local). `BIND_ALL_INTERFACES=1` volta a **`0.0.0.0`**.

## Se não aparecer “Node.js App” no teu plano

Aí a Hostinger **não oferece** processo Node nesse produto — opções: subir noutro serviço (ex. `DEPLOY.md` → Render) ou VPS, e usar domínio/DNS na Hostinger.
