export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  getAuthenticatedSupervisor,
  getAuthenticatedTrainee,
  hasActiveTraineeService,
  requireAdmin,
} from "@/lib/auth/serverAuth";
import {
  createResumableDriveUpload,
  DRIVE_CATEGORIES,
  DriveCategory,
  getVerifiedDriveFile,
  grantDriveFileReaders,
} from "@/lib/drive/supervisionDrive";

const MAX_FILE_SIZE = 250 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

type Access = {
  role: "admin" | "supervisor" | "trainee";
  id: string;
  email?: string;
};

async function accessForTrainee(traineeId: string, write = false): Promise<Access | null> {
  const admin = await requireAdmin();
  if (admin) return { role: "admin", id: admin.uid, email: admin.email };

  const supervisor = await getAuthenticatedSupervisor();
  if (supervisor) {
    const trainee = await adminDb.collection("trainees").doc(traineeId).get();
    if (trainee.exists && trainee.data()?.currentSupervisorId === supervisor.id)
      return { role: "supervisor", id: supervisor.id, email: supervisor.email };
    return null;
  }

  const trainee = await getAuthenticatedTrainee();
  if (!trainee || trainee.id !== traineeId) return null;
  if (write && !hasActiveTraineeService(trainee)) return null;
  return { role: "trainee", id: trainee.id, email: trainee.email };
}

function clean(value: unknown, max = 250) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const traineeId = clean(body.traineeId, 100);
    const access = await accessForTrainee(traineeId, true);
    if (!access)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const traineeSnap = await adminDb.collection("trainees").doc(traineeId).get();
    if (!traineeSnap.exists)
      return NextResponse.json({ error: "TRAINEE_NOT_FOUND" }, { status: 404 });
    const trainee = traineeSnap.data() || {};

    if (body.action === "initiate") {
      const category = clean(body.category, 40) as DriveCategory;
      const fileName = clean(body.fileName);
      const mimeType = clean(body.mimeType, 150);
      const size = Number(body.size || 0);
      if (
        !(category in DRIVE_CATEGORIES) ||
        !fileName ||
        !allowedTypes.has(mimeType) ||
        !Number.isFinite(size) ||
        size < 1 ||
        size > MAX_FILE_SIZE
      ) {
        return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
      }
      const uploadUrl = await createResumableDriveUpload({
        traineeId,
        traineeName: clean(trainee.name, 180),
        category,
        fileName,
        mimeType,
        size,
        uploaderId: access.id,
        uploaderRole: access.role,
      });
      return NextResponse.json({ uploadUrl });
    }

    if (body.action === "complete") {
      const fileId = clean(body.fileId, 180);
      const { drive, file } = await getVerifiedDriveFile(fileId, traineeId);
      const uploadedSize = Number(file.size || 0);
      if (!allowedTypes.has(String(file.mimeType || "")) || uploadedSize < 1 || uploadedSize > MAX_FILE_SIZE)
        return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
      const supervisorEmail = trainee.currentSupervisorId
        ? (await adminDb.collection("supervisors").doc(trainee.currentSupervisorId).get()).data()?.email
        : undefined;
      await grantDriveFileReaders(drive, fileId, [
        trainee.email,
        supervisorEmail,
        process.env.ADMIN_EMAIL,
      ]);
      const now = new Date().toISOString();
      const ref = adminDb.collection("supervisionDocuments").doc();
      await ref.set({
        traineeId,
        supervisorId: trainee.currentSupervisorId || null,
        type: clean(body.type, 60) || "other",
        category: file.appProperties?.category || "activity_evidence",
        title: clean(body.title, 200) || file.name,
        notes: clean(body.notes, 4000),
        issuedAt: clean(body.issuedAt, 10) || now.slice(0, 10),
        centerName: clean(body.centerName, 200),
        clientCode: clean(body.clientCode, 80),
        expiresAt: clean(body.expiresAt, 10) || null,
        status: access.role === "trainee" ? "uploaded" : "reviewed",
        fileName: file.name,
        fileUrl: `drive:${fileId}`,
        driveFileId: fileId,
        driveWebViewLink: file.webViewLink || null,
        mimeType: file.mimeType,
        size: uploadedSize,
        storageProvider: "google_drive",
        uploadedByRole: access.role,
        createdAt: now,
        createdBy: access.id,
      });
      return NextResponse.json({ success: true, id: ref.id });
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    console.error("Drive file operation failed", error);
    return NextResponse.json({ error: "DRIVE_OPERATION_FAILED" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const documentId = clean(req.nextUrl.searchParams.get("documentId"), 180);
    const document = await adminDb.collection("supervisionDocuments").doc(documentId).get();
    if (!document.exists)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const data = document.data() || {};
    const access = await accessForTrainee(String(data.traineeId || ""));
    if (!access)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const fileId = clean(data.driveFileId || String(data.fileUrl || "").replace(/^drive:/, ""), 180);
    const { file } = await getVerifiedDriveFile(fileId, String(data.traineeId));
    if (!file.webViewLink)
      return NextResponse.json({ error: "NO_VIEW_LINK" }, { status: 404 });
    return NextResponse.redirect(file.webViewLink);
  } catch (error) {
    console.error("Drive file view failed", error);
    return NextResponse.json({ error: "DRIVE_OPERATION_FAILED" }, { status: 500 });
  }
}
