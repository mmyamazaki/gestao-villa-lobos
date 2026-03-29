# Rodar o sistema na Hostinger (Node.js App)

O que **não** funciona: deploy que só tem **“Comando de construção”** + **diretório `dist`** (site estático). Aí **não corre** `npm start` e o Express **não existe**.

O que **funciona**: criar uma **aplicação Node.js** no painel (nome pode variar: *Node.js App*, *Web App*, *Deploy Node.js*) — é o tipo de deploy que tem **Start command**.

## O que fazer no painel (resumo)

1. No hPanel, procura **Node.js** / **Aplicações Node.js** / **Criar aplicação**.
2. Liga o **repositório Git** (ou envia o ficheiro ZIP do projeto).
3. Define:
   - **Versão Node:** **22.x** (ou 20 LTS se 22 não existir).
   - **Gerenciador de pacotes:** `npm`.
   - **Comando de instalação:** deixa vazio ou `npm install` (muitos painéis fazem automático).
   - **Comando de construção:** `npm run build`
   - **Ficheiro de entrada / Entry file:** se o painel **só aceitar `.js`**, usa **`server.js`** na raiz do projeto (wrapper que carrega `server/index.ts` via `tsx`). Se puderes deixar em branco, também serve — o **Start** é o que importa.
   - **Comando de arranque / Start:** `npm start` (equivale a `node server.js`)
4. Em **Variáveis de ambiente**, adiciona (os mesmos nomes do teu `.env` local):
   - `DATABASE_URL` — connection string do Supabase/Postgres
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`
   - Se o painel **injetar** `PORT`, não precisas duplicar; o `server/index.ts` já usa `process.env.PORT`
   - Opcional: `ALLOWED_ORIGINS=https://teu-dominio.com` (se o CORS reclamar)
5. **Guardar** e **Reimplantar / Deploy**.

## O que o projeto já garante (para não precisares de mudar código)

- `npm start` → `node server.js` → regista o `tsx` e importa `server/index.ts` (`tsx` está em `dependencies`).
- **`server.js`** existe para painéis que obrigam **Entry file** em JavaScript; podes também correr localmente: `node server.js`.
- `npm run build` → gera `dist/`; o Express serve `dist/` + rotas `/api` no **mesmo processo**.
- `postinstall` → `prisma generate` após `npm install`.
- Escuta em `process.env.PORT` (a Hostinger injeta); sem `PORT`, usa `3333` em desenvolvimento local.

## Se não aparecer “Node.js App” no teu plano

Aí a Hostinger **não oferece** processo Node nesse produto — opções: subir noutro serviço (ex. `DEPLOY.md` → Render) ou VPS, e usar domínio/DNS na Hostinger.
