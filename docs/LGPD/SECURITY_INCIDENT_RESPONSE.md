# Plano de Resposta a Incidentes de Segurança — Placas360 / DadoCar

> Runbook de governança LGPD (Art. 48 — comunicação de incidente; Art. 46/50 —
> segurança e boas práticas). Define como detectar, avaliar, conter, comunicar e
> registrar um incidente que possa acarretar risco aos titulares.
>
> **Encarregado (DPO):** [A DEFINIR — ver `OPEN_DECISIONS.md` #1].
> **RoPA:** `DATA_MAP.md`. **Decisões pendentes:** `OPEN_DECISIONS.md`.

## 1. Papéis
- **Detector:** quem identifica o evento (engenharia, suporte, alerta automático, terceiro).
- **Coordenador do incidente:** engenharia responsável de plantão.
- **Encarregado/DPO:** decide sobre comunicação à ANPD e aos titulares.
- **Direção:** aprova comunicações externas.

## 2. Fluxo

### 2.1 Detecção e registro (imediato)
- Fontes: alertas da aplicação/infra, `api_request_logs` (trilha de auditoria),
  relatos de usuários, avisos de provedores (Azure, provedores de dados).
- Abrir um registro do incidente (data/hora UTC, quem detectou, sintoma). **Não**
  copiar dados pessoais para o registro — referenciar por identificadores.

### 2.2 Contenção (até 24h)
- Conter o vetor: revogar credenciais/sessões/chaves de API comprometidas
  (`anonymizeUser`/revogação de chave), bloquear acesso, isolar o recurso.
- Rotacionar segredos afetados (`AUTH_SECRET`, `DATABASE_URL`, chaves de função/API).
- Preservar evidências (logs) antes de qualquer limpeza.

### 2.3 Avaliação de risco (até 48–72h)
Determinar, com o DPO:
- **Quais dados** foram expostos (categorias do `DATA_MAP.md`) e **quantos titulares**.
- **Probabilidade e gravidade** do risco aos titulares (ex.: dados de contato vs.
  credenciais; lembrar que senhas estão em hash+sal e chaves de API em hash).
- Se há **risco relevante** que exija comunicação (Art. 48).

### 2.4 Comunicação (prazo razoável — alinhar ao entendimento vigente da ANPD)
- **À ANPD:** se houver risco relevante, comunicar em **prazo razoável** (a
  orientação atual da ANPD aponta ~3 dias úteis; confirmar com o jurídico no
  momento). Conteúdo mínimo: natureza, categorias e nº de titulares, medidas
  técnicas, riscos e medidas de mitigação.
- **Aos titulares afetados:** comunicar quando houver risco/dano relevante, em
  linguagem clara, com riscos e medidas que podem tomar.
- **Canais externos:** somente após aprovação da Direção + DPO.

### 2.5 Erradicação e recuperação
- Corrigir a causa-raiz; validar com `next build` + `tsc` + `eslint` + testes.
- Restaurar serviço; monitorar reincidência.

### 2.6 Pós-incidente (até 2 semanas)
- Post-mortem sem culpabilização; lições e ações preventivas.
- Atualizar este runbook, o `DATA_MAP.md` e controles afetados.

## 3. Checklist rápido
- [ ] Incidente registrado (sem PII no registro)
- [ ] Vetor contido; credenciais/segredos rotacionados
- [ ] Escopo avaliado (dados, titulares, risco) com o DPO
- [ ] Decisão de comunicação (ANPD / titulares) tomada e datada
- [ ] Causa-raiz corrigida e validada (gates verdes)
- [ ] Post-mortem e atualização de documentos

## 4. Contatos
- DPO/Encarregado: **[A DEFINIR]** (`OPEN_DECISIONS.md` #1)
- Engenharia de plantão: **[A DEFINIR]**
- Provedor de nuvem (suporte de segurança Azure): conforme contrato

> Documento de governança de engenharia; não substitui parecer jurídico. Validar
> prazos e gatilhos de comunicação com o jurídico/DPO.
