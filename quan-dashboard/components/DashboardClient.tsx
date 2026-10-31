"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TrackingPanel from "@/components/TrackingPanel";
import ReportPanel from "@/components/ReportPanel";

type Tab = "tracking" | "report";

export default function DashboardClient({
  name,
  isAdmin,
}: {
  code: string;
  name: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tracking");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <>
      <header className="no-print bg-[var(--color-primary)] text-white px-4 py-5">
        <div className="max-w-[720px] mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/80">
              {isAdmin ? "Quản trị" : "Quán"}
            </p>
            <h1 className="text-xl font-bold leading-tight">{name}</h1>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm font-semibold px-3 py-2 rounded-lg border border-white/50 active:bg-white/10"
          >
            {loggingOut ? "..." : "Đăng xuất"}
          </button>
        </div>
      </header>

      <nav className="no-print bg-white border-b border-[var(--color-border)]">
        <div className="max-w-[720px] mx-auto flex">
          <button
            onClick={() => setTab("tracking")}
            className={`flex-1 py-3 font-semibold text-center border-b-2 ${
              tab === "tracking"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)]"
            }`}
          >
            Theo dõi 24h
          </button>
          <button
            onClick={() => setTab("report")}
            className={`flex-1 py-3 font-semibold text-center border-b-2 ${
              tab === "report"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)]"
            }`}
          >
            Xuất báo cáo
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-[720px] mx-auto px-4 py-5">
        {tab === "tracking" ? (
          <TrackingPanel isAdmin={isAdmin} />
        ) : (
          <ReportPanel locationName={name} isAdmin={isAdmin} />
        )}
      </main>
    </>
  );
}
