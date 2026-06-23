// lib/lgpd/policy.ts — shared LGPD constants (safe for client + server; no
// server-only imports). The DPO identity and the sub-processor list are LEGAL/
// BUSINESS decisions — they are placeholders here until provided. See
// docs/LGPD/OPEN_DECISIONS.md. Bump PRIVACY_POLICY_VERSION whenever the policy
// text changes so consent records stay tied to the version a user accepted.

export const PRIVACY_POLICY_VERSION = "2026-06-23";

/** Encarregado/DPO (Art. 41). PLACEHOLDER — pending the legal/business decision. */
export const DPO = {
  name: "[A DEFINIR — nome do Encarregado/DPO]",
  email: "[a-definir]@placas360.com.br",
} as const;

/** Consent kinds we record. Today only the privacy-policy acknowledgement at
 *  sign-up; add marketing/other kinds here when those flows exist. */
export const CONSENT_PRIVACY_POLICY = "privacy_policy";
