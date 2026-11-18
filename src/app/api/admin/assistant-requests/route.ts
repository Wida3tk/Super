import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { validDocumentId } from "@/lib/auth/assistantPolicy";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const records = await adminDb.collection("assistantRequests").where("status", "==", "pending").limit(100).get();
  return NextResponse.json({ requests: records.docs.map(d => ({ id: d.id, ...d.data() })) }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, decision, note } = await req.json();
  if (!validDocumentId(id) || !["processed", "rejected"].includes(decision) || typeof note !== "string" || !note.trim() || note.length > 1000)
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const result = await adminDb.runTransaction(async tx => {
    const reference = adminDb.collection("assistantRequests").doc(id), record = await tx.get(reference);
    if (!record.exists) return false;
    if (record.data()?.status !== "pending") return true;
    tx.update(reference, { status: decision, resolution: note.trim(), resolvedBy: admin.uid, resolvedAt: new Date().toISOString() });
    tx.create(adminDb.collection("activityLog").doc(), { type: "assistant_request_resolved", actorId: admin.uid, traineeId: record.data()?.traineeId,
      message: "معالجة طلب مساعد إداري", createdAt: new Date().toISOString(), meta: { requestId: id, decision, note: note.trim() } });
    return true;
  });
  return NextResponse.json({ success: result }, { status: result ? 200 : 404 });
}
