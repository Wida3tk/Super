export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { withDeadline } from "@/lib/asyncDeadline";
import {
  enforceRateLimit,
  getRequestIdentifier,
} from "@/lib/security/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const { token, portal } = await request.json();
    if (typeof token !== "string" || !token || token.length > 10000) {
      return NextResponse.json({ error: "NO_TOKEN" }, { status: 400 });
    }
    const rateLimit = await withDeadline(enforceRateLimit(getRequestIdentifier(request), {
      action: "session",
      limit: 20,
      windowMs: 15 * 60 * 1000,
    }), 8000);
    if (!rateLimit.allowed)
      return NextResponse.json(
        { error: "TOO_MANY_ATTEMPTS" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (e: any) {
      console.error("verifyIdToken failed:", e.message);
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });
    }

    let sessionCookie;
    try {
      sessionCookie = await adminAuth.createSessionCookie(token, {
        expiresIn: 60 * 60 * 24 * 14 * 1000,
      });
    } catch (e: any) {
      console.error("createSessionCookie failed:", e.message);
      return NextResponse.json({ error: "SESSION_FAILED" }, { status: 500 });
    }

    const email = decoded.email?.trim().toLowerCase() || "";
    const isAdmin = email === process.env.ADMIN_EMAIL?.trim().toLowerCase();
    let role: "admin" | "supervisor" | "trainee" | "client" | "unknown" =
      isAdmin ? "admin" : "unknown";
    if (!isAdmin && email) {
      const supervisor = await withDeadline(adminDb
          .collection("supervisors")
          .where("email", "==", email)
          .limit(1)
          .get(), 8000);
      if (!supervisor.empty) role = "supervisor";
      else {
        const trainee = await withDeadline(adminDb
          .collection("trainees")
          .where("email", "==", email)
          .limit(1)
          .get(), 8000);
        if (!trainee.empty) role = "trainee";
        else if ((await withDeadline(adminDb.collection("clients").doc(decoded.uid).get(), 8000)).exists) role = "client";
      }
    }

    if (portal === "admin" && role !== "admin") {
      return NextResponse.json({ error: "ADMIN_ONLY" }, { status: 403 });
    }

    const response = NextResponse.json({ success: true, isAdmin, role });
    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Session API error:", error.message);
    if (error?.code === 8 || error?.message === "REQUEST_TIMEOUT") return NextResponse.json({ error: "SERVICE_BUSY" }, { status: 503, headers: { "Retry-After": "60" } });
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
