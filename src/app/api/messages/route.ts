export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listConversations, resolveActor, unreadCount } from "@/lib/messages/server";

/** GET ?as=admin|supervisor|trainee[&count=1]: the viewer's conversations, or just the unread total. */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req.nextUrl.searchParams.get("as"));
  if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (req.nextUrl.searchParams.get("count")) return NextResponse.json({ unread: await unreadCount(actor) });
  const conversations = await listConversations(actor);
  return NextResponse.json({ conversations, unread: conversations.reduce((sum, item) => sum + item.unread, 0) });
}
