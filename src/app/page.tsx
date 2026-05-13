import { redirect } from "next/navigation";

// Root redirects to Carros Ativos — the default view for the operator.
export default function RootPage() {
  redirect("/carros-ativos");
}
