# Deploy definitivo (API + site no mesmo URL)

O painel da Hostinger que **só** faz `npm run build` + pasta `dist` é **hospedagem estática**: **não executa Node**, logo **não existe `/api`**. Isso não se “liga” no `package.json` — é o tipo de produto.

## Solução recomendada (uma vez)

Subir **um único serviço** que corre `npm run build` e depois `npm start` (Express serve `dist/` + rotas `/api`).

### Opção A — Render.com (grátis possível)

1. Conta em [Render](https://render.com).
2. **New → Blueprint** (ou Web Service) e liga este repositório.
3. Usa o ficheiro `render.yaml` ou cria um **Web Service** manualmente:
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
4. No painel, define **todas** as variáveis (as mesmas do `.env` local): `DATABASE_URL`, `API_PORT` (ou só `PORT` se o Render injetar), `VITE_SUPABASE_*`, `VITE_ADMIN_*`.
5. Abre o URL que o Render der (ex.: `https://gestao-villa-lobos.onrender.com`) — **aí** o site e a API estão no mesmo domínio.

### Opção B — Docker (VPS, Fly.io, etc.)

```bash
docker build \
  --build-arg DATABASE_URL="postgresql://..." \
  --build-arg VITE_SUPABASE_URL="https://....supabase.co" \
  --build-arg VITE_SUPABASE_ANON_KEY="..." \
  --build-arg VITE_ADMIN_EMAIL="..." \
  --build-arg VITE_ADMIN_PASSWORD="..." \
  -t gestao-villa-lobos .
docker run -p 8080:8080 -e DATABASE_URL="postgresql://..." -e PORT=8080 gestao-villa-lobos
```

Ajusta `PORT` conforme o host.

### Se quiseres manter a Hostinger só para o domínio

- Coloca o app **Render/Fly/outro** como está acima.
- No DNS da Hostinger, aponta o domínio (CNAME) para o URL do PaaS **ou** usa a Hostinger só para redirecionamento.

### Hostinger “só estática” + API noutro sítio

1. Deploy da API num serviço Node (Render, etc.).
2. No **build** do site na Hostinger, define `VITE_API_BASE_URL=https://url-da-api` para o bundle saber onde chamar a API.

---

**Resumo:** o fallback Supabase no browser ajuda a **ler** dados sem Node; **gravar** e lógica de negócio completas continuam a precisar da API ou de políticas Supabase avançadas. Para fechar o ciclo de forma limpa, usa **um processo Node** em produção como acima.
