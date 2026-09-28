import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProfessionChildren } from "@/features/professions/queries";

const params = z.object({ category: z.uuid().optional(), parent: z.uuid().optional() });

/** GET /api/professions/nodes?category=<id> | ?parent=<id> — daraxtning bitta darajasi */
export async function GET(req: NextRequest) {
  const parsed = params.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success || (!parsed.data.category && !parsed.data.parent)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const nodes = await getProfessionChildren({ categoryId: parsed.data.category, parentId: parsed.data.parent });
  return NextResponse.json({ nodes }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
