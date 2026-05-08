# Operacao Segura (Backup e Rollback)

Este guia prepara a publicacao de melhorias no modulo financeiro com foco em:
- evitar perda de dados
- reduzir indisponibilidade
- voltar para a versao atual rapidamente, se necessario

> Use este runbook sempre antes de alterar pagamentos, mensalidades ou relatorios financeiros.

## 1) Congelar a versao atual (ponto de retorno)

No seu computador, antes de qualquer alteracao:

```bash
git checkout -b release/financeiro-seguro-YYYYMMDD-HHMM
git tag -a pre-financeiro-YYYYMMDD-HHMM -m "Snapshot antes das melhorias do financeiro"
git push origin HEAD --tags
```

Se voce usa deploy por painel (Hostinger/Render), deixe anotado no ticket/nota:
- branch atual em producao
- hash do commit atual (`git rev-parse --short HEAD`)
- tag `pre-financeiro-*`

## 2) Backup completo do banco (obrigatorio)

Defina a URL do banco de producao:

```bash
export DATABASE_URL="postgres://usuario:senha@host:5432/db?sslmode=require"
```

Crie pasta local de backup:

```bash
mkdir -p backups
```

### 2.1 Backup SQL (legivel)
```bash
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges > "backups/pre-financeiro-YYYYMMDD-HHMM.sql"
```

### 2.2 Backup binario (restaura mais rapido)
```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges > "backups/pre-financeiro-YYYYMMDD-HHMM.dump"
```

### 2.3 Validacao minima do backup
```bash
test -s "backups/pre-financeiro-YYYYMMDD-HHMM.sql" && echo "SQL OK"
test -s "backups/pre-financeiro-YYYYMMDD-HHMM.dump" && echo "DUMP OK"
```

## 3) Teste de restauracao (obrigatorio)

Nao basta gerar backup: precisa provar que restaura.

Exemplo (banco temporario de homologacao):
```bash
createdb homol_restore_test
pg_restore --clean --if-exists --no-owner --no-privileges -d homol_restore_test "backups/pre-financeiro-YYYYMMDD-HHMM.dump"
```

Conferir tabelas principais:
- `Mensalidade`
- `Student`
- `Course`
- `SchoolSettings`
- `admins`

## 4) Janela de deploy segura

Antes de publicar:
- avisar secretaria/professores de janela curta (preferir horario de menor uso)
- garantir que ninguem esta lancando pagamento durante o deploy
- deixar uma pessoa responsavel pela validacao funcional

## 5) Checklist pos-deploy (5-10 minutos)

Validar:
1. `GET /api/health`
2. `GET /api/health/db`
3. abrir modulo financeiro
4. consultar aluno com parcela paga e pendente
5. gerar/reimprimir recibo
6. confirmar que nenhum valor historico foi alterado indevidamente

Se qualquer validacao critica falhar, executar rollback imediatamente.

## 6) Rollback rapido da aplicacao (codigo)

### 6.1 Rollback por Git (recomendado)
```bash
git checkout pre-financeiro-YYYYMMDD-HHMM
npm ci
npm run build
npm start
```

No provedor (Hostinger/Render), redeploy desse commit/tag.

### 6.2 Rollback por branch
```bash
git checkout main
git reset --hard <commit-anterior-estavel>
```

> Evite usar `reset --hard` em producao sem confirmar com a equipe. Prefira deploy por tag.

## 7) Rollback de dados (somente se necessario)

Use apenas se houver corrupcao de dados financeiros apos deploy.

```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "backups/pre-financeiro-YYYYMMDD-HHMM.dump"
```

Depois:
- subir versao estavel da aplicacao (item 6)
- validar totais e amostras de mensalidades

## 8) Estrategia recomendada para suas melhorias

Para o seu caso (edicao/cancelamento de pagamentos + cards com relatorio):
- primeiro publicar somente estrutura de auditoria (sem habilitar botoes)
- depois habilitar botoes para um grupo pequeno (secretaria)
- por ultimo liberar para todos

Isso reduz risco de erro operacional e facilita rollback sem perda de dados.

## 9) Registro obrigatorio de mudancas

Para cada deploy financeiro, anote:
- data/hora
- responsavel
- commit/tag publicado
- nome do arquivo de backup
- resultado do teste de restauracao
- resultado do checklist pos-deploy

