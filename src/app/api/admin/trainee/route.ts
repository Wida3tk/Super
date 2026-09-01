import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activityLog";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return false;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return (
      decoded.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()
    );
  } catch {
    return false;
  }
}

// إضافة متدرب جديد
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, email, phone, license } = await req.json();
  if (!name || !email || !phone || !license) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const requiredHours = license === "QASP-S" ? 1000 : 2000;
  const supervisionTargetHours = license === "QASP-S" ? 50 : 100;
  const ref = await adminDb.collection("trainees").add({
    name,
    email,
    phone,
    license,
    requiredHours,
    fieldworkTargetHours: requiredHours,
    supervisionTargetHours,
    status: "onboarding",
    onboardingStage: "initial_interview",
    currentSupervisorId: null,
    totalIndividualHours: 0,
    totalGroupHours: 0,
    totalHours: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await logActivity({
    type: "trainee_added",
    message: `أُضيف متدرب جديد: ${name}`,
    traineeId: ref.id,
    meta: { license },
  });

  return NextResponse.json({ id: ref.id });
}

// تحديث حالة متدرب أو مرحلة البوردنق
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { traineeId, action, ...data } = body;

  if (!traineeId)
    return NextResponse.json({ error: "Missing traineeId" }, { status: 400 });

  const ref = adminDb.collection("trainees").doc(traineeId);

  if (action === "updateStatus") {
    const allowedStatuses = new Set(["onboarding", "active", "paused", "withdrawn", "terminated", "completed"]);
    if (!allowedStatuses.has(String(data.status)))
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    await ref.update({
      status: data.status,
      updatedAt: new Date().toISOString(),
    });
    await logActivity({
      type: "admin_status_override",
      message: `عدّلت الإدارة حالة المتدرب إلى ${data.status}`,
      traineeId,
      meta: { status: data.status, adminOverride: true },
    });
  } else if (action === "updateOnboarding") {
    const allowedStages = new Set(["initial_interview", "awaiting_decisions", "interview_declined", "admin_review", "contracting", "ready_assignment"]);
    if (!allowedStages.has(String(data.stage)))
      return NextResponse.json({ error: "INVALID_ONBOARDING_STAGE" }, { status: 400 });
    await ref.update({
      onboardingStage: data.stage,
      updatedAt: new Date().toISOString(),
    });
  } else if (action === "assign") {
    const traineeBefore = await ref.get();
    if (!traineeBefore.exists)
      return NextResponse.json({ error: "Trainee not found" }, { status: 404 });
    const traineeData = traineeBefore.data() as any;
    const assignmentStart = /^\d{4}-\d{2}-\d{2}$/.test(String(data.startDate || ""))
      ? String(data.startDate)
      : new Date().toISOString().slice(0, 10);
    const supervisorId = String(data.supervisorId || "");
    const supervisorRecord = await adminDb.collection("supervisors").doc(supervisorId).get();
    if (!supervisorRecord.exists || supervisorRecord.data()?.isActive === false || supervisorRecord.data()?.accountType === "consultant") {
      return NextResponse.json({ error: "INVALID_ACTIVE_SUPERVISOR" }, { status: 400 });
    }
    // Administrators are intentionally allowed to override continuation and
    // onboarding state. The override is recorded in assignments/activity log.
    const isTransfer = Boolean(traineeData.currentSupervisorId && traineeData.currentSupervisorId !== supervisorId);
    const normalizedEmail = String(traineeData.email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail)
      return NextResponse.json(
        { error: "Trainee email is required" },
        { status: 400 },
      );
    const supervisorWithEmail = await adminDb
      .collection("supervisors")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (
      normalizedEmail === process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
      !supervisorWithEmail.empty
    ) {
      return NextResponse.json(
        { error: "EMAIL_ROLE_CONFLICT" },
        { status: 409 },
      );
    }
    let authUser;
    try {
      authUser = await adminAuth.getUserByEmail(normalizedEmail);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") {
        console.error("Trainee auth lookup failed:", error);
        return NextResponse.json(
          { error: error?.code || "AUTH_LOOKUP_FAILED" },
          { status: 500 },
        );
      }
      try {
        authUser = await adminAuth.createUser({
          email: normalizedEmail,
          displayName: traineeData.name,
          emailVerified: false,
        });
      } catch (createError: any) {
        console.error("Trainee auth creation failed:", createError);
        return NextResponse.json(
          { error: createError?.code || "AUTH_CREATE_FAILED" },
          { status: 500 },
        );
      }
    }
    const selfRegistered =
      traineeData.accountStatus === "active" &&
      traineeData.authUid === authUser.uid;
    let resetLink = "";
    try {
      await adminAuth.setCustomUserClaims(authUser.uid, {
        role: "trainee",
        traineeId,
      });
      // Use Firebase's hosted password setup flow. A custom continue URL would
      // fail unless every deployment domain is allow-listed in Firebase Auth.
      if (!selfRegistered) {
        const firebaseResetLink =
          await adminAuth.generatePasswordResetLink(normalizedEmail);
        const actionCode = new URL(firebaseResetLink).searchParams.get(
          "oobCode",
        );
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://super-gray-zeta.vercel.app";
        resetLink = actionCode
          ? `${appUrl}/ar/setup-password?oobCode=${encodeURIComponent(actionCode)}`
          : firebaseResetLink;
      }
    } catch (linkError: any) {
      console.error("Trainee invitation link failed:", linkError);
      return NextResponse.json(
        { error: linkError?.code || "INVITE_LINK_FAILED" },
        { status: 500 },
      );
    }
    const batch = adminDb.batch();
    batch.update(ref, {
      currentSupervisorId: supervisorId,
      status: "active",
      onboardingStage: null,
      assignmentStatus: "active",
      authUid: authUser.uid,
      accountStatus: selfRegistered ? "active" : "invited",
      fieldworkStartDate: traineeData.fieldworkStartDate || assignmentStart,
      courseworkStartDate: traineeData.courseworkStartDate || data.courseworkStartDate || assignmentStart,
      updatedAt: new Date().toISOString(),
    });
    if (isTransfer) {
      const activeAssignments = await adminDb.collection("assignments")
        .where("traineeId", "==", traineeId).where("status", "==", "active").get();
      activeAssignments.docs.forEach((assignment) => batch.update(assignment.ref, {
        status: "completed",
        endDate: assignmentStart,
        endedBy: "admin",
        updatedAt: new Date().toISOString(),
      }));
    }
    const assignRef = adminDb.collection("assignments").doc();
    batch.set(assignRef, {
      traineeId,
      supervisorId,
      startDate: assignmentStart,
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      createdBy: "admin",
      adminOverride: true,
      status: "active",
    });
    await batch.commit();
    if (action === "assign") {
      const { logActivity } = await import("@/lib/activityLog");
      const supSnap = await adminDb
        .collection("supervisors")
        .doc(supervisorId)
        .get();
      const traineeSnap = await adminDb
        .collection("trainees")
        .doc(traineeId)
        .get();
      const supName = supSnap.exists
        ? (supSnap.data() as any).name
        : supervisorId;
      const traineeName = traineeSnap.exists
        ? (traineeSnap.data() as any).name
        : traineeId;
      await logActivity({
        type: "assigned",
        message: `تم إسناد ${traineeName} للمشرف ${supName}`,
        supervisorId,
        traineeId,
        meta: { startDate: assignmentStart, adminOverride: true, isTransfer },
      });
      if (!selfRegistered) {
        const { sendTraineeInvitationEmail } =
          await import("@/lib/email/emailService");
        try {
          await sendTraineeInvitationEmail({
            name: traineeName,
            email: normalizedEmail,
            resetLink,
            supervisorName: supName,
          });
        } catch (emailError) {
          console.error("Trainee invitation email failed:", emailError);
          return NextResponse.json({
            success: true,
            inviteLink: resetLink,
            warning: "EMAIL_FAILED",
          });
        }
        if (!process.env.EMAIL_SERVICE_API_KEY) {
          return NextResponse.json({ success: true, inviteLink: resetLink });
        }
      }
    } else if (action === "updateOnboarding") {
      const { logActivity } = await import("@/lib/activityLog");
      const traineeSnap = await adminDb
        .collection("trainees")
        .doc(traineeId)
        .get();
      const traineeName = traineeSnap.exists
        ? (traineeSnap.data() as any).name
        : traineeId;
      const stageLabels: Record<string, string> = {
        initial_interview: "مقابلة أولية",
        post_interview: "بانتظار قرار الطرفين",
        awaiting_decisions: "بانتظار قرار الطرفين",
        admin_review: "مراجعة الإدارة",
        contracting: "التعاقد والموافقات",
        ready_assignment: "جاهز للإسناد",
      };
      await logActivity({
        type: "onboarding",
        message: `انتقل ${traineeName} لمرحلة ${stageLabels[data.stage] || data.stage}`,
        traineeId,
        meta: { stage: data.stage },
      });
    }
  }

  return NextResponse.json({ success: true });
}

// قفل / فتح شهر
export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supervisorId, traineeId, month, action } = await req.json();
  if (!traineeId || !/^\d{4}-\d{2}$/.test(String(month)))
    return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
  const ref = adminDb.collection("monthlyApprovals").doc(`${traineeId}_${month}`);

  if (action === "lock") {
    await ref.set({
      traineeId,
      supervisorId: supervisorId || null,
      month,
      locked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: "admin",
      updatedAt: new Date().toISOString(),
      adminOverride: true,
    }, { merge: true });
  } else if (action === "unlock") {
    await ref.set({
      locked: false,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date().toISOString(),
      reopenedBy: "admin",
    }, { merge: true });
  }

  return NextResponse.json({ success: true });
}
