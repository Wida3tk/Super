import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { syncTraineeFieldworkTotals } from "@/lib/fieldwork/syncTotals";
import { sendTraineeInvitationEmail } from "@/lib/email/emailService";

export const dynamic = "force-dynamic";

type LegacyActivity = {
  sourceMonth: number;
  sourceRow: number;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  activityType: "direct" | "indirect" | "supervision_direct" | "supervision_indirect";
  setting?: string;
  format?: string;
  observedWithClient?: string;
  description?: string;
};

type LegacyTrainee = {
  sourceFile?: string;
  info: {
    name: string;
    email: string;
    supervisionStartDate: string;
  };
  supervisorSummary: {
    license: "QASP-S" | "QBA";
    totalSupervision: number;
  };
  activities: LegacyActivity[];
};

type ParsedTrainee = {
  name: string;
  email: string;
  license: "QASP-S" | "QBA";
  startDate: string;
  activities: LegacyActivity[];
};

type ImportPreview = {
  name: string;
  email: string;
  license: "QASP-S" | "QBA";
  existingTraineeId: string | null;
  duplicateCount: number;
  activityCount: number;
  fieldworkHours: number;
  supervisionHours: number;
};

const ACTIVITY_TYPES = new Set([
  "direct",
  "indirect",
  "supervision_direct",
  "supervision_indirect",
]);

const clean = (value: unknown, max = 500) =>
  String(value ?? "").trim().slice(0, max);

function normalizeEmail(value: unknown) {
  return clean(value, 320).toLowerCase();
}

function validateTrainee(input: LegacyTrainee): ParsedTrainee {
  const name = clean(input?.info?.name, 200);
  const email = normalizeEmail(input?.info?.email);
  const license = input?.supervisorSummary?.license;
  const startDate = clean(input?.info?.supervisionStartDate, 10);
  if (!name || !email.includes("@") || !["QASP-S", "QBA"].includes(license)) {
    throw new Error("INVALID_TRAINEE_DATA");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error("INVALID_START_DATE");
  }
  const activities = Array.isArray(input.activities) ? input.activities : [];
  for (const row of activities) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(clean(row.date, 10)) ||
      !ACTIVITY_TYPES.has(row.activityType) ||
      !Number.isFinite(Number(row.duration)) ||
      Number(row.duration) <= 0 ||
      Number(row.duration) > 16 ||
      !Number.isInteger(Number(row.sourceMonth)) ||
      !Number.isInteger(Number(row.sourceRow))
    ) {
      throw new Error("INVALID_ACTIVITY_DATA");
    }
  }
  const supervision = activities
    .filter((row) => row.activityType.startsWith("supervision_"))
    .reduce((sum, row) => sum + Number(row.duration), 0);
  if (Math.abs(supervision - Number(input.supervisorSummary.totalSupervision)) > 0.001) {
    throw new Error("SUPERVISION_TOTAL_MISMATCH");
  }
  return { name, email, license, startDate, activities };
}

function activityId(email: string, row: LegacyActivity) {
  const key = [
    "legacy-v1",
    email,
    row.sourceMonth,
    row.sourceRow,
    row.date,
    row.activityType,
    row.duration,
  ].join("|");
  return `legacy_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

function appPasswordLink(firebaseLink: string) {
  const actionCode = new URL(firebaseLink).searchParams.get("oobCode");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spv.sulukera.com";
  return actionCode
    ? `${appUrl}/ar/setup-password?oobCode=${encodeURIComponent(actionCode)}`
    : firebaseLink;
}

async function findSupervisor(email: string) {
  const exact = await adminDb
    .collection("supervisors")
    .where("email", "==", email)
    .limit(2)
    .get();
  if (exact.size === 1) return exact.docs[0];
  const all = await adminDb.collection("supervisors").get();
  const matches = all.docs.filter(
    (doc) => normalizeEmail(doc.data().email) === email,
  );
  return matches.length === 1 ? matches[0] : null;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const supervisorEmail = normalizeEmail(body.supervisorEmail);
    const dryRun = body.dryRun !== false;
    const inputs = Array.isArray(body.trainees) ? body.trainees : [];
    if (!supervisorEmail || inputs.length < 1 || inputs.length > 20) {
      return NextResponse.json({ error: "INVALID_IMPORT_PAYLOAD" }, { status: 400 });
    }

    const supervisor = await findSupervisor(supervisorEmail);
    if (!supervisor) {
      return NextResponse.json({ error: "SUPERVISOR_NOT_FOUND" }, { status: 404 });
    }
    const supervisorData = supervisor.data();
    if (supervisorData.isActive === false || supervisorData.accountType === "consultant") {
      return NextResponse.json({ error: "SUPERVISOR_NOT_ACTIVE" }, { status: 409 });
    }

    const parsed: ParsedTrainee[] = inputs.map((item: LegacyTrainee) =>
      validateTrainee(item),
    );
    const preview: ImportPreview[] = [];
    for (const trainee of parsed) {
      const existing = await adminDb
        .collection("trainees")
        .where("email", "==", trainee.email)
        .limit(2)
        .get();
      const fieldwork = trainee.activities
        .filter((row) => row.activityType === "direct" || row.activityType === "indirect")
        .reduce((sum, row) => sum + Number(row.duration), 0);
      const supervision = trainee.activities
        .filter((row) => row.activityType.startsWith("supervision_"))
        .reduce((sum, row) => sum + Number(row.duration), 0);
      preview.push({
        name: trainee.name,
        email: trainee.email,
        license: trainee.license,
        existingTraineeId: existing.size === 1 ? existing.docs[0].id : null,
        duplicateCount: existing.size,
        activityCount: trainee.activities.length,
        fieldworkHours: fieldwork,
        supervisionHours: supervision,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        supervisor: { id: supervisor.id, name: supervisorData.name, email: supervisorEmail },
        trainees: preview,
      });
    }
    if (preview.some((row) => row.duplicateCount > 1)) {
      return NextResponse.json({ error: "DUPLICATE_TRAINEE_EMAIL" }, { status: 409 });
    }

    const results = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const trainee = parsed[index];
      const existingId = preview[index].existingTraineeId;
      const traineeRef = existingId
        ? adminDb.collection("trainees").doc(existingId)
        : adminDb.collection("trainees").doc();
      const existingSnap = existingId ? await traineeRef.get() : null;
      const existingData = existingSnap?.data() || {};
      if (
        existingData.currentSupervisorId &&
        existingData.currentSupervisorId !== supervisor.id
      ) {
        return NextResponse.json(
          { error: "TRAINEE_ASSIGNED_TO_ANOTHER_SUPERVISOR", email: trainee.email },
          { status: 409 },
        );
      }

      let authUser;
      try {
        authUser = await adminAuth.getUserByEmail(trainee.email);
      } catch (error: any) {
        if (error?.code !== "auth/user-not-found") throw error;
        authUser = await adminAuth.createUser({
          email: trainee.email,
          displayName: trainee.name,
          emailVerified: false,
        });
      }
      await adminAuth.setCustomUserClaims(authUser.uid, {
        role: "trainee",
        traineeId: traineeRef.id,
      });

      const now = new Date().toISOString();
      const requiredHours = trainee.license === "QASP-S" ? 1000 : 2000;
      const supervisionTargetHours = trainee.license === "QASP-S" ? 50 : 100;
      await traineeRef.set(
        {
          name: trainee.name,
          email: trainee.email,
          phone: clean(existingData.phone, 40),
          license: trainee.license,
          requiredHours,
          fieldworkTargetHours: requiredHours,
          supervisionTargetHours,
          status: "active",
          onboardingStage: null,
          currentSupervisorId: supervisor.id,
          assignmentStatus: "active",
          authUid: authUser.uid,
          accountStatus: existingData.accountStatus === "active" ? "active" : "invited",
          fieldworkStartDate: existingData.fieldworkStartDate || trainee.startDate,
          courseworkStartDate: existingData.courseworkStartDate || trainee.startDate,
          totalIndividualHours: Number(existingData.totalIndividualHours || 0),
          totalGroupHours: Number(existingData.totalGroupHours || 0),
          createdAt: existingData.createdAt || now,
          updatedAt: now,
          legacyImport: {
            version: 1,
            importedAt: now,
            importedBy: admin.email || "admin",
          },
        },
        { merge: true },
      );

      const assignmentRef = adminDb
        .collection("assignments")
        .doc(`legacy_${traineeRef.id}_${supervisor.id}`);
      await assignmentRef.set(
        {
          traineeId: traineeRef.id,
          supervisorId: supervisor.id,
          startDate: trainee.startDate,
          notes: "استيراد من ملفات التتبع السابقة المعتمدة",
          createdAt: existingData.createdAt || now,
          createdBy: "admin",
          adminOverride: true,
          status: "active",
          importVersion: 1,
        },
        { merge: true },
      );

      let createdActivities = 0;
      for (let offset = 0; offset < trainee.activities.length; offset += 400) {
        const chunk: LegacyActivity[] = trainee.activities.slice(offset, offset + 400);
        const refs = chunk.map((row) =>
          adminDb.collection("fieldworkActivities").doc(activityId(trainee.email, row)),
        );
        const existingActivities = await adminDb.getAll(...refs);
        const batch = adminDb.batch();
        chunk.forEach((row, rowIndex) => {
          if (existingActivities[rowIndex].exists) return;
          const isSupervision = row.activityType.startsWith("supervision_");
          const setting = clean(row.setting, 40).toLowerCase();
          const format = clean(row.format, 40).toLowerCase();
          batch.create(refs[rowIndex], {
            traineeId: traineeRef.id,
            supervisorId: supervisor.id,
            date: row.date,
            month: row.date.slice(0, 7),
            startTime: clean(row.startTime, 5),
            endTime: clean(row.endTime, 5),
            duration: Number(row.duration),
            activityType: row.activityType,
            setting: isSupervision
              ? setting.includes("video")
                ? "video"
                : "in_person"
              : null,
            format: isSupervision
              ? format.includes("group")
                ? "group"
                : "individual"
              : null,
            observedWithClient: isSupervision
              ? clean(row.observedWithClient, 20).toLowerCase() === "yes"
              : false,
            description:
              clean(row.description, 2000) ||
              (isSupervision
                ? "جلسة إشراف موثقة في ملف التتبع السابق"
                : "ساعات ميدانية موثقة في ملف التتبع السابق"),
            activityCategory: isSupervision ? null : "other_aba",
            evidenceNote: "مستورد من ملف التتبع السابق ومطابق لملف المشرف",
            status: "approved",
            reviewerNote: "اعتماد إداري للسجل التاريخي",
            reviewedAt: now,
            reviewedBy: admin.email || "admin",
            createdAt: now,
            updatedAt: now,
            legacyImport: {
              version: 1,
              sourceMonth: row.sourceMonth,
              sourceRow: row.sourceRow,
            },
          });
          createdActivities += 1;
        });
        await batch.commit();
      }

      const totals = await syncTraineeFieldworkTotals(traineeRef.id);
      let inviteLink = "";
      let emailSent = false;
      if (existingData.accountStatus !== "active") {
        inviteLink = appPasswordLink(
          await adminAuth.generatePasswordResetLink(trainee.email),
        );
        try {
          await sendTraineeInvitationEmail({
            name: trainee.name,
            email: trainee.email,
            resetLink: inviteLink,
            supervisorName: supervisorData.name,
          });
          emailSent = Boolean(process.env.EMAIL_SERVICE_API_KEY);
        } catch (error) {
          console.error("Legacy import invitation failed", trainee.email, error);
        }
      }

      await adminDb.collection("activityLogs").add({
        type: "legacy_trainee_import",
        message: `تم استيراد السجل التاريخي للمتدرب ${trainee.name}`,
        traineeId: traineeRef.id,
        supervisorId: supervisor.id,
        createdAt: FieldValue.serverTimestamp(),
        meta: {
          createdActivities,
          approvedFieldworkHours: totals.approvedFieldworkHours,
          approvedSupervisionHours: totals.approvedSupervisionHours,
          importVersion: 1,
        },
      });

      results.push({
        traineeId: traineeRef.id,
        name: trainee.name,
        createdActivities,
        totals,
        emailSent,
        inviteLink: emailSent ? undefined : inviteLink,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Legacy trainee import failed", error);
    return NextResponse.json(
      { error: error?.message || "IMPORT_FAILED" },
      { status: 400 },
    );
  }
}
