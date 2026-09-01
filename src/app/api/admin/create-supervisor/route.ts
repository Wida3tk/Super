import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { adminDb, adminAuth } = await import("@/lib/firebase/admin");

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (
      decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, email, password, bio, accountType } = await request.json();
    if (!name || !email || !password) {
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
        bio: bio || "",
        isActive: true,
        totalSessions: 0,
        ratingAverage: 0,
        createdAt: new Date().toISOString(),
        accountType: accountType === "consultant" ? "consultant" : "supervisor",
        authUid: userRecord.uid,
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
