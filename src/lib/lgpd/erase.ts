// lib/lgpd/erase.ts — account erasure for the data-subject right (Art. 18 VI).
//
// Three-speed by design — Art. 16 (records kept for fiscal/legal reasons are
// anonymized, not destroyed) AND the data-enrichment MOAT (cached consults are
// never deleted):
//   • HARD DELETE — the user's own operational data: saved vehicles (carros_ativos,
//     test_vehicles) and their consents.
//   • DE-IDENTIFY — the consult caches (checktudo/infocar/kbb): the cached VEHICLE
//     data is the enrichment asset we sell, so it is KEPT; we only drop the personal
//     linkage (owner_id → NULL) and scrub owner PII from the payload.
//   • ANONYMIZE — records that anchor billing/audit: the users row (referenced by
//     the usage ledger), the customers CRM row, and api_request_logs (charge
//     reconciliation). Personal fields are stripped; the rows survive for the
//     fiscal retention window.
//
// Everything is owner-scoped by `userId` (from requireUserId()). The caller is
// responsible for destroying the session cookie afterwards.

import "server-only";
import * as carros from "@/lib/db/carros";
import * as customers from "@/lib/db/customers";
import * as users from "@/lib/db/users";
import * as testVehicles from "@/lib/db/testVehicles";
import * as checktudo from "@/lib/db/checktudoConsultas";
import * as infocar from "@/lib/db/infocarConsultas";
import * as kbb from "@/lib/db/kbbConsultas";
import * as apiLogs from "@/lib/db/apiRequestLogs";
import * as consents from "@/lib/db/consents";

export type EraseSummary = {
  deleted: { carros_ativos: number; test_vehicles: number; consents: number };
  deidentified: { checktudo: number; infocar: number; kbb: number };
  anonymized: { users: boolean; customers: boolean; api_request_logs: number };
};

export async function eraseAccount(userId: string): Promise<EraseSummary> {
  // 1) Hard-delete the user's OWN operational data (saved vehicles, consents).
  const [carrosN, testN, consN] = await Promise.all([
    carros.deleteAllByOwner(userId),
    testVehicles.deleteAllByOwner(userId),
    consents.deleteAllByUser(userId),
  ]);

  // 2) De-identify the consult caches (MOAT): keep the vehicle data, drop the
  //    personal linkage (owner_id) and scrub owner PII from the payload.
  const [ctN, icN, kbN] = await Promise.all([
    checktudo.deidentifyAllByOwner(userId),
    infocar.deidentifyAllByOwner(userId),
    kbb.deidentifyAllByOwner(userId),
  ]);

  // 3) Anonymize records kept for fiscal/legal retention (Art. 16).
  const logsN = await apiLogs.anonymizeByUser(userId);
  await customers.anonymizeByUserId(userId);
  await users.anonymizeUser(userId); // last: invalidates login

  return {
    deleted: { carros_ativos: carrosN, test_vehicles: testN, consents: consN },
    deidentified: { checktudo: ctN, infocar: icN, kbb: kbN },
    anonymized: { users: true, customers: true, api_request_logs: logsN },
  };
}
