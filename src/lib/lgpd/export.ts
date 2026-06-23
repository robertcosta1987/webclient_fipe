// lib/lgpd/export.ts — assemble the authenticated user's OWN data for the
// access/portability right (Art. 18 II/V). Every query is scoped by the caller's
// id (owner_id / user_id); no cross-user data is ever read. Secrets (password
// hash/salt, API-key hash) are excluded at the query layer (users.getExportById).

import "server-only";
import * as carros from "@/lib/db/carros";
import * as customers from "@/lib/db/customers";
import * as users from "@/lib/db/users";
import * as testVehicles from "@/lib/db/testVehicles";
import * as checktudo from "@/lib/db/checktudoConsultas";
import * as infocar from "@/lib/db/infocarConsultas";
import * as kbb from "@/lib/db/kbbConsultas";
import * as apiLogs from "@/lib/db/apiRequestLogs";
import { getSubPlan } from "@/lib/db/subscriptions";

export type UserDataExport = {
  exported_at: string;
  data_subject_id: string;
  account: Awaited<ReturnType<typeof users.getExportById>>;
  customer: Awaited<ReturnType<typeof customers.getByUserId>>;
  subscription_plan: Awaited<ReturnType<typeof getSubPlan>>;
  vehicles_carros_ativos: Awaited<ReturnType<typeof carros.list>>;
  vehicles_teste: Record<string, unknown>[];
  consultas_checktudo: Awaited<ReturnType<typeof checktudo.listRecent>>;
  consultas_infocar: Awaited<ReturnType<typeof infocar.listRecent>>;
  consultas_kbb: Awaited<ReturnType<typeof kbb.listRecent>>;
  api_request_logs: Record<string, unknown>[];
};

/** Collect everything tied to `userId`. The id comes from `requireUserId()` at
 *  the call site — never from request input — so this can only ever return the
 *  caller's own records. */
export async function collectUserData(userId: string): Promise<UserDataExport> {
  const [account, customer, plan, carrosRows, testeRows, ct, ic, kb, logs] = await Promise.all([
    users.getExportById(userId),
    customers.getByUserId(userId),
    getSubPlan(userId),
    carros.list(userId, 10_000),
    testVehicles.listByOwner(userId),
    checktudo.listRecent(userId, 10_000),
    infocar.listRecent(userId, 10_000),
    kbb.listRecent(userId, 10_000),
    apiLogs.listByUser(userId),
  ]);
  return {
    exported_at: new Date().toISOString(),
    data_subject_id: userId,
    account,
    customer,
    subscription_plan: plan,
    vehicles_carros_ativos: carrosRows,
    vehicles_teste: testeRows,
    consultas_checktudo: ct,
    consultas_infocar: ic,
    consultas_kbb: kb,
    api_request_logs: logs,
  };
}
