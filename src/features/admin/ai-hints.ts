/**
 * AI xatosi matnidan admin uchun tushunarli maslahat turi (sof funksiya — testlanadi).
 * Masalan "http_400: API key not valid" → "key" ("Gemini kaliti noto'g'ri — Vercel'da yangilang").
 */
export type AiHint = "key" | "quota" | "busy" | "model" | "permission" | "region" | "timeout" | "server_key";

export function aiErrorHint(error: string | null | undefined): AiHint | null {
  if (!error) return null;
  const e = error.toLowerCase();
  if (e.includes("supabase_service_role_key")) return "server_key";
  if (/api key not valid|api_key_invalid|api key expired|invalid api key/.test(e)) return "key";
  if (/location is not supported|user location/.test(e)) return "region";
  if (/http_429|quota|resource_exhausted|rate limit/.test(e)) return "quota";
  if (/http_403|permission|permission_denied|has not been used|is disabled|not enabled/.test(e)) return "permission";
  if (/http_404|not found|is not supported for generatecontent/.test(e)) return "model";
  if (/http_5\d\d|overloaded|unavailable|internal error/.test(e)) return "busy";
  if (/timeout|aborted|network|fetch failed/.test(e)) return "timeout";
  return null;
}
