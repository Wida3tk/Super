export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

async function ensureAuthUser(uid: string, email: string, name: string, claims: Record<string, unknown>) {
  try {
    await adminAuth.getUser(uid);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") throw error;
    await adminAuth.createUser({ uid, email, displayName: name, emailVerified: true });
  }
  await adminAuth.setCustomUserClaims(uid, claims);
}

async function ensureDemoData(visitorId: string) {
  const now = new Date().toISOString();
  const month = now.slice(0, 7);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const suffix = visitorId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 36);
  const supervisorId = `demo-s-${suffix}`;
  const traineeId = `demo-t-${suffix}`;
  const secondTraineeId = `demo-t2-${suffix}`;
  const supervisorEmail = `supervisor+${suffix}@demo.sulukera.com`;
  const traineeEmail = `trainee+${suffix}@demo.sulukera.com`;
  await Promise.all([
    ensureAuthUser(supervisorId, supervisorEmail, "المشرف التجريبي", { role: "supervisor", supervisorId, isDemo: true }),
    ensureAuthUser(traineeId, traineeEmail, "المتدرب التجريبي", { role: "trainee", traineeId, isDemo: true }),
  ]);

  const batch = adminDb.batch();
  batch.set(adminDb.collection("supervisors").doc(supervisorId), {
    name: "المشرف التجريبي", email: supervisorEmail, isActive: true,
    accountType: "supervisor", availableSeats: 5, authUid: supervisorId,
    bio: "حساب مخصص لاستعراض رحلة الإشراف وجميع أدوات المشرف.", isDemo: true, demoVisitorId: visitorId, expiresAt, updatedAt: now,
  }, { merge: true });
  const baseTrainee = {
    license: "QASP-S", status: "active", lifecycleStage: "active_service",
    serviceAccessEnabled: true, currentSupervisorId: supervisorId,
    fieldworkTargetHours: 1000, requiredHours: 1000, supervisionTargetHours: 50,
    accountStatus: "active", isDemo: true, demoVisitorId: visitorId, expiresAt, updatedAt: now,
  };
  batch.set(adminDb.collection("trainees").doc(traineeId), {
    ...baseTrainee, name: "المتدرب التجريبي", email: traineeEmail,
    phone: "+966500000000", authUid: traineeId, approvedSupervisionHours: 18,
    approvedFieldworkHours: 360, totalIndividualHours: 14, totalGroupHours: 4,
  }, { merge: true });
  batch.set(adminDb.collection("trainees").doc(secondTraineeId), {
    ...baseTrainee, name: "متدرب تجريبي ثانٍ", email: `trainee2+${suffix}@demo.sulukera.com`,
    phone: "+966500000001", authUid: null, approvedSupervisionHours: 11,
    approvedFieldworkHours: 220, totalIndividualHours: 9, totalGroupHours: 2,
  }, { merge: true });
  batch.set(adminDb.collection("supervisionPlans").doc(traineeId), {
    traineeId, supervisorId, isDemo: true, demoVisitorId: visitorId, expiresAt, updatedAt: now,
    goals: [
      { id: "demo-goal-1", domain: "التقييم", title: "إتقان جمع البيانات وتحليلها", status: "in_progress", order: 0 },
      { id: "demo-goal-2", domain: "التدخل", title: "تصميم خطة تدخل قائمة على الأدلة", status: "not_started", order: 1 },
    ],
  }, { merge: true });
  batch.set(adminDb.collection("monthlySnapshots").doc(`${supervisorId}_${traineeId}_${month}`), {
    supervisorId, traineeId, month,
    workHours: 72, requiredHours: 3.6, individualHours: 3, groupHours: 1,
    totalHours: 4, groupPercentage: 25, absenceCount: 0, warningCount: 0, isDemo: true, updatedAt: now,
  }, { merge: true });
  await batch.commit();
  return { supervisorId, traineeId };
}

export async function POST(request: NextRequest) {
  try {
    const { role, visitorId } = await request.json();
    if (!['supervisor', 'trainee'].includes(role) || !/^[a-zA-Z0-9-]{16,80}$/.test(String(visitorId || ''))) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const demoIds = await ensureDemoData(String(visitorId));
    const now = new Date().toISOString();
    const visitRef = adminDb.collection("demoVisitors").doc(visitorId);
    const summaryRef = adminDb.collection("demoAnalytics").doc("summary");
    await adminDb.runTransaction(async (transaction) => {
      const [visit, summary] = await Promise.all([transaction.get(visitRef), transaction.get(summaryRef)]);
      transaction.set(visitRef, {
        firstSeenAt: visit.exists ? visit.data()?.firstSeenAt : now,
        lastSeenAt: now, launches: FieldValue.increment(1),
        [`${role}Launches`]: FieldValue.increment(1),
      }, { merge: true });
      transaction.set(summaryRef, {
        uniqueVisitors: FieldValue.increment(visit.exists ? 0 : 1),
        totalLaunches: FieldValue.increment(1),
        [`${role}Launches`]: FieldValue.increment(1), lastLaunchAt: now,
        ...(summary.exists ? {} : { createdAt: now }),
      }, { merge: true });
    });
    const uid = role === "supervisor" ? demoIds.supervisorId : demoIds.traineeId;
    const token = await adminAuth.createCustomToken(uid, { role, isDemo: true });
    return NextResponse.json({ token, destination: role === "supervisor" ? "/ar/supervisor-dashboard" : "/ar/trainee-dashboard" });
  } catch (error) {
    console.error("Demo start failed:", error);
    return NextResponse.json({ error: "DEMO_START_FAILED" }, { status: 500 });
  }
}
