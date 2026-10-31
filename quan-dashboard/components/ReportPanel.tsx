"use client";

import { useState } from "react";

type ReportRow = {
  day: string;
  member_code: string;
  member_name: string;
  portions: number;
  check_in_times: string;
  location_name?: string | null;
};

function todayVN(): string {
  // en-CA formats as yyyy-mm-dd, đúng định dạng <input type="date"> cần.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function vnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "23/09/2026 11:05:12, 23/09/2026 18:40:03" -> "11:05, 18:40" */
function timesOnly(checkInTimes: string): string {
  return checkInTimes
    .split(", ")
    .map((t) => (t.split(" ")[1] || "").slice(0, 5))
    .filter(Boolean)
    .join(", ");
}

function csvField(value: string | number): string {
  const s = String(value);
  // Excel coi dấu phẩy/ngoặc kép/xuống dòng là ký tự đặc biệt trong CSV.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV với BOM UTF-8 ở đầu -- không có BOM thì Excel hiểu sai bảng mã và
 * hiển thị tiếng Việt thành ký tự lỗi. Mở trực tiếp bằng Excel được như
 * một bảng tính bình thường, không cần cài thêm thư viện tạo .xlsx thật
 * (bản .xlsx ngoài npm hiện có lỗ hổng bảo mật chưa được vá).
 */
function downloadReportCsv(
  rows: ReportRow[],
  locationName: string,
  from: string,
  to: string,
  isAdmin: boolean
) {
  const header = isAdmin
    ? ["Ngày", "Quán", "Tên khách", "Mã khách", "Số suất trong ngày", "Giờ quét"]
    : ["Ngày", "Tên khách", "Mã khách", "Số suất trong ngày", "Giờ quét"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      (isAdmin
        ? [vnDate(r.day), r.location_name ?? "", r.member_name, r.member_code, r.portions, timesOnly(r.check_in_times)]
        : [vnDate(r.day), r.member_name, r.member_code, r.portions, timesOnly(r.check_in_times)]
      )
        .map(csvField)
        .join(",")
    ),
    (isAdmin
      ? ["", "", "", "", "Tổng cộng", rows.reduce((sum, r) => sum + r.portions, 0)]
      : ["", "", "", "Tổng cộng", rows.reduce((sum, r) => sum + r.portions, 0)]
    )
      .map(csvField)
      .join(","),
  ];

  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bao cao ${locationName} ${from}_den_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function stampNow(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export default function ReportPanel({
  locationName,
  isAdmin,
}: {
  locationName: string;
  isAdmin: boolean;
}) {
  const today = todayVN();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [stamp, setStamp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setError("");
    setLoading(true);
    setRows(null);
    try {
      const res = await fetch(
        `/api/report?from=${from}&to=${to}&fromTime=${fromTime}&toTime=${toTime}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.result === "success") {
        setRows(data.rows);
        setStamp(stampNow());
      } else {
        setError(data.message || "Không tạo được báo cáo.");
      }
    } catch {
      setError("Không kết nối được, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const total = rows?.reduce((sum, r) => sum + r.portions, 0) ?? 0;

  return (
    <div>
      <div className="no-print bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] p-5 mb-4">
        <h2 className="text-lg font-bold mb-4">Xuất báo cáo theo ngày</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Từ ngày</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border-2 border-[var(--color-border)] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Đến ngày</label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border-2 border-[var(--color-border)] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Từ giờ</label>
            <input
              type="time"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              className="w-full px-3 py-2 border-2 border-[var(--color-border)] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Đến giờ</label>
            <input
              type="time"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className="w-full px-3 py-2 border-2 border-[var(--color-border)] rounded-lg"
            />
          </div>
        </div>

        {error && <p className="text-[var(--color-error)] text-sm mb-3">{error}</p>}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 font-bold rounded-xl text-white bg-[var(--color-primary)] active:bg-[var(--color-primary-dark)] disabled:bg-[#90A4AE]"
          >
            {loading ? "ĐANG TẠO..." : "TẠO BÁO CÁO"}
          </button>
          {rows && rows.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 font-bold rounded-xl border-2 border-[var(--color-primary)] text-[var(--color-primary)]"
              >
                In báo cáo
              </button>
              <button
                onClick={() => downloadReportCsv(rows, locationName, from, to, isAdmin)}
                className="flex-1 py-3 font-bold rounded-xl border-2 border-[var(--color-success)] text-[var(--color-success)]"
              >
                Xuất Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {rows && (
        <div className="print-area bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] p-5 overflow-x-auto">
          <h3 className="text-xl font-bold">Báo cáo suất ăn — {locationName}</h3>
          <p className="text-[var(--color-text-muted)] mb-4">
            Từ {fromTime} {vnDate(from)} đến {toTime} {vnDate(to)} · Xuất lúc {stamp}
          </p>

          {rows.length === 0 ? (
            <p className="text-center text-[var(--color-text-muted)] py-8">
              Không có suất ăn nào trong khoảng ngày này.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--color-primary-light)] text-left">
                  <th className="p-2 font-bold">Ngày</th>
                  {isAdmin && <th className="p-2 font-bold">Quán</th>}
                  <th className="p-2 font-bold">Tên khách</th>
                  <th className="p-2 font-bold">Mã khách</th>
                  <th className="p-2 font-bold text-right">Số suất</th>
                  <th className="p-2 font-bold">Giờ quét</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.day}-${r.member_code}-${i}`} className="border-b border-[var(--color-border)]">
                    <td className="p-2 whitespace-nowrap">{vnDate(r.day)}</td>
                    {isAdmin && <td className="p-2 whitespace-nowrap">{r.location_name ?? ""}</td>}
                    <td className="p-2">{r.member_name}</td>
                    <td className="p-2 whitespace-nowrap">{r.member_code}</td>
                    <td className="p-2 text-right">{r.portions}</td>
                    <td className="p-2 whitespace-nowrap">{timesOnly(r.check_in_times)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="p-2 font-bold text-right">
                    Tổng cộng
                  </td>
                  <td className="p-2 font-bold text-right">{total}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
