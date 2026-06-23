# Resultado da Conformidade LGPD — Placas360 / DadoCar (apps/webclient)

> **Status pós-remediação.** Documento de acompanhamento da varredura LGPD, agora
> refletindo as correções implementadas na branch `feat/lgpd-hardening`.
> **Data:** 2026-06-23 · **Escopo:** `apps/webclient` · **Stack:** Next.js 16
> (App Router, server actions) · Azure SQL (`mssql`) · sessões HMAC em cookie · Azure Blob (`$web`).
>
> Legenda: ✅ conforme · ⚠️ parcial/atenção · ❌ lacuna · ❓ decisão jurídica/negócio pendente.
> **Natureza:** trabalho de engenharia de conformidade — não é parecer jurídico. As decisões
> jurídicas estão consolidadas em `OPEN_DECISIONS.md` (não foram inventadas).

## Placar — antes ➜ agora

| # | Área | LGPD | Antes | Agora |
|---|---|---|---|---|
| 1 | Inventário e mapeamento (RoPA) | Art. 5/6/37 | ⚠️ | ✅ (`DATA_MAP.md`) |
| 2 | Minimização e sem PII em logs | Art. 6º III | ✅ | ✅ (+ regra ESLint) |
| 3 | Segurança — controle de acesso | Art. 46/47/49 | ✅ | ✅ |
| 3b | Senhas e sessões | Art. 46 | ✅ | ✅ |
| 4 | Segredos e configuração | Art. 46/49 | ✅ | ✅ (Key Vault recomendado — ❓ #9) |
| 5 | Direitos do titular | Art. 18 | ❌ | ✅ (export + exclusão/anonimização) |
| 6 | Retenção e expurgo | Art. 15/16 | ❌ | ✅ mecanismo · ❓ prazos (#2) |
| 7 | Transparência: política e consentimento | Art. 8/9 | ❌ | ✅ · ❓ DPO/sub-operadores (#1/#4) |
| 8 | Governança: DPO, incidentes, RoPA | Art. 37/41/48 | ⚠️ | ✅ · ❓ identidade do DPO (#1) |
| 9 | Transporte e validação de entrada | Art. 46/47 | ⚠️ | ✅ · ❓ imagens no Blob (#3) |

**Resumo:** 3 ❌ e 3 ⚠️ originais foram fechados em engenharia. As pendências
remanescentes são **decisões jurídicas/negócio** (ver `OPEN_DECISIONS.md`), não código.

---

## O que mudou, por item

### 1. Inventário / RoPA — ✅ (era ⚠️)
- Criado **`DATA_MAP.md`** (RoPA, Art. 37): campo → tabela → base legal → retenção → criptografia,
  cobrindo `users`, `customers`, `api_request_logs`, consultas (checktudo/infocar/kbb),
  `carros_ativos`, `test_vehicles`, `user_consents` e o Blob `$web`.

### 2. Minimização e logs sem PII — ✅ (mantido + reforço)
- Mantida a disciplina existente (apenas prefixo da chave de API é logado; sem corpo de payload).
- **Nova regra ESLint** (`eslint.config.mjs`, escopo `src/**`) bloqueia `console.*` que
  referencie identificadores/propriedades de PII (email, cpf, cnpj, telefone, senha, placa, ip…).

### 3 / 3b. Acesso, senhas e sessões — ✅
- Inalterado (fundações sólidas). Toda leitura/escrita continua escopada por `owner_id`/`subscription_id`;
  os novos endpoints/ações de titular usam `requireUserId()`.

### 4. Segredos — ✅
- Sem `.env` versionado; segredos via `process.env`. **Azure Key Vault + rotação** segue como
  recomendação (`OPEN_DECISIONS.md` #9). Chaves de API são armazenadas como **hash** (confirmado).

### 5. Direitos do titular (Art. 18) — ✅ (era ❌)
- **Exportação (acesso/portabilidade, II/V):** `GET /api/me/export` (JSON e CSV), escopo por
  `requireUserId()`; nunca inclui hash/sal de senha nem hash de chave de API.
- **Exclusão/anonimização (VI):** `DELETE /api/me` + ação `deleteMyAccount` (confirmação "EXCLUIR").
  Apaga dados operacionais (veículos e consultas) e **anonimiza** registros fiscais (Art. 16:
  `users`, `customers`, `api_request_logs`); encerra a sessão.
- **UI:** `/meus-dados` (Exportar / Excluir) + link no `TopBar`.
- **Código:** `src/lib/lgpd/{export,erase,csv}.ts`; helpers de banco escopados por dono.
- **Testes:** `csv` (puro) + guardas DB-free (export sem segredos; deletes/anonimizações escopados).

### 6. Retenção e expurgo (Art. 15/16) — ✅ mecanismo · ❓ prazos
- **Política como dado:** `src/lib/lgpd/retention.ts` (janelas **PROVISÓRIO**, sobrescrevíveis por
  env `LGPD_RETENTION_*_DAYS`) — tarefas parametrizadas em `@cutoff`, owner-agnósticas, idempotentes.
- **Job:** `scripts/lgpd-retention.ts` (cron/Function) — **DRY-RUN por padrão**; `--apply` executa;
  `--accounts` inclui anonimização de contas inativas (opt-in). Anonimiza PII de `api_request_logs`
  e exclui consultas antigas, preservando registros fiscais.
- **Pendente (❓ #2):** confirmação dos prazos por classe pelo jurídico.

### 7. Transparência: política + consentimento (Art. 8/9) — ✅
- **`/privacidade`** (pública via middleware): dados, finalidades e bases legais (Art. 7º),
  operadores, retenção, direitos e contato do DPO.
- **Consentimento** explícito e **desmarcado por padrão** no cadastro; ação `register` exige aceite e
  **registra versão + timestamp** (`user_consents`, migração `0021`).
- **Links:** rodapé global (Política + DPO) em todas as telas, inclusive login/cadastro.
- **Pendente (❓ #1/#4):** identidade do DPO e lista oficial de sub-operadores (placeholders marcados).

### 8. Governança (Art. 37/41/48) — ✅
- **DPO** publicado na `/privacidade` e no rodapé (placeholder até decisão).
- **`SECURITY_INCIDENT_RESPONSE.md`**: detecção → contenção → avaliação → comunicação (ANPD/titulares)
  → erradicação → pós-incidente, com checklist e prazos.
- **RoPA:** `DATA_MAP.md` (item 1).

### 9. Transporte e validação (Art. 46/47) — ✅
- **Whitelist de colunas:** `src/lib/db/identifiers.ts` (`assertIdent`/`safeColumns`) aplicada a todas
  as listas de coluna interpoladas (`carros`, `checktudo`, `infocar`, `kbb`, `testVehicles`) e a
  `sets`/`scope` dinâmicos. **Nenhum valor de usuário é interpolado em SQL** (valores via `.input()`).
  Teste unitário em `identifiers.test.ts`.
- **Validação de entrada (zod):** `src/lib/validation/schemas.ts` aplicada às ações que gravam dado
  pessoal (`insertCarro`/`updateCarro`, `saveVehicle`, provisioning); cadastro já validava.
- **Headers de segurança** (`next.config.ts`): HSTS, X-Content-Type-Options=nosniff, Referrer-Policy,
  X-Frame-Options=DENY, Permissions-Policy e CSP base.
- **Pendente (❓ #3):** imagens no Blob `$web` (público) podem conter placa — avaliar privado + URL assinada.

---

## Decisões residuais (❓) — ver `OPEN_DECISIONS.md`
1. Identidade + contato do Encarregado/DPO.
2. Prazos de retenção por classe (logs, consultas, contas inativas) vs. mínimos fiscais.
3. Imagens de anúncio no Blob público: contêm dado pessoal? Base legal? Migrar p/ privado+assinado?
4. Lista oficial de operadores/sub-operadores + contratos.
5. Quais tratamentos dependem de consentimento (ex.: marketing).
6. Ativar anonimização automática de contas inativas (tarefa opt-in) e a partir de quantos dias.
7. Idade mínima / menores (Art. 14) — necessidade de age gate.
8. Revisão jurídica do texto final da política.
9. Azure Key Vault + rotação de segredos.

## Como verificar (gates da homologação)
- `next build`, `npx tsc --noEmit`, `npx eslint` — **verdes**.
- `npm test` — **31 testes verdes** (csv, escopo de direitos, retenção, identificadores).
- `npm run lgpd:retention` — **dry-run** (somente leitura) lista o que seria expurgado.

> Trabalho em branch `feat/lgpd-hardening`. **Produção não alterada; sem deploy.**
