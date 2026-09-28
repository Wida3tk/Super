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
  if (sessionUser.isDemo || trainee.isDemo) {
    return NextResponse.json({ error: "DEMO_READ_ONLY_ACCOUNT" }, { status: 403 });
  }

  const authenticatedAt = Number(sessionUser.auth_time || 0) * 1000;
  if (!authenticatedAt || Date.now() - authenticatedAt > 10 * 60 * 1000) {
    return NextResponse.json(
      { error: "RECENT_LOGIN_REQUIRED" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone ?? trainee.phone ?? "").trim();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }
    if (phone && !/^\+?[\d\s-]{8,15}$/.test(phone)) {
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
    await adminAuth.revokeRefreshTokens(sessionUser.uid);
    const response = NextResponse.json({ success: true, email, phone, signedOut: true });
    response.cookies.set("__session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
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
