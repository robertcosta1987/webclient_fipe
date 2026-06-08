import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Criar conta · Concessionária Demo" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const sp = await searchParams;
  return <RegisterForm inviteFromUrl={sp.invite} />;
}
