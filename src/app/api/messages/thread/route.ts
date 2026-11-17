export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { openConversation, readThread, resolveActor, sendMessage } from "@/lib/messages/server";

async function open(req: NextRequest) {
  const actor = await resolveActor(req.nextUrl.searchParams.get("as"));
  if (!actor) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  const opened = await openConversation(req.nextUrl.searchParams.get("id"), actor);
  // Same answer for "does not exist" and "not yours".
  if (!opened) return { error: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  return { actor, opened };
}

/** GET ?id=&as=: the thread's messages, oldest first. Marks it read for the viewer. */
export async function GET(req: NextRequest) {
  const result = await open(req);
  if ("error" in result) return result.error;
  return NextResponse.json(await readThread(result.opened, result.actor));
}

/** POST ?id=&as= { text }: sends a message. Messages cannot be edited or deleted. */
export async function POST(req: NextRequest) {
  const result = await open(req);
  if ("error" in result) return result.error;
  const body = await req.json().catch(() => ({}));
  const sent = await sendMessage(result.opened, result.actor, body.text);
  if ("error" in sent) return NextResponse.json({ error: sent.error }, { status: sent.error === "READ_ONLY" ? 403 : 400 });
  return NextResponse.json({ message: sent.message });
}
