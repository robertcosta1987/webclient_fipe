# Decisões em aberto — LGPD (Placas360 / DadoCar)

> Itens que dependem de decisão **jurídica/negócio** (não de engenharia). O código
> usa placeholders claramente marcados (`[A DEFINIR]`) e padrões **PROVISÓRIO**;
> ao confirmar, atualizar o local indicado e este arquivo. Engenharia não inventa
> estes valores.

| # | Decisão | Onde aplicar ao confirmar | Status |
|---|---|---|---|
| 1 | **Encarregado/DPO**: nome + e-mail de contato (Art. 41) | `src/lib/lgpd/policy.ts` (`DPO`) → reflete na página `/privacidade` e no rodapé | ❓ pendente |
| 2 | **Prazos de retenção** por classe de dado (Art. 15/16) vs. mínimos fiscais/legais: logs com placa+IP, consultas, contas inativas | `src/lib/lgpd/retention.ts` (`DEFAULT_RETENTION`) ou env `LGPD_RETENTION_*_DAYS` | ❓ PROVISÓRIO (365/365/730 dias) |
| 3 | **Imagens de anúncio** no Blob `$web` (público): podem conter dado pessoal (ex.: placa visível)? Qual a base legal para publicar? Se sensível, migrar para privado + URL assinada | `src/lib/storage/blob.ts` | ❓ pendente (ver M5/4) |
| 4 | **Lista oficial de operadores/sub-operadores** + contratos (Azure, FIPE/KBB/Infocar/CheckTudo, e-mail, etc.) — Art. 9º / 18 VII | `/privacidade` (seção 4) e `DATA_MAP.md` (seção 8) | ❓ pendente |
| 5 | **Quais tratamentos dependem de consentimento** vs. contrato/legítimo interesse (ex.: marketing). Hoje registramos apenas o aceite da Política no cadastro | ações/telas relevantes + `src/lib/lgpd/policy.ts` (`CONSENT_*`) | ❓ pendente |
| 6 | **Anonimização automática de contas inativas**: ativar a tarefa opt-in do job de retenção? A partir de quantos dias? | `scripts/lgpd-retention.ts --accounts` + `inactiveAccountDays` | ❓ pendente (opt-in, desativado por padrão) |
| 7 | **Idade mínima / menores** (Art. 14): o cadastro pressupõe pessoa jurídica/maior de 18? Há necessidade de age gate? | cadastro (`/register`) | ❓ pendente |
| 8 | **Texto jurídico final** da Política de Privacidade (revisão do jurídico) e versionamento | `src/app/privacidade/page.tsx` + `PRIVACY_POLICY_VERSION` | ❓ rascunho de engenharia |
| 9 | **Azure Key Vault + rotação** para `AUTH_SECRET`, `DATABASE_URL`, chaves de função/API (Art. 46) | infraestrutura/deploy | ❓ recomendado (ver M5/6) |

## Como confirmar
1. Jurídico/negócio preenche o valor.
2. Engenharia troca o placeholder no arquivo indicado (sem inventar).
3. Marcar o item como ✅ aqui, com data.
