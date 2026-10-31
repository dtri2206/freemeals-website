"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CasualMealsCard from "@/components/CasualMealsCard";

type MealLogRow = {
  id: number;
  member_code: string;
  member_name: string;
  portions: number;
  created_at: string;
  location_name?: string | null;
};

type TrackingState = {
  rows: MealLogRow[];
  totalPortions: number;
  totalVisits: number;
  serverTime: string;
};

type LocationOption = {
  code: string;
  name: string;
};

const POLL_MS = 8000;

function formatTime(iso: string) {
  // Ep cung gio VN -- khong dung gio mac dinh cua thiet bi nguoi xem, tranh
  // hien sai neu may ai do lo de sai mui gio.
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function TrackingPanel({ isAdmin }: { isAdmin: boolean }) {
  const [state, setState] = useState<TrackingState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  // TAM THOI (khuyen mai): so suat an vang lai, cong them vao 2 o thong ke ben
  // duoi -- bo state nay + <CasualMealsCard /> khi het dot khuyen mai.
  const [casualCount, setCasualCount] = useState(0);

  // Chi admin moi can danh sach quan de chon ("Tat ca quan" = selectedLocation
  // rong). Quan thuong khong goi /api/locations.
  const [locations, setLocations] = useState<LocationOption[] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/locations", { cache: "no-store" });
        const data = await res.json();
        if (data.result === "success") setLocations(data.locations);
      } catch {
        // Lam ngang - o chon quan don gian khong hien neu loi.
      }
    })();
  }, [isAdmin]);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const url =
        isAdmin && selectedLocation
          ? `/api/tracking?location=${encodeURIComponent(selectedLocation)}`
          : "/api/tracking";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.result === "success") {
        setState(data);
        setError("");
      } else {
        setError(data.message || "Không tải được dữ liệu.");
      }
    } catch {
      setError("Mất kết nối, đang thử lại...");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [isAdmin, selectedLocation]);

  useEffect(() => {
    // Poll ngay khi mount (hoac khi doi quan chon), roi lap lai moi POLL_MS --
    // refresh() tu guard bang fetchingRef nen khong bao gio chong request.
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div>
      {isAdmin && (
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1">Xem quán</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full px-3 py-2 border-2 border-[var(--color-border)] rounded-lg bg-white"
          >
            <option value="">Tất cả quán</option>
            {locations?.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--color-success)]" />
          </span>
          <h2 className="text-lg font-bold">Suất ăn trong 24 giờ gần nhất</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Tự động cập nhật mỗi {POLL_MS / 1000} giây
          {state && ` · cập nhật lúc ${formatTime(state.serverTime)}`}
        </p>

        {state && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-[var(--color-primary-light)] rounded-xl p-3 text-center">
              <div className="text-3xl font-extrabold text-[var(--color-primary)]">
                {state.totalVisits}
                {casualCount > 0 && <span className="text-xl"> + {casualCount}</span>}
              </div>
              <div className="text-xs font-semibold text-[var(--color-primary-dark)] uppercase">
                Lượt quẹt
              </div>
            </div>
            <div className="bg-[var(--color-primary-light)] rounded-xl p-3 text-center">
              <div className="text-3xl font-extrabold text-[var(--color-primary)]">
                {state.totalPortions}
                {casualCount > 0 && <span className="text-xl"> + {casualCount}</span>}
              </div>
              <div className="text-xs font-semibold text-[var(--color-primary-dark)] uppercase">
                Suất ăn
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[var(--color-error)] text-sm mb-3 text-center">{error}</p>
      )}

      {loading && !state ? (
        <p className="text-center text-[var(--color-text-muted)] py-8">Đang tải...</p>
      ) : state && state.rows.length === 0 ? (
        <p className="text-center text-[var(--color-text-muted)] py-8">
          Chưa có khách nào quẹt suất ăn trong 24 giờ qua.
        </p>
      ) : (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] divide-y divide-[var(--color-border)]">
          {state?.rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-semibold">{row.member_name}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{row.member_code}</div>
                {isAdmin && row.location_name && (
                  <div className="text-xs text-[var(--color-primary)] font-semibold mt-0.5">
                    {row.location_name}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-[var(--color-text-muted)]">
                  {formatTime(row.created_at)}
                </div>
                <div className="font-bold text-[var(--color-primary)]">
                  {row.portions} suất
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CasualMealsCard
        onCountChange={setCasualCount}
        isAdmin={isAdmin}
        locationFilter={selectedLocation}
      />
    </div>
  );
}
