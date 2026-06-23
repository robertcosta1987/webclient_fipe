"use server";

// actions/account.ts — data-subject self-service (Art. 18). The export is served
// by GET /api/me/export; deletion runs here so the UI can confirm + redirect.

import { redirect } from "next/navigation";
import { requireUserId, destroySession } from "@/lib/auth/server";
import { eraseAccount } from "@/lib/lgpd/erase";

export type AccountResult = { error: string } | undefined;

const CONFIRM_WORD = "EXCLUIR";

/** Erase/anonymize the caller's own account (Art. 18 VI), then end the session.
 *  Requires the user to type the confirmation word, to avoid accidental loss. */
export async function deleteMyAccount(formData: FormData): Promise<AccountResult> {
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirm !== CONFIRM_WORD) {
    return { error: `Digite ${CONFIRM_WORD} para confirmar a exclusão.` };
  }
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { error: "Sessão expirada. Entre novamente." };
  }
  try {
    await eraseAccount(userId);
    await destroySession();
  } catch {
    return { error: "Não foi possível excluir a conta. Tente novamente." };
  }
  redirect("/login?excluida=1");
}
