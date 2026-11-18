import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { ASSISTANT_ROLE, validAssistantScope, validDocumentId } from "@/lib/auth/assistantPolicy";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const records = await adminDb.collection("administrativeAssistants").limit(100).get();
  return NextResponse.json({ assistants: records.docs.map(d => ({ id: d.id, ...d.data() })) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase(), name = String(body.name || "").trim();
  if (!name || name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === process.env.ADMIN_EMAIL?.trim().toLowerCase() || !validAssistantScope(body))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  if (body.scope === "supervisors") {
    const records = await adminDb.getAll(...body.supervisorIds.map((id: string) => adminDb.collection("supervisors").doc(id)));
    if (records.some(d => !d.exists || d.data()?.isActive === false || d.data()?.accountType === "consultant")) return NextResponse.json({ error: "INVALID_SCOPE" }, { status: 400 });
  }
  const [trainees, providers] = await Promise.all([adminDb.collection("trainees").where("email", "==", email).limit(1).get(), adminDb.collection("supervisors").where("email", "==", email).limit(1).get()]);
  if (!trainees.empty || !providers.empty) return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
  let uid: string | undefined;
  try {
    const user = await adminAuth.createUser({ email, displayName: name }); uid = user.uid;
    await adminAuth.setCustomUserClaims(uid, { role: ASSISTANT_ROLE });
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    batch.create(adminDb.collection("administrativeAssistants").doc(uid), { name, email, role: ASSISTANT_ROLE, active: true,
      scope: body.scope, supervisorIds: body.supervisorIds, createdAt: now, createdBy: admin.uid });
    batch.create(adminDb.collection("activityLog").doc(), { type: "assistant_created", actorId: admin.uid, message: "إنشاء حساب مساعد إداري", createdAt: now,
      meta: { assistantId: uid, scope: body.scope, supervisorIds: body.supervisorIds } });
    await batch.commit();
    // The assistant sets their own password using Firebase's existing reset flow.
    return NextResponse.json({ success: true, id: uid });
  } catch (error: any) {
    if (uid) await adminAuth.updateUser(uid, { disabled: true }).catch(() => undefined);
    return NextResponse.json({ error: error.code === "auth/email-already-exists" ? "EMAIL_EXISTS" : "CREATE_FAILED" }, { status: error.code === "auth/email-already-exists" ? 409 : 500 });
  }
}
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json();
  if (!validDocumentId(body.id) || typeof body.active !== "boolean" || !validAssistantScope(body)) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const ref = adminDb.collection("administrativeAssistants").doc(body.id);
  if (!(await ref.get()).exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (body.scope === "supervisors") {
    const records = await adminDb.getAll(...body.supervisorIds.map((id: string) => adminDb.collection("supervisors").doc(id)));
    if (records.some(d => !d.exists || d.data()?.isActive === false || d.data()?.accountType === "consultant")) return NextResponse.json({ error: "INVALID_SCOPE" }, { status: 400 });
  }
  // Gate access in Firestore first, even if the Auth service is temporarily unavailable.
  const batch = adminDb.batch(), now = new Date().toISOString();
  batch.update(ref, { active: false, updatedAt: now });
  batch.create(adminDb.collection("activityLog").doc(), { type: "assistant_access_changed", actorId: admin.uid, message: "تعديل صلاحية مساعد إداري", createdAt: now,
    meta: { assistantId: body.id, active: body.active, scope: body.scope, supervisorIds: body.supervisorIds } });
  await batch.commit();
  try {
    await adminAuth.updateUser(body.id, { disabled: !body.active });
    await adminAuth.revokeRefreshTokens(body.id);
    await ref.update({ active: body.active, scope: body.scope, supervisorIds: body.supervisorIds });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "AUTH_UPDATE_FAILED_ACCESS_DISABLED" }, { status: 503 }); }
}
