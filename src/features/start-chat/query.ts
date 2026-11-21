/** ?q=… (skriptlarsiz yuborilgan chat matni) — bitta qatorga, 300 belgigacha; juda qisqa bo'lsa — yo'q */
export function chatQuery(q: string | string[] | undefined): string {
  const s = typeof q === "string" ? q.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return s.length >= 2 ? s : "";
}
