# Imagem única: build do Vite + servidor Express (tsx) — um processo serve / e /api.
# Build requer as mesmas variáveis do projeto (check-quick + Vite). Exemplo:
#   docker build \
#     --build-arg DATABASE_URL="postgresql://..." \
#     --build-arg VITE_SUPABASE_URL="https://xxx.supabase.co" \
#     --build-arg VITE_SUPABASE_ANON_KEY="eyJ..." \
#     --build-arg VITE_ADMIN_EMAIL="a@b.com" \
#     --build-arg VITE_ADMIN_PASSWORD="***" \
#     -t gestao-villa-lobos .

FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Obrigatórias no prebuild (check-quick) e no vite build
ARG DATABASE_URL
ARG API_PORT=3333
ENV DATABASE_URL=${DATABASE_URL}
ENV API_PORT=${API_PORT}

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_ADMIN_EMAIL
ARG VITE_ADMIN_PASSWORD
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_ADMIN_EMAIL=${VITE_ADMIN_EMAIL}
ENV VITE_ADMIN_PASSWORD=${VITE_ADMIN_PASSWORD}

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Runtime: Prisma + Express; PORT costuma ser sobrescrita pelo orquestrador
CMD ["npm", "start"]
