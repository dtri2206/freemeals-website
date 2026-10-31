import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return <DashboardClient code={session.code} name={session.name} isAdmin={session.isAdmin} />;
}
