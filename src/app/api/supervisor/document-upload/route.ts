export const runtime = "nodejs";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import {
  getAuthenticatedSupervisor,
  getAuthenticatedTrainee,
} from "@/lib/auth/serverAuth";

const allowed = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(req: NextRequest) {
  try {
    const supervisor = await getAuthenticatedSupervisor();
    if (!supervisor)
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const form = await req.formData();
    const traineeId = String(form.get("traineeId") || "");
    const file = form.get("file");
    const trainee = await adminDb.collection("trainees").doc(traineeId).get();
    if (
      !trainee.exists ||
      trainee.data()?.currentSupervisorId !== supervisor.id
    )
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 10 * 1024 * 1024 ||
      !allowed.has(file.type)
    )
      return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `supervision-documents/${traineeId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const target = adminStorage.bucket().file(path);
    await target.save(Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      resumable: false,
      validation: "crc32c",
      metadata: {
        metadata: {
          traineeId,
          supervisorId: supervisor.id,
          originalName: file.name,
        },
      },
    });
    return NextResponse.json({ fileName: file.name, fileUrl: path, path });
  } catch (error) {
    console.error("Document upload failed", error);
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  const trainee = supervisor ? null : await getAuthenticatedTrainee();
  if (!supervisor && !trainee)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const path = req.nextUrl.searchParams.get("path") || "";
  if (!path.startsWith("supervision-documents/"))
    return NextResponse.json({ error: "INVALID_PATH" }, { status: 400 });
  const target = adminStorage.bucket().file(path);
  const [meta] = await target.getMetadata();
  if (
    (supervisor && meta.metadata?.supervisorId !== supervisor.id) ||
    (trainee && meta.metadata?.traineeId !== trainee.id)
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const [buffer] = await target.download();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": meta.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.metadata?.originalName || "document")}`,
    },
  });
}
