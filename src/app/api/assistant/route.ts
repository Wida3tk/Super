import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedAssistant } from "@/lib/auth/assistantAuth";
import { assistantCanAccessSupervisor, assistantCanAccessTrainee, assistantProfile, validDocumentId } from "@/lib/auth/assistantPolicy";
import { AssistantError, assistantAudit, liveAssistant, scopedTrainee } from "@/lib/auth/assistantOperations";
import { normalizeIdentityEmail, normalizeIdentityPhone } from "@/lib/identity/normalize";
export const dynamic = "force-dynamic";
const emailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const clean = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
function page(query: FirebaseFirestore.Query, after: string) {
  let result = query.orderBy("__name__");
  if (after) result = result.startAfter(after);
  return result.limit(51).get();
}
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedAssistant();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("traineeId");
  if (id) {
    if (!validDocumentId(id)) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
    const record = await adminDb.collection("trainees").doc(id).get();
    if (!record.exists || !assistantCanAccessTrainee(user, record.data()!)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const [documents, requests, bookings, learnerRequests] = await Promise.all([
      adminDb.collection("supervisionDocuments").where("traineeId", "==", id).limit(50).get(),
      adminDb.collection("assistantRequests").where("traineeId", "==", id).limit(50).get(),
      adminDb.collection("bookings").where("studentEmail", "==", record.data()!.email).limit(30).get(),
      adminDb.collection("traineeRequests").where("traineeId", "==", id).limit(30).get(),
    ]);
    return NextResponse.json({ trainee: assistantProfile(id, record.data()!),
      documents: documents.docs.map(d => ({ id: d.id, title: d.data().title || d.data().fileName || "مستند", status: d.data().status, canDownload: d.data().uploadedByAssistant != null })),
      requests: requests.docs.map(d => ({ id: d.id, action: d.data().action, status: d.data().status, proposal: d.data().proposal, note: d.data().note, resolution: d.data().resolution })),
      bookings: bookings.docs.map(d => ({ id: d.id, date: d.data().date || "", time: d.data().time || d.data().startTime || "", status: d.data().status || "" })),
      learnerRequests: learnerRequests.docs.map(d => ({ id: d.id, type: d.data().type || d.data().action || "طلب متدرب", status: d.data().status || "" })),
    }, { headers: { "Cache-Control": "no-store" } });
  }
  const after = req.nextUrl.searchParams.get("after") || "", createdAfter = req.nextUrl.searchParams.get("createdAfter") || "";
  if ([after, createdAfter].some(value => value && !validDocumentId(value))) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const regular = user.scope === "all" ? adminDb.collection("trainees") : adminDb.collection("trainees").where("currentSupervisorId", "in", user.supervisorIds);
  const [assigned, created, providers] = await Promise.all([
    req.nextUrl.searchParams.get("assignedDone") === "1" ? { docs: [] } : page(regular, after),
    user.scope === "supervisors" && req.nextUrl.searchParams.get("createdDone") !== "1" ? page(adminDb.collection("trainees").where("createdByAssistant", "==", user.id), createdAfter) : null,
    user.scope === "all" ? adminDb.collection("supervisors").limit(200).get() : adminDb.getAll(...user.supervisorIds.map(id => adminDb.collection("supervisors").doc(id))),
  ]);
  const records = [...new Map([...assigned.docs.slice(0, 50), ...(created?.docs.slice(0, 50) || [])].map(d => [d.id, d])).values()];
  return NextResponse.json({ trainees: records.filter(d => assistantCanAccessTrainee(user, d.data())).map(d => assistantProfile(d.id, d.data())),
    supervisors: (Array.isArray(providers) ? providers : providers.docs).filter(d => d.exists && d.data()?.isActive !== false && d.data()?.accountType !== "consultant")
      .map(d => ({ id: d.id, name: String(d.data()?.name || ""), email: String(d.data()?.email || "") })),
    after: assigned.docs.length > 50 ? assigned.docs[49].id : null,
    createdAfter: created && created.docs.length > 50 ? created.docs[49].id : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedAssistant();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json();
  const allowed: Record<string, string[]> = { create: ["action", "name", "email", "phone", "license", "supervisorId"], phone: ["action", "traineeId", "phone"], request: ["action", "traineeId", "requestType", "proposal", "note"] };
  if (!body || typeof body.action !== "string" || !Object.prototype.hasOwnProperty.call(allowed, body.action) || Object.keys(body).some(key => !allowed[body.action].includes(key))) return NextResponse.json({ error: "ACTION_NOT_ALLOWED" }, { status: 403 });
  if (body.action !== "create" && !validDocumentId(body.traineeId)) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  try {
    if (body.action === "create") {
      const name = clean(body.name), email = normalizeIdentityEmail(body.email), phone = normalizeIdentityPhone(body.phone);
      if (!name || !emailValid(email) || !phone || !["QASP-S", "QBA"].includes(body.license) || !validDocumentId(body.supervisorId) || email === process.env.ADMIN_EMAIL?.trim().toLowerCase() || email === user.email)
        throw new AssistantError("INVALID_DATA", 400);
      try {
        const identity = await adminAuth.getUserByEmail(email);
        if (identity.customClaims?.role === "administrative_assistant") throw new AssistantError("EMAIL_EXISTS", 409);
      } catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
      const ref = adminDb.collection("trainees").doc();
      await adminDb.runTransaction(async tx => {
        const live = await liveAssistant(tx, user);
        if (!assistantCanAccessSupervisor(live, body.supervisorId)) throw new AssistantError("FORBIDDEN");
        const [duplicates, provider, providerEmail] = await Promise.all([
          tx.get(adminDb.collection("trainees").where("email", "==", email).limit(1)),
          tx.get(adminDb.collection("supervisors").doc(body.supervisorId)),
          tx.get(adminDb.collection("supervisors").where("email", "==", email).limit(1)),
        ]);
        const identity = adminDb.collection("identityKeys").doc(`email_${createHash("sha256").update(email).digest("hex")}`);
        const emailKey = await tx.get(identity);
        const phoneIdentity = adminDb.collection("identityKeys").doc(`phone_${createHash("sha256").update(phone).digest("hex")}`);
        const [phoneKey, phones] = await Promise.all([tx.get(phoneIdentity), tx.get(adminDb.collection("trainees").where("phone", "==", phone).limit(1))]);
        if (!duplicates.empty || !providerEmail.empty || emailKey.exists) throw new AssistantError("EMAIL_EXISTS", 409);
        if (phoneKey.exists || !phones.empty) throw new AssistantError("PHONE_EXISTS", 409);
        if (!provider.exists || provider.data()?.isActive === false || provider.data()?.accountType === "consultant") throw new AssistantError("INVALID_SCOPE", 400);
        const now = new Date().toISOString();
        tx.create(ref, { name, email, phone, license: body.license, status: "onboarding", lifecycleStage: "initial_interview", onboardingStage: "initial_interview",
          serviceAccessEnabled: false, currentSupervisorId: null, createdByAssistant: user.id,
          requiredHours: body.license === "QBA" ? 2000 : 1000, fieldworkTargetHours: body.license === "QBA" ? 2000 : 1000,
          supervisionTargetHours: body.license === "QBA" ? 100 : 50, totalHours: 0, totalIndividualHours: 0, totalGroupHours: 0, createdAt: now, updatedAt: now });
        tx.create(identity, { kind: "email", value: email, traineeId: ref.id });
        tx.create(phoneIdentity, { kind: "phone", value: phone, traineeId: ref.id });
        tx.create(adminDb.collection("assistantRequests").doc(), { traineeId: ref.id, action: "assign_supervisor", proposal: body.supervisorId, note: "إسناد المتدرب المضاف بواسطة المساعد",
          createdBy: user.id, createdByName: user.name, status: "pending", createdAt: now });
        tx.create(adminDb.collection("traineeLifecycleTransitions").doc(), { traineeId: ref.id, fromStage: null, toStage: "initial_interview", reason: "إضافة متدرب بواسطة مساعد إداري",
          changedAt: now, changedMonth: now.slice(0, 7), changedBy: user.id });
        assistantAudit(tx, user, "assistant_trainee_created", ref.id, { supervisorRequested: body.supervisorId });
      });
      return NextResponse.json({ success: true, id: ref.id });
    }
    await adminDb.runTransaction(async tx => {
      const trainee = await scopedTrainee(tx, user, body.traineeId);
      if (body.action === "phone") {
        const phone = normalizeIdentityPhone(body.phone);
        if (typeof body.phone !== "string" || !phone) throw new AssistantError("INVALID_DATA", 400);
        const identity = adminDb.collection("identityKeys").doc(`phone_${createHash("sha256").update(phone).digest("hex")}`);
        const owner = await tx.get(identity);
        const duplicates = await tx.get(adminDb.collection("trainees").where("phone", "==", phone).limit(2));
        const oldPhone = normalizeIdentityPhone(trainee.data()?.phone);
        const oldIdentity = oldPhone && oldPhone !== phone ? adminDb.collection("identityKeys").doc(`phone_${createHash("sha256").update(oldPhone).digest("hex")}`) : null;
        const oldOwner = oldIdentity ? await tx.get(oldIdentity) : null;
        if ((owner.exists && owner.data()?.traineeId !== trainee.id) || duplicates.docs.some(d => d.id !== trainee.id)) throw new AssistantError("PHONE_EXISTS", 409);
        tx.set(identity, { kind: "phone", value: phone, traineeId: trainee.id });
        if (oldIdentity && oldOwner?.data()?.traineeId === trainee.id) tx.delete(oldIdentity);
        tx.update(trainee.ref, { phone, updatedAt: new Date().toISOString() });
        assistantAudit(tx, user, "assistant_contact_updated", trainee.id, { before: { phone: trainee.data()?.phone || "" }, after: { phone } });
      } else {
        if (!["assign_supervisor", "change_status", "update_identity", "follow_up"].includes(body.requestType) || typeof body.note !== "string" || !body.note.trim() || body.note.length > 1000 || typeof body.proposal !== "string" || !body.proposal.trim() || body.proposal.length > 500)
          throw new AssistantError("INVALID_DATA", 400);
        if (body.requestType === "assign_supervisor" && !assistantCanAccessSupervisor(user, body.proposal)) throw new AssistantError("FORBIDDEN");
        tx.create(adminDb.collection("assistantRequests").doc(), { traineeId: trainee.id, action: body.requestType, proposal: body.proposal.trim(), note: body.note.trim(),
          createdBy: user.id, createdByName: user.name, status: "pending", createdAt: new Date().toISOString() });
        assistantAudit(tx, user, "assistant_request_created", trainee.id, { action: body.requestType });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AssistantError ? error.message : "OPERATION_FAILED" }, { status: error instanceof AssistantError ? error.status : 503 });
  }
}
