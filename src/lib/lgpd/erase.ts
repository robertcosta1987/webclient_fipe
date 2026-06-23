// lib/lgpd/erase.ts — account erasure for the data-subject right (Art. 18 VI).
//
// Two-speed by design, to honour Art. 16 (records that must be kept for fiscal/
// legal reasons are anonymized, not destroyed):
//   • HARD DELETE — the user's operational data: saved vehicles (carros_ativos,
//     test_vehicles) and their consultation history (checktudo/infocar/kbb).
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
  deleted: { carros_ativos: number; test_vehicles: number; checktudo: number; infocar: number; kbb: number; consents: number };
  anonymized: { users: boolean; customers: boolean; api_request_logs: number };
};

export async function eraseAccount(userId: string): Promise<EraseSummary> {
  // 1) Hard-delete operational data owned by the user.
  const [carrosN, testN, ctN, icN, kbN, consN] = await Promise.all([
    carros.deleteAllByOwner(userId),
    testVehicles.deleteAllByOwner(userId),
    checktudo.deleteAllByOwner(userId),
    infocar.deleteAllByOwner(userId),
    kbb.deleteAllByOwner(userId),
    consents.deleteAllByUser(userId),
  ]);

  // 2) Anonymize records kept for fiscal/legal retention (Art. 16).
  const logsN = await apiLogs.anonymizeByUser(userId);
  await customers.anonymizeByUserId(userId);
  await users.anonymizeUser(userId); // last: invalidates login

  return {
    deleted: { carros_ativos: carrosN, test_vehicles: testN, checktudo: ctN, infocar: icN, kbb: kbN, consents: consN },
    anonymized: { users: true, customers: true, api_request_logs: logsN },
  };
}
