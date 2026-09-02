import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone || "").trim();
    const bookingIntent =
      body.bookingIntent === "consultation"
        ? "consultation"
        : "initial_interview";
    const license = String(body.license || "");
    const qualification = String(body.qualification || "").trim();
    const password = String(body.password || "");
    const arabicWords = name.split(" ").filter(Boolean);
    if (arabicWords.length < 3 || !/^[\u0600-\u06FF\s]+$/.test(name))
      return NextResponse.json(
        { error: "INVALID_ARABIC_NAME" },
        { status: 400 },
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    if (!/^\+?[\d\s-]{8,15}$/.test(phone))
      return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    const allowedLicenses =
      bookingIntent === "consultation"
        ? ["consultant", "expert"]
        : [
            "behavior_analyst",
            "assistant_behavior_analyst",
            "post_license_supervision",
          ];
    if (
      !allowedLicenses.includes(license) ||
      (bookingIntent === "initial_interview" && !qualification)
    )
      return NextResponse.json({ error: "INVALID_PROFILE" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    const user = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    batch.set(adminDb.collection("clients").doc(user.uid), {
      name,
      email,
      phone,
      bookingIntent,
      license,
      qualification: bookingIntent === "initial_interview" ? qualification : "",
      createdAt: now,
      updatedAt: now,
    });
    if (bookingIntent === "initial_interview") {
      const traineeLicense =
        license === "assistant_behavior_analyst" ? "QASP-S" : "QBA";
      const requiredHours = traineeLicense === "QASP-S" ? 1000 : 2000;
      const supervisionTargetHours = traineeLicense === "QASP-S" ? 50 : 100;
      batch.set(adminDb.collection("trainees").doc(user.uid), {
        name,
        email,
        phone,
        qualification,
        license: traineeLicense,
        requestedLicense: license,
        requiredHours,
        fieldworkTargetHours: requiredHours,
        supervisionTargetHours,
        status: "onboarding",
        lifecycleStage: "registered",
        lifecycleStageChangedAt: new Date().toISOString(),
        serviceAccessEnabled: false,
        onboardingStage: "initial_interview",
        currentSupervisorId: null,
        totalIndividualHours: 0,
        totalGroupHours: 0,
        totalHours: 0,
        authUid: user.uid,
        accountStatus: "active",
        registrationSource: "self_registration",
        createdAt: now,
        updatedAt: now,
      });
      batch.set(adminDb.collection("notifications").doc(), {
        type: "trainee_self_registered",
        message: `تسجيل متدرب جديد: ${name}`,
        targetType: "admin",
        traineeId: user.uid,
        read: false,
        createdAt: now,
      });
      batch.set(adminDb.collection("traineeLifecycleTransitions").doc(), {
        traineeId: user.uid, fromStage: null, toStage: "registered",
        reason: "تسجيل متدرب جديد", changedAt: now, changedMonth: now.slice(0, 7), changedBy: "self_registration",
      });
    }
    await batch.commit();
    return NextResponse.json({
      success: true,
      accountType: bookingIntent === "initial_interview" ? "trainee" : "client",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.code === "auth/email-already-exists"
            ? "EMAIL_EXISTS"
            : "SERVER_ERROR",
      },
      { status: error?.code === "auth/email-already-exists" ? 409 : 500 },
    );
  }
}
