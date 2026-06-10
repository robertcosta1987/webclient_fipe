// apim.ts — create a subscription in Azure API Management from the app.
//
// Uses an Azure AD service principal (client-credentials) to get an ARM token,
// then PUTs an APIM subscription scoped to all APIs. Fully gated on env vars:
// if any are missing it returns {created:false, reason} so provisioning still
// succeeds app-side and the admin sees the APIM status.
//
// Required env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
//   APIM_SUBSCRIPTION_ID (Azure sub guid), APIM_RESOURCE_GROUP, APIM_SERVICE_NAME.

import "server-only";

export type ApimResult = { created: boolean; reason?: string };

function cfg() {
  return {
    tenant: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
    azSub: process.env.APIM_SUBSCRIPTION_ID,
    rg: process.env.APIM_RESOURCE_GROUP,
    svc: process.env.APIM_SERVICE_NAME,
  };
}

async function armToken(tenant: string, clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "https://management.azure.com/.default",
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

/** Create (or upsert) an APIM subscription scoped to all APIs.
 *  `id` becomes the APIM subscription resource name (lowercase, hyphenated). */
export async function createApimSubscription(input: { id: string; displayName: string }): Promise<ApimResult> {
  const c = cfg();
  if (!c.azSub || !c.rg || !c.svc) return { created: false, reason: "APIM não configurado (APIM_* ausentes)." };
  if (!c.tenant || !c.clientId || !c.clientSecret) return { created: false, reason: "Sem credenciais Azure (AZURE_* ausentes)." };

  const token = await armToken(c.tenant, c.clientId, c.clientSecret);
  if (!token) return { created: false, reason: "Falha ao autenticar no Azure (client credentials)." };

  const base = `https://management.azure.com/subscriptions/${c.azSub}/resourceGroups/${c.rg}/providers/Microsoft.ApiManagement/service/${c.svc}`;
  const id = input.id.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  try {
    const res = await fetch(`${base}/subscriptions/${encodeURIComponent(id)}?api-version=2022-08-01`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ properties: { displayName: input.displayName, scope: `${base}/apis`, state: "active" } }),
      cache: "no-store",
    });
    if (res.ok) return { created: true };
    let msg = "";
    try { msg = ((await res.json()) as { error?: { message?: string } })?.error?.message ?? ""; } catch { /* ignore */ }
    return { created: false, reason: `APIM HTTP ${res.status}${msg ? `: ${msg}` : ""}` };
  } catch (e) {
    return { created: false, reason: `Falha ao criar no APIM: ${(e as Error).message}` };
  }
}
