/** Soxta aniqlik ("97.4%") o'rniga tushunarli daraja (server va mijozda bir xil) */
export function matchLevel(score: number): "very" | "good" | "partial" | "low" {
  if (score >= 75) return "very";
  if (score >= 50) return "good";
  if (score >= 30) return "partial";
  return "low";
}
