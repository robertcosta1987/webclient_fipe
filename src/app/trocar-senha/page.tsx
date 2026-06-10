import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { TrocarSenhaForm } from "./TrocarSenhaForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Definir nova senha · Placas360" };

export default async function TrocarSenhaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <TrocarSenhaForm email={session.email} />;
}
