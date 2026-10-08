import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProfessionImages } from "@/lib/profession-images/server";

/** GET /api/profession-images?ids=a,b — tayyor kasb rasmlari (ochiq ma'lumot, keshlanadi) */
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
  const ids = raw.filter((id) => z.uuid().safeParse(id).success);
  const images = await getProfessionImages(ids);
  return NextResponse.json({ images }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
