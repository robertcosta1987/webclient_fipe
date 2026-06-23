// lib/lgpd/policy.ts — shared LGPD constants (safe for client + server; no
// server-only imports). Bump PRIVACY_POLICY_VERSION whenever the policy text
// changes so consent records stay tied to the version a user accepted.

export const PRIVACY_POLICY_VERSION = "2026-06-23";

/** Encarregado/DPO (Art. 41) — definido pelo negócio (OPEN_DECISIONS #1). */
export const DPO = {
  name: "Encarregado de Dados (DPO)",
  email: "vaner@rubix360.com.br",
} as const;

/** Todos os contatos do Encarregado, publicados na política. */
export const DPO_CONTACTS = [
  "vaner@rubix360.com.br",
  "robert@rubix360.com.br",
  "gil@rubix360.com.br",
] as const;

/** Consent kinds we record. Today only the privacy-policy acknowledgement at
 *  sign-up; add marketing/other kinds here when those flows exist. */
export const CONSENT_PRIVACY_POLICY = "privacy_policy";
