import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(request: NextRequest) {
  try {
    const { adminDb, adminAuth } = await import("@/lib/firebase/admin");

    if (!(await requireAdmin()))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email, password, bio, accountType } = await request.json();
    const cleanBio = String(bio || "").trim();
    if (!name || !email || !password || !cleanBio) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    await adminDb
      .collection("supervisors")
      .doc(userRecord.uid)
      .set({
        name,
        email,
        bio: cleanBio,
        isActive: true,
        totalSessions: 0,
        ratingAverage: 0,
        createdAt: new Date().toISOString(),
        accountType: accountType === "consultant" ? "consultant" : "supervisor",
        authUid: userRecord.uid,
        publicProfileId: userRecord.uid,
        profileCreatedAt: new Date().toISOString(),
        availableSeats: 0,
      });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    const msg =
      error.code === "auth/email-already-exists"
        ? "EMAIL_EXISTS"
        : "SERVER_ERROR";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
