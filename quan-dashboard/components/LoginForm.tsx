"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!code.trim() || !password) {
      setError("Vui lòng nhập đầy đủ mã quán và mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), password }),
      });
      const data = await res.json();
      if (data.result === "success") {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.message || "Đăng nhập thất bại.");
      }
    } catch {
      setError("Không kết nối được, vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] p-6"
    >
      <p className="text-center text-[var(--color-text-muted)] mb-5">
        Nhập mã quán và mật khẩu quán để xem báo cáo và theo dõi suất ăn.
      </p>

      <div className="mb-5">
        <label htmlFor="code" className="block font-semibold mb-2">
          Mã Quán <span className="text-[var(--color-error)]">*</span>
        </label>
        <input
          id="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="Ví dụ: SG34DY"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full text-lg px-3 py-3 border-2 border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
      </div>

      <div className="mb-2">
        <label htmlFor="password" className="block font-semibold mb-2">
          Mật Khẩu Quán <span className="text-[var(--color-error)]">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="off"
            placeholder="Nhập mật khẩu quán"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full text-lg px-3 py-3 pr-14 border-2 border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 text-xl opacity-60"
          >
            {showPassword ? "🔓" : "🔒"}
          </button>
        </div>
      </div>

      {error && <p className="text-[var(--color-error)] text-sm min-h-[1.2em] mb-2">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-3 py-4 text-lg font-bold rounded-xl text-white bg-[var(--color-primary)] active:bg-[var(--color-primary-dark)] disabled:bg-[#90A4AE] disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
      </button>
    </form>
  );
}
