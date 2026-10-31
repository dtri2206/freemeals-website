import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "@/components/LoginForm";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <>
      <header className="bg-[var(--color-primary)] text-white px-4 py-6 text-center">
        <div className="max-w-[420px] mx-auto">
          <h1 className="text-2xl font-bold leading-tight">Dashboard Quán</h1>
          <p className="mt-1 text-white/90">Chương trình Mì Sài Gòn 0đ</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[420px] mx-auto px-4 py-6">
        <LoginForm />
      </main>

      <footer className="text-center px-4 py-4 text-sm text-[var(--color-text-muted)]">
        Chương trình từ thiện Mì Sài Gòn 0đ &copy; 2026
      </footer>
    </>
  );
}
