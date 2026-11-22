/**
 * Moslik sababi turi (ma'lumot qatlamida qoladi). Ko'rinish — "Mos" nishoni, foiz halqasi, sabablar ro'yxati — olib
 * tashlandi (ega, 2026-11-22: "moslikni hamma joydan olib tashla, umuman kerak emas").
 *
 * ok: true — mos; "warn" — qisman; false — mos emas; "unknown" — talab bor, lekin ma'lumot yo'q (mos deb hisoblanmaydi)
 */
export type MatchReason = { key: string; ok: boolean | "warn" | "unknown"; [param: string]: unknown };
