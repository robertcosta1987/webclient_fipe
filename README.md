# apps/webclient — Dadocar customer-CRM simulator

This app is **not** the Dadocar platform. It is a **simulator of a customer's CRM** — what a dealership operator at Moneycar (TenantA) sees day-to-day. Its job is to exercise the cross-tenant call:

```
Customer CRM (this app)  →  Dadocar platform  →  Infocar
```

When the operator types a license plate and presses Enter, the CRM calls the Dadocar API and **every other field on the form autofills from the response**. That autofill is the whole point of the demo — it's what makes Dadocar valuable to a CRM customer.

Treat this app as throwaway-quality but realistic enough to demo end-to-end.

## Headline feature: plate-driven autofill

1. Open "+ Adicionar Veículo" in the top bar.
2. Type a Brazilian plate in the **Placa** field — either pre-Mercosul (`ABC1234`) or Mercosul (`ABC1D23`). No hyphen, no mask. Pasting `ABC-1D23` silently strips the hyphen.
3. Press **Enter** *only* on the placa field. Enter is the **sole** autofill trigger — not blur, not debounce, not every keystroke. Pressing Enter does **not** submit the form.
4. The placa field shows a spinner while in flight; on success every other field flashes amber as it's populated and focus jumps to **Chassi**. Every field stays editable — the operator can override anything before saving.
5. Edge cases handled:
   - **Invalid plate format** → inline error, no API call (so we don't burn a paid Infocar request).
   - **Vendor 404 / 5xx / timeout** → inline error, other fields preserved, "Tentar novamente" link.
   - **Re-trigger after manual edits** → confirmation banner: "Placa alterada. Substituir os outros campos…" (default: Manter).
   - **Duplicate placa in local DB** → non-blocking warning banner with a link to the existing row. Submit still errors on the UNIQUE constraint.
6. Submitting inserts into `carros_ativos` and navigates to **Carros Ativos** with the new row briefly highlighted.

## Other views

- `/carros-ativos` — table of every cadastrado car. Editar (inline) / Salvar / Excluir / Cancelar per row. **All four hit the DB directly; no platform call.** This is the operator's day-to-day book of business.
- `/buscar` — single search input + scope dropdown (placa, chassi, modelo, cor, município, UF, combustível, ano modelo, código FIPE, "qualquer campo"). LIMIT 50.

## How to run it

```bash
# from this directory (apps/webclient)
pnpm install
./scripts/provision-azure.sh        # one-time; reuses an existing server on re-runs
# paste the printed connection string into .env.local under DATABASE_URL
pnpm db:migrate
pnpm dev                             # http://localhost:3000
```

Stand-alone smoke test (talks to the live Dadocar platform + live Azure SQL):

```bash
pnpm exec tsx scripts/smoke.ts
```

### Env vars (.env.example)

| Var | What |
|---|---|
| `DATABASE_URL` | ADO.NET connection string to the Azure SQL DB. Server name in `dadocar-dev-sql-webclient-<rand4>-brs.database.windows.net`. |
| `DADOCAR_API_URL` | Base URL of the Dadocar Function App (`https://dadocar-dev-func-enrich-brs.azurewebsites.net`). |
| `DADOCAR_API_KEY` | Function key today. When [next-steps/001](../../docs/decisions/next-steps/001-apim-products-subscriptions.md) lands, switch to an APIM subscription key and rewire the header in [src/lib/platform/client.ts](src/lib/platform/client.ts) from `x-functions-key` to `Ocp-Apim-Subscription-Key`. |

## Azure resources this app provisions

In `rg-dadocar-dev-brs` (Brazil South), the same RG as the platform:

| Resource | Name | Tier |
|---|---|---|
| SQL Server | `dadocar-dev-sql-webclient-<rand4>-brs` | Standard, public endpoint, SQL auth. |
| SQL DB | `carros_ativos_db` | GP_S_Gen5_1 Serverless, min 0.5 vCore, **auto-pause after 60 min idle**, LRS backup. |

**Idle cost**: roughly **R$ 25–40 / month** (≈ US$ 5–8) — almost entirely storage; compute is paused most of the time.

**Cold-start tax**: the first request after the DB has been idle >1h takes 30–60 seconds to warm up. We bake that into the timeout in [src/lib/db/pool.ts](src/lib/db/pool.ts) and [scripts/migrate.ts](scripts/migrate.ts), so the only visible effect is the spinner running longer on the first autofill of the day.

### Tear down

```bash
az sql db     delete -g rg-dadocar-dev-brs -s dadocar-dev-sql-webclient-<sfx>-brs -n carros_ativos_db --yes
az sql server delete -g rg-dadocar-dev-brs -n dadocar-dev-sql-webclient-<sfx>-brs --yes
```

Do **not** `az group delete -n rg-dadocar-dev-brs` — that RG holds the whole platform.

## Architecture notes

- **Server Components by default.** Client Components only for interactive bits (`TopBar`, `AddCarModal`, `CarrosTable`, `BuscarClient`).
- **Server Actions** in [src/app/actions/carros.ts](src/app/actions/carros.ts). The platform API key never reaches the browser.
- **Platform integration** in [src/lib/platform/client.ts](src/lib/platform/client.ts). The Dadocar API returns a wrapped aggregator response; we flatten it (`sources[0].data.dados.dadosDoVeiculo` + `fipes[0]`) and Zod-validate so a payload-shape regression surfaces in one place, not in the UI.
- **DB layer** in [src/lib/db/carros.ts](src/lib/db/carros.ts) — `list`, `search`, `getByPlaca`, `getById`, `insertFromPayload`, `updateById`, `removeById`. UI / actions only call this.
- **Plate normalization** in [src/lib/placa/normalize.ts](src/lib/placa/normalize.ts) — single source of truth; strips whitespace + hyphens, uppercases, validates against both formats.
- **`valor_fipe` parsing** lives in [src/lib/platform/types.ts](src/lib/platform/types.ts) (`parseValorFipe`). Vendor sends `"70,851.00"` (comma = thousands, dot = decimal). Centralized so changing the parser is one line.

## What's out of scope (per the brief)

- Login, roles, multi-tenant logic.
- Pagination beyond `LIMIT 50`.
- Mobile.
- Managed Identity for the SQL connection (SQL auth + .env.local is fine for a demo).
- Tests beyond the smoke test.
