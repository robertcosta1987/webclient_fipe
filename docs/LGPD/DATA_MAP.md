# Mapa de Dados / RoPA — Placas360 / DadoCar (apps/webclient)

> Registro das Operações de Tratamento (Art. 37) + inventário de dados pessoais
> (Art. 5/6). Mantido junto ao código; atualizar a cada migração que toque dados
> pessoais. Prazos marcados **PROVISÓRIO** dependem de decisão legal — ver
> `OPEN_DECISIONS.md`. Implementação dos prazos: `src/lib/lgpd/retention.ts`.
>
> **Criptografia em repouso:** Azure SQL Database (TDE habilitado por padrão) e
> Azure Blob (criptografia de serviço). **Em trânsito:** HTTPS/TLS.

## 1. `users` — contas de acesso
| Campo | Pessoal? | Base legal (Art. 7º) | Retenção |
|---|---|---|---|
| `email`, `name` | Sim | Execução de contrato (V) | Enquanto a conta existir; anonimizado na exclusão |
| `password_hash`, `password_salt` | Credencial | Execução de contrato (V) | Idem; nunca exportado |
| `api_key_hash`, `api_key_prefix` | Credencial | Execução de contrato (V) | Idem; hash, nunca em texto puro |
| `role`, `status`, `must_change_password`, `last_login_at`, `created_at` | Não/meta | Legítimo interesse (IX) | Idem |
| `subscription_id` | Vínculo | Execução de contrato (V) | Mantido p/ histórico de cobrança (Art. 16) |

## 2. `customers` — cadastro CRM
| Campo | Pessoal? | Base legal | Retenção |
|---|---|---|---|
| `name`, `company`, `cnpj`, `email`, `phone` | Sim | Execução de contrato (V) | Anonimizado na exclusão; mantido p/ fins fiscais (Art. 16) |
| `subscription_id`, `user_id`, `status`, `created_at` | Vínculo/meta | Execução de contrato (V) | Idem |

## 3. `api_request_logs` — auditoria da API programática
| Campo | Pessoal? | Base legal | Retenção |
|---|---|---|---|
| `placa`, `ip`, `user_agent`, `country`, `city` | Sim | Legítimo interesse (IX) — segurança/antifraude | **PROVISÓRIO: anonimizar após 365 dias** |
| `api_key_prefix` | Pseudônimo | Legítimo interesse (IX) | Mantido p/ conciliação |
| `subscription_id`, `user_id`, `product_code`, `outcome`, `charged`, `http_status`, `duration_ms`, `created_at` | Meta/cobrança | Obrigação legal (II) / contrato (V) | Mantido p/ fins fiscais (Art. 16) |

## 4. `checktudo_consultas` / `infocar_consultas` / `kbb_consultas` — consultas veiculares
| Campo | Pessoal? | Base legal | Retenção |
|---|---|---|---|
| `placa`, `chassi`, `payload` (dados do veículo) | Sim (vínculo a veículo/titular) | Execução de contrato (V) | **PROVISÓRIO: excluir após 365 dias** |
| `owner_id` | Vínculo | Execução de contrato (V) | Idem |
| sumário (`brand`, `model`, `model_year`, …), `consulted_at` | Meta | Execução de contrato (V) | Idem |

## 5. `carros_ativos` / `test_vehicles` — estoque e cadastro de veículos
| Campo | Pessoal? | Base legal | Retenção |
|---|---|---|---|
| `placa`, `chassi`, dados técnicos, `photos` (URLs) | Sim (vínculo a veículo) | Execução de contrato (V) | Enquanto a conta existir; excluído na exclusão de conta |
| `owner_id`, timestamps | Vínculo/meta | Execução de contrato (V) | Idem |

## 6. `user_consents` — comprovação de consentimento (mig 0021)
| Campo | Pessoal? | Base legal | Retenção |
|---|---|---|---|
| `user_id`, `kind`, `policy_version`, `granted`, `granted_at`, `ip` | Sim | Consentimento (I) / comprovação (Art. 8º §6) | Removido na exclusão da conta |

## 7. Armazenamento de mídia — Azure Blob `$web`
| Item | Pessoal? | Base legal | Observação |
|---|---|---|---|
| Imagens de anúncio (`cars/<uuid>/<n>.jpg`) | Possível (fotos do veículo; placa pode aparecer) | Execução de contrato (V) | Contêiner **público** por design. Ver decisão em `OPEN_DECISIONS.md` (item 3). |

## 8. Operadores / sub-operadores (Art. 9º / 18 VII)
**[A DEFINIR — lista oficial em `OPEN_DECISIONS.md`]**: provedor de nuvem (Azure),
provedores de dados veiculares/preço (FIPE/KBB/Infocar/CheckTudo), provedor de e-mail,
e demais terceiros que recebam dados. Cada um sob contrato de operador.

## Direitos do titular (Art. 18) — onde são exercidos
- **Acesso/portabilidade:** `GET /api/me/export` (JSON/CSV) e tela `/meus-dados`.
- **Exclusão/anonimização:** `DELETE /api/me` / ação `deleteMyAccount` (`/meus-dados`).
- **Implementação:** `src/lib/lgpd/export.ts`, `src/lib/lgpd/erase.ts`.
