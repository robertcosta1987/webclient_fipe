# Dadocar API — Customer Quickstart (Closed Beta)

This page is what you hand the customer. The webclient app at
[webclient-fipe.vercel.app](https://webclient-fipe.vercel.app/) is one
example consumer; the same API works from any HTTP client.

## Endpoint

```
GET https://dadocar-dev-apim-brs.azure-api.net/v1/vehicle/plate/{placa}
```

- `{placa}` — Brazilian licence plate, normalised: 7 characters, uppercase, **no hyphen**, no spaces. Both pre-Mercosul (`ABC1234`) and Mercosul (`ABC1D23`) accepted.

## Authentication

Send the subscription key on **every** request:

```
Ocp-Apim-Subscription-Key: <your-key>
```

Without the key → `401`. With a wrong key → `401`.

## Test it

```bash
curl -H "Ocp-Apim-Subscription-Key: <your-key>" \
  https://dadocar-dev-apim-brs.azure-api.net/v1/vehicle/plate/QOV3D42
```

Expected: `200` with a JSON body like

```jsonc
{
  "query":   { "kind": "plate", "value": "QOV3D42" },
  "cached":  true,
  "cached_at": "2026-05-13T18:01:31.758Z",
  "sources": [
    {
      "id":   "infocar",
      "ok":   true,
      "data": {
        "dados": {
          "dadosDoVeiculo": { "placa": "...", "chassi": "...", "modelo": "RENAULT/CAPTUR ZEN", "anoFabricacao": 2018, "anoModelo": 2019, "cor": "BRANCA", "..." : "..." },
          "fipes":          [{ "codigoFipe": "025261-1", "descricao": "Renault CAPTUR Zen 1.6 16V Flex 5p Aut.", "valor": "70,851.00" }]
        }
      },
      "latency_ms": 18
    }
  ]
}
```

`cached: true` means the response came from the platform's plate-cache (TTL 30 days). `cached: false` means it was fetched live from the vendor on this request.

## Soft limits (closed beta)

- **180 calls/min per subscription** (soft — see below).
- **~10,000 calls/month per subscription** (soft).

Both are **monitored, not hard-enforced**, on the current APIM Consumption tier. We'll see usage in Log Analytics and reach out before raising/contesting limits. If you expect a burst beyond these, ping us *before* — easier to adjust the tier than to recover from a throttled batch.

## Error codes

| Code | Meaning | Action |
|---|---|---|
| 200 | Success | Use the `sources[0].data` body. Even `sources[0].ok = false` can return 200 if at least one source attempted — check `ok` per source. |
| 401 | Missing or bad subscription key | Confirm the `Ocp-Apim-Subscription-Key` header value. |
| 404 | Plate not found / unsupported route | Confirm the plate format. |
| 429 | Throttled (not enforced today, but reserved for future) | Back off and retry. |
| 5xx | Upstream vendor failure or platform incident | Retry with exponential backoff (max 3 attempts). |

## What this URL is NOT

- **Not** the legacy direct Function App route (`*.azurewebsites.net`). That URL still exists for emergency fallback but will be rotated once APIM is the only path in production.
- **Not** rate-limited per IP. The subscription key is the boundary.
- **Not** SLA-backed (yet). Closed beta = alpha. No SLA, no uptime guarantee. We'll publish one when the production environment lands ([next-steps/014](../../docs/decisions/next-steps/014-production-environment.md)).

## What we measure (and why it matters for billing)

Every call is logged to `ApiManagementGatewayLogs` in the
`dadocar-dev-log-brs` Log Analytics workspace, tagged with the
subscription id. The operator-side query is in
[docs/IaaS.MD §2.7](../../docs/IaaS.MD#27-observability--log-access).

Per-customer usage breakdown (KQL):

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(1d)
| where ApiId == "dadocar-vehicle-api"
| summarize calls = count(),
            p50_ms = percentile(TotalTime, 50),
            p95_ms = percentile(TotalTime, 95),
            errors = countif(ResponseCode >= 400)
            by SubscriptionId, OperationId
```

When [next-steps/003](../../docs/decisions/next-steps/003-stripe-and-provisioning.md) (Stripe + provisioning) lands, this same `SubscriptionId` becomes the join key for the monthly invoice.

## Subscription management

Current customers (manual):

| Subscription id | Display name | Issued |
|---|---|---|
| `moneycar-tenanta-beta` | Moneycar (TenantA) — closed beta | 2026-05-14 |

To revoke: `az apim subscription delete -g rg-dadocar-dev-brs -n moneycar-tenanta-beta --service-name dadocar-dev-apim-brs --yes`.

To rotate the key: see the regenerate snippet in
[apps/webclient/README.md](README.md) (you'll get a new primary key,
update the customer + the Vercel env vars).
