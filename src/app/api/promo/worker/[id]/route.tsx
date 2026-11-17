import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { postImageResponse } from "@/features/promo/post-image";
import { getWorkerPostCard } from "@/features/promo/worker-post-data";

/**
 * GET /api/promo/worker/<id> — ishchi e'loni rasmi (kanal posti va egasiga "E'loningiz joylandi" xabari uchun):
 * kasbi, tajribasi, joyi, kutilayotgan maosh va "ISHCHI" yorlig'i (ega, 2026-11-17). Faqat ommaviy e'lon; aks holda 404.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response("Not found", { status: 404 });
  // rasm chizish CPU talab qiladi: IP (/64) bo'yicha yumshoq limit (Telegram bir marta oladi, keyin keshdan)
  const ipHash = subjectHash("ip", ipBucket(clientIp(req.headers)));
  if (!(await allowRate(`promo:ip:${ipHash}`, 120, 600))) return new Response("Too many requests", { status: 429, headers: { "Retry-After": "600" } });
  const data = await getWorkerPostCard(id);
  if (!data) return new Response("Not found", { status: 404 });
  return postImageResponse(data, { "Cache-Control": "public, max-age=600, s-maxage=3600" });
}
