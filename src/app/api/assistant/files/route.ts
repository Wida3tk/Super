import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { getAuthenticatedAssistant } from "@/lib/auth/assistantAuth";
import { assistantCanAccessTrainee, validDocumentId } from "@/lib/auth/assistantPolicy";
import { AssistantError, assistantAudit, scopedTrainee } from "@/lib/auth/assistantOperations";
export const runtime = "nodejs";
const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedAssistant();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const form = await req.formData(), id = form.get("traineeId"), file = form.get("file"), title = String(form.get("title") || "").trim();
  if (!validDocumentId(id) || !(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024 || !allowed.has(file.type) || !title || title.length > 200)
    return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
  const trainee = await adminDb.collection("trainees").doc(id).get();
  if (!trainee.exists || !assistantCanAccessTrainee(user, trainee.data()!)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const path = `supervision-documents/${id}/assistant-${crypto.randomUUID()}`, target = adminStorage.bucket().file(path);
  try {
    await target.save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, resumable: false, validation: "crc32c",
      metadata: { metadata: { traineeId: id, uploadedByAssistant: user.id, originalName: file.name.slice(0, 200) } } });
    await adminDb.runTransaction(async tx => {
      const current = await scopedTrainee(tx, user, id), reference = adminDb.collection("supervisionDocuments").doc();
      tx.create(reference, { traineeId: id, supervisorId: current.data()?.currentSupervisorId || null, type: "other", title, fileName: file.name.slice(0, 200),
        fileUrl: path, uploadedByAssistant: user.id, status: "uploaded", createdAt: new Date().toISOString() });
      assistantAudit(tx, user, "assistant_document_uploaded", id, { documentId: reference.id, title });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    await target.delete().catch(() => undefined); // Only this newly generated upload, not any existing document.
    return NextResponse.json({ error: error instanceof AssistantError ? error.message : "UPLOAD_FAILED" }, { status: error instanceof AssistantError ? error.status : 503 });
  }
}
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedAssistant();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("traineeId"), documentId = req.nextUrl.searchParams.get("documentId");
  if (!validDocumentId(id) || !validDocumentId(documentId)) return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const [trainee, document] = await Promise.all([adminDb.collection("trainees").doc(id).get(), adminDb.collection("supervisionDocuments").doc(documentId).get()]);
  const data = document.data();
  if (!trainee.exists || !assistantCanAccessTrainee(user, trainee.data()!) || !data || data.traineeId !== id || !data.uploadedByAssistant ||
    typeof data.fileUrl !== "string" || !data.fileUrl.startsWith(`supervision-documents/${id}/assistant-`)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const [buffer] = await adminStorage.bucket().file(data.fileUrl).download();
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(data.fileName || "document")}` } });
}
