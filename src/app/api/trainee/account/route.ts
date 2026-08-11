import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee, getSessionUser } from "@/lib/auth/serverAuth";

export async function PATCH(request: NextRequest) {
  const [trainee, sessionUser] = await Promise.all([
    getAuthenticatedTrainee(),
    getSessionUser(),
  ]);
  if (!trainee || !sessionUser) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }
    if (!/^\+?[\d\s-]{8,15}$/.test(phone)) {
      return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }

    const previousEmail = String(trainee.email || "")
      .trim()
      .toLowerCase();
    await adminAuth.updateUser(sessionUser.uid, {
      email,
      ...(password ? { password } : {}),
    });
    await adminDb.collection("trainees").doc(trainee.id).update({
      email,
      phone,
      authUid: sessionUser.uid,
      updatedAt: new Date().toISOString(),
    });

    if (previousEmail && previousEmail !== email) {
      const bookings = await adminDb
        .collection("bookings")
        .where("studentEmail", "==", previousEmail)
        .get();
      const batch = adminDb.batch();
      bookings.docs.forEach((doc) =>
        batch.update(doc.ref, { studentEmail: email }),
      );
      if (!bookings.empty) await batch.commit();
    }
    return NextResponse.json({ success: true, email, phone });
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
