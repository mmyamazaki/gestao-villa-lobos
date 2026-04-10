# Deploy na web (produção)

App full-stack: **Express + Prisma** serve a API (`/api/*`) e o frontend estático (`dist/`). O comando **`npm start`** garante Prisma client, compila o servidor se faltar `dist-server/` e sobe o Node.

## Requisitos

- **Node.js 20+** (ver `engines` em `package.json`)
- **PostgreSQL** (ex.: Supabase) e variável **`DATABASE_URL`**

## Variáveis de ambiente no servidor

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `DATABASE_URL` | Sim | Connection string do Postgres (Supabase). Preferir `db.<ref>.supabase.co:5432`. |
| `PORT` | PaaS | Muitos hosts injetam automaticamente; tem **prioridade** sobre `API_PORT`. |
| `API_PORT` | Hostinger / dev | Se `PORT` não existir, a app usa **API_PORT** (ex. **3000** no painel). Local: Vite/predev (ex. **3333**). |
| `NODE_ENV` | Recomendado | `production` |
| `ADMIN_SESSION_SECRET` | Sim em produção | Mín. 8 caracteres; ver `.env.example`. |
| `ALLOWED_ORIGINS` | Opcional | Origens CORS separadas por vírgula; vazio = permite qualquer origem. |
| `LISTEN_HOST` / `HOST` | Opcional | `LISTEN_HOST` força o bind. `HOST` só se for IP/`localhost` (nunca o domínio público). |
| `BIND_ALL_INTERFACES` | Opcional | `1` → escuta `0.0.0.0` em produção. Sem `PORT`, produção pode **omitir host** no `listen` (defeito Node). |

**Build do frontend:** as variáveis `VITE_*` são lidas no **`npm run build`**; definas no ambiente de CI/build, não só no runtime.

## Comandos (painel ou CI)

```bash
npm ci
npm run build
npm start
```

- **`npm run build`**: gera `dist/` (Vite) e `dist-server/` (TypeScript da API).
- Não use só `vite build` sem o `tsc` do servidor.
- Se o host desativar scripts no `npm install`, o **`npm start`** tenta `prisma generate` e compilar o servidor quando necessário.

## Verificação pós-deploy

- `https://seu-dominio/api/health` → `{"ok":true,...}`
- `https://seu-dominio/api/health/db` → base acessível
- `https://seu-dominio/api/health/schema` → auditoria de tabelas/RLS (opcional)

## Ficheiro de entrada

- **`npm start`** → `node index.js` → `scripts/start-production.mjs` → `await start()` em `dist-server/server/index.js`
- Painéis que exijam **Entry file** → `index.js` (delega para o mesmo fluxo)
