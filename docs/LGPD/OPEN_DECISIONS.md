# Decisões — LGPD (Placas360 / DadoCar)

> Itens que dependem de decisão **jurídica/negócio**. Engenharia não inventa estes
> valores. Itens ✅ foram decididos e já aplicados no código/docs; ❓ seguem pendentes.
> Última atualização: 2026-06-23.

| # | Decisão | Onde aplicado | Status |
|---|---|---|---|
| 1 | **Encarregado/DPO**: `vaner@rubix360.com.br`, `robert@rubix360.com.br`, `gil@rubix360.com.br` | `src/lib/lgpd/policy.ts` (`DPO`/`DPO_CONTACTS`) → `/privacidade` (seção 8) + rodapé | ✅ decidido (2026-06-23) |
| 2 | **Prazos de retenção**: logs e consultas = **1 ano**; contas inativas = **2 anos** | `src/lib/lgpd/retention.ts` + `services/deidentification-job` (env-override) | ✅ decidido (2026-06-23) |
| 3 | **Imagens no Blob `$web`**: **manter público** — fotos de anúncio destinam-se à divulgação (base: execução de contrato / legítimo interesse do anunciante); placa visível aceitável | `src/lib/storage/blob.ts` + `/privacidade` | ✅ decidido (2026-06-23) |
| 4 | **Operadores/sub-operadores**: Microsoft Azure (hospedagem, banco, blob, APIM); provedores de dados veiculares/preço (FIPE/Moneycar/Profitcar, KBB/Molicar, Infocar, CheckTudo) | `/privacidade` (seção 4) + `DATA_MAP.md` (seção 8) | ✅ lista definida — *formalizar contratos de operador é ação jurídica em curso* |
| 5 | **Tratamentos por consentimento**: hoje apenas o **aceite da Política** no cadastro; demais tratamentos por contrato/legítimo interesse. Sem fluxo de marketing | cadastro + `policy.ts` | ✅ definido (revisar se surgir marketing) |
| 6 | **Anonimização de contas inativas**: ativar a **2 anos** via job agendado (opt-in `RETENTION_INCLUDE_ACCOUNTS=1`), após validação em dry-run | `services/deidentification-job` | ✅ decidido (habilitar `RETENTION_APPLY=1` no deploy após conferir dry-run) |
| 7 | **Idade mínima / menores** (Art. 14): público é B2B (concessionárias). Necessidade de age gate? | cadastro (`/register`) | ❓ pendente (confirmar não-aplicabilidade) |
| 8 | **Revisão jurídica** do texto final da Política de Privacidade + versionamento | `src/app/privacidade/page.tsx` + `PRIVACY_POLICY_VERSION` | ❓ pendente (jurídico) |
| 9 | **Azure Key Vault + rotação** para `AUTH_SECRET`, `DATABASE_URL`, chaves de função/API | infraestrutura/deploy | ❓ recomendado (infra) |

## Aplicado nesta rodada (2026-06-23)
- Migração `0021_user_consents` aplicada na **homologação** (`dadocar-dev-sql-webclient-dv02-brs` / `carros_ativos_db`) — tabela criada, 0 linhas.
- DPO, prazos de retenção, decisão do Blob e lista de operadores preenchidos no código e na `/privacidade`.
- Job de retenção agendado (Azure Function timer diário) em `services/deidentification-job` — **DRY-RUN por padrão**, pronto para deploy.

## Como confirmar os ❓ restantes
1. Negócio/jurídico decide o valor (itens 7–9).
2. Engenharia aplica no arquivo indicado (sem inventar).
3. Marca o item como ✅ aqui, com data.
