import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { searchProfessions } from "@/features/professions/queries";

const params = z.object({ q: z.string().trim().min(2).max(80), category: z.uuid().optional() });

/** GET /api/professions/search?q=urolog — kasb qidiruvi (sinonimlar bilan), har natijada to'liq yo'l */
export async function GET(req: NextRequest) {
  const parsed = params.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ results: [] });
  const results = await searchProfessions(parsed.data.q, parsed.data.category);
  return NextResponse.json({ results }, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
