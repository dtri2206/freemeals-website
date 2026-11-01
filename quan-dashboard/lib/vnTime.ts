// Viet Nam = UTC+7 co dinh, khong co gio mua he.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ngay hom nay theo gio Viet Nam, dang "yyyy-MM-dd". */
export function vnToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Khung 1 ngay tron theo gio VN: tu 00:00 den 24:00 (= 00:00 ngay hom sau,
 * khong tinh moc cuoi). Dung cho tab "Theo doi" thay cho khung "24 gio gan
 * nhat" truoc day (khung truot, cong lan luot quet toi hom truoc roi tut dan
 * khi cac luot do roi ra ngoai 24h).
 *
 * day khong hop le / bo trong / o tuong lai -> dung hom nay.
 */
export function vnDayRange(day?: string | null): { day: string; fromIso: string; toIso: string } {
  const today = vnToday();
  const d = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today ? day : today;
  const from = new Date(`${d}T00:00:00+07:00`);
  // Ngay khong ton tai (vd 2026-02-30) bi JS tu day sang thang sau -> bo, dung hom nay.
  if (Number.isNaN(from.getTime()) || vnToday(from) !== d) return vnDayRange(today);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { day: d, fromIso: from.toISOString(), toIso: to.toISOString() };
}
