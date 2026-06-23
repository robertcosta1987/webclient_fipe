import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { MeusDadosClient } from "./MeusDadosClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meus dados · Placas360" };

export default async function MeusDadosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <MeusDadosClient email={session.email} />;
}
