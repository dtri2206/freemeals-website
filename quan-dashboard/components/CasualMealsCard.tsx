"use client";

// TAM THOI (khuyen mai dang ky) -- bang suat an vang lai rieng, hien duoi
// cung danh sach Theo doi 24h. Xoa file nay + app/api/casual/route.ts + phan
// goi no trong TrackingPanel.tsx khi het dot khuyen mai.
import { useCallback, useEffect, useRef, useState } from "react";

type CasualRow = {
  full_name: string;
  phone: string | null;
  registered_at: string;
  location_name?: string | null;
};

const POLL_MS = 8000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function CasualMealsCard({
  onCountChange,
  isAdmin,
  locationFilter,
}: {
  onCountChange?: (count: number) => void;
  isAdmin?: boolean;
  locationFilter?: string;
}) {
  const [rows, setRows] = useState<CasualRow[] | null>(null);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const url =
        isAdmin && locationFilter
          ? `/api/casual?location=${encodeURIComponent(locationFilter)}`
          : "/api/casual";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.result === "success") {
        setRows(data.rows);
        onCountChange?.(data.rows.length);
      }
    } catch {
      // Lam ngang - khong chan hien thi phan suat an member neu loi.
    } finally {
      fetchingRef.current = false;
    }
  }, [onCountChange, isAdmin, locationFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] mt-4">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="font-bold">Suất ăn vãng lai — khách mới đăng ký</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Chương trình khuyến mãi đăng ký, {rows.length} suất hôm nay
        </p>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-semibold">{row.full_name}</div>
              {row.phone && (
                <div className="text-sm text-[var(--color-text-muted)]">{row.phone}</div>
              )}
              {isAdmin && row.location_name && (
                <div className="text-xs text-[var(--color-primary)] font-semibold mt-0.5">
                  {row.location_name}
                </div>
              )}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              {formatTime(row.registered_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
