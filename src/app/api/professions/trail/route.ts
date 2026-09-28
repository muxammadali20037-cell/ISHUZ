import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProfessionTrail } from "@/features/professions/queries";

/** GET /api/professions/trail?id=<node> — ildizdan tugungacha yo'l (breadcrumb) */
export async function GET(req: NextRequest) {
  const id = z.uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const trail = await getProfessionTrail(id.data);
  return NextResponse.json({ trail }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
