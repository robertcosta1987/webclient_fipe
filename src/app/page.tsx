import { redirect } from "next/navigation";

// Root redirects to the default view (Tabela KBB).
export default function RootPage() {
  redirect("/precos");
}
