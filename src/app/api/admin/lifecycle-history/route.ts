import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { readMonthTransitions } from "@/lib/lifecycle/readTransitions";
import { withDeadline } from "@/lib/asyncDeadline";
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const snapshot = await withDeadline(readMonthTransitions(req.nextUrl.searchParams.get("month") || ""), 10000);
    return NextResponse.json({ transitions: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === "INVALID_MONTH" ? e.message : "HISTORY_UNAVAILABLE" }, { status: e instanceof Error && e.message === "INVALID_MONTH" ? 400 : 503 }); }
}
