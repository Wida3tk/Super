import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json();
    const uid = String(body.uid || "");
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const action = String(body.action || "update");
    if (!uid || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    const clientRef = adminDb.collection("clients").doc(uid);
    const client = await clientRef.get();
    if (!client.exists)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const previousEmail = String(client.data()?.email || "").toLowerCase();

    if (action === "promoteToTrainee") {
      const clientData = client.data() as any;
      const existing = await adminDb
        .collection("trainees")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!existing.empty) {
        return NextResponse.json(
          { error: "TRAINEE_ALREADY_EXISTS", traineeId: existing.docs[0].id },
          { status: 409 },
        );
      }

      const license = clientData.license === "assistant_behavior_analyst" ? "QASP-S" : "QBA";
      const requiredHours = license === "QASP-S" ? 1000 : 2000;
      const supervisionTargetHours = license === "QASP-S" ? 50 : 100;
      const now = new Date().toISOString();
      const traineeRef = adminDb.collection("trainees").doc(uid);
      const batch = adminDb.batch();
      batch.set(traineeRef, {
        name,
        email,
        phone,
        license,
        requiredHours,
        fieldworkTargetHours: requiredHours,
        supervisionTargetHours,
        status: "onboarding",
        onboardingStage: "initial_interview",
        lifecycleStage: "initial_interview",
        lifecycleStageChangedAt: now,
        serviceAccessEnabled: false,
        currentSupervisorId: null,
        totalIndividualHours: 0,
        totalGroupHours: 0,
        totalHours: 0,
        authUid: uid,
        accountStatus: "active",
        sourceClientId: uid,
        createdAt: now,
        updatedAt: now,
      });
      batch.set(adminDb.collection("traineeLifecycleTransitions").doc(), {
        traineeId: uid,
        fromStage: "registered",
        toStage: "initial_interview",
        reason: "إضافة المسجل كمتدرب من الإدارة",
        changedAt: now,
        changedMonth: now.slice(0, 7),
        changedBy: "admin",
      });
      batch.update(clientRef, { promotedToTraineeId: uid, promotedAt: now, updatedAt: now });
      await batch.commit();
      await adminAuth.updateUser(uid, { email, displayName: name });
      await adminAuth.setCustomUserClaims(uid, { role: "trainee", traineeId: uid });
      return NextResponse.json({ success: true, traineeId: uid });
    }

    await adminAuth.updateUser(uid, {
      email,
      displayName: name,
      ...(password ? { password } : {}),
    });
    await clientRef.update({
      email,
      name,
      phone,
      updatedAt: new Date().toISOString(),
    });

    if (previousEmail && previousEmail !== email) {
      const bookings = await adminDb
        .collection("bookings")
        .where("studentEmail", "==", previousEmail)
        .get();
      for (let offset = 0; offset < bookings.docs.length; offset += 450) {
        const batch = adminDb.batch();
        bookings.docs
          .slice(offset, offset + 450)
          .forEach((doc) => batch.update(doc.ref, { studentEmail: email }));
        await batch.commit();
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const code =
      error?.code === "auth/email-already-exists"
        ? "EMAIL_EXISTS"
        : "SERVER_ERROR";
    return NextResponse.json(
      { error: code },
      { status: code === "EMAIL_EXISTS" ? 409 : 500 },
    );
  }
}
