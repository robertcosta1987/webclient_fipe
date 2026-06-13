# Programmatic API — FIPE by plate

Developer reference for the metered public API exposed by this app. Customer-facing
guide (with a real key) is generated separately and **not committed** (it carries a
live key — see `.gitignore`). Architecture: platform IaaS §2.10 · decision
[0011](../../../docs/decisions/0011-programmatic-fipe-api.md).

## Endpoint

```
GET /api/v1/fipe/plate/{placa}
```

- Host (prod): `https://www.placas360.com.br`
- `src/app/api/v1/fipe/plate/[placa]/route.ts` · `runtime = "nodejs"` · `maxDuration = 60`
- Exempt from the auth-redirect middleware (`src/middleware.ts` skips `/api/v1/`); it does its own key auth.

## Auth

Per-customer API key (`p360_` + 40 hex), sent as:

```
Authorization: Bearer <key>      # or:  x-api-key: <key>
```

- Stored only as a **SHA-256 hash** on `users.api_key_hash` (+ `api_key_prefix`); plaintext shown once at issue.
- The key is bound to a `user` → `subscription`. Metering/charging happen on that subscription.
- **Access gate:** the caller's `subscriptions.api_access` must be `1`, else `403`. Only designated API customers are enabled; everyone else uses the web app.

## Response (200)

```json
{
  "ok": true,
  "placa": "ABC1D23",
  "source": "live",
  "consultaId": "…",
  "fipe": {
    "marca": "TOYOTA",
    "modelo": "CCROSS XRV HYBRID",
    "versao": "XRV 1.8 16v Híbrido Aut.",
    "anoModelo": "2024",
    "anoFabricacao": "2023",
    "chassi": "9BRKYAAG2R0667645",
    "numMotor": "2V66811",
    "combustivel": "GAS/AL/ELE",
    "corVeiculo": "PRETA",
    "tipoVeiculo": "UTILITARIO",
    "especieVeiculo": "MISTO",
    "nacional": "Nacional",
    "potencia": "122",
    "cilindradas": "1798",
    "eixos": "2",
    "capMaxTracao": "226",
    "capacidadePassageiro": "5",
    "caixaCambio": "7WA23F00947",
    "numCarroceria": null,
    "codigoFipe": "22004",
    "fipeId": "22004",
    "versaoFipe": "CROSS XRV 1.8 16V AUT. (HÍBRIDO)",
    "valorAtual": 161936,
    "historico": [{ "mes": 6, "ano": 2026, "valor": 161936 }]
  }
}
```

`valorAtual` is in **reais (integer)**; the technical fields (`potencia`, `cilindradas`, …) are strings as the vendor returns them. `source` is `live` (new consult) or `cache` (reused, not charged). **Any field may be `null`** when the vendor doesn't return it for a given plate. `versao` is the full trim; `versaoFipe` is the FIPE-table version.

## Errors

| HTTP | `error` cause |
|---|---|
| 401 | missing / invalid key |
| 403 | subscription not API-enabled (`api_access=0`) |
| 400 | invalid plate format (`ABC1234` / `ABC1D23`) |
| 402 | subscription plan limit reached |
| 404 | plate not found at the vendor |
| 502 | vendor/temporary failure |

Body: `{ "ok": false, "error": "…" }`.

## Metering & billing (querycode 202)

`lib/api/fipeConsult.ts`, reusing the UI metering:

1. **Cache** (`checktudo_consultas`, per-tenant) → hit recorded `source=cache`, **not charged**.
2. Else `reserveConsult` against the plan (402 if over cap) → live CheckTudo 202 → **refund on failure** → cache insert → `recordUsage(source=live)`.
3. **Only completed live consults are charged.** Visible in `/admin/uso-apis`. Price = `api_products('checktudo',202).unit_price_brl`.

## Audit log

Every call (incl. rejected) writes `api_request_logs` — ip, geo (country/city), user-agent, placa, `outcome` (`ok`/`error`/`auth_failed`), `source`, `charged`, error code, http status, duration, key prefix, consultaId. The write is **awaited before responding**.

## Issuing keys

```bash
# rotate/issue a key for an existing customer user
npx tsx scripts/issue-api-key.ts <email> [priceBRL]

# provision a new API-only customer end-to-end (ondemand, api_access=1) + key
npx tsx scripts/create-api-customer.ts "<Name>" <email> "<Company>" [priceBRL]
```

Or admin UI: **"Acesso por API"** on `/admin/assinaturas` (`actions/apiKeys.ts`). Re-issuing rotates.

## Schema (migrations 0016, 0017)

- `users.api_key_hash` / `api_key_prefix` / `api_key_created_at` (unique index on hash).
- `subscriptions.api_access` (BIT, default 0) — programmatic-access gate.
- `api_products('checktudo', 202)` — sellable FIPE product + price.
- `api_request_logs` — per-call audit log.
