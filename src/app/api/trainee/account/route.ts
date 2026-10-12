import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
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
    if (body.email !== undefined || body.phone !== undefined) {
      return NextResponse.json({ error: "ADMIN_MANAGED_CONTACT" }, { status: 403 });
    }
    const password = String(body.password || "");
    if (password.length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }

    await adminAuth.updateUser(sessionUser.uid, { password });
    await adminAuth.revokeRefreshTokens(sessionUser.uid);
    const response = NextResponse.json({ success: true, signedOut: true });
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
