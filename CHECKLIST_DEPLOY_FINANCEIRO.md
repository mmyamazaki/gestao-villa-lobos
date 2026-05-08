# Checklist de Deploy Financeiro

Preencha este checklist antes de cada publicacao no financeiro.

## A. Pre-deploy (obrigatorio)

- [ ] Tag de retorno criada (`pre-financeiro-YYYYMMDD-HHMM`)
- [ ] Commit/hash atual anotado
- [ ] Backup SQL gerado e validado
- [ ] Backup DUMP gerado e validado
- [ ] Teste de restauracao realizado em homologacao
- [ ] Janela de deploy definida (baixo uso)
- [ ] Responsavel por validar financeiro definido

## B. Deploy

- [ ] Build concluido sem erro (`npm run build`)
- [ ] Aplicacao iniciada sem erro (`npm start`)
- [ ] `/api/health` OK
- [ ] `/api/health/db` OK

## C. Pos-deploy (obrigatorio)

- [ ] Consulta de aluno no financeiro funcionando
- [ ] Parcela pendente exibida corretamente
- [ ] Parcela paga exibida corretamente
- [ ] Reimpressao de recibo funcionando
- [ ] Totais de aberto/atraso/a vencer conferidos
- [ ] Sem erros criticos no console/logs de API

## D. Critico: acionar rollback se algum item falhar

- [ ] Rollback de codigo executado para tag `pre-financeiro-*`
- [ ] (Se necessario) rollback de dados com dump validado
- [ ] Verificacao final apos rollback concluida

