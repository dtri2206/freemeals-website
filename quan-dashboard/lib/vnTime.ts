// Viet Nam = UTC+7 co dinh, khong co gio mua he.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Moc 00:00 hom nay theo gio Viet Nam (ISO, UTC). Dung cho tab "Hom nay":
 * dem tu 00:00 den 23:59 cua ngay hien tai, qua nua dem tu ve 0 -- thay cho
 * khung "24 gio gan nhat" truoc day (khung truot, cong lan luot quet toi hom
 * truoc roi tut dan khi cac luot do roi ra ngoai 24h).
 */
export function vnStartOfTodayIso(now: Date = new Date()): string {
  const vnDate = new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
  return new Date(`${vnDate}T00:00:00+07:00`).toISOString();
}
