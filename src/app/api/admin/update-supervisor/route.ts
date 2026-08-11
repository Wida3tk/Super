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

    const {
      id,
      name,
      bio,
      specialization,
      photo,
      isActive,
      credentialType,
      credentialNumber,
      credentialExpiresAt,
      supervisionTrainingCompleted,
      accountType,
    } = await request.json();
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (specialization !== undefined)
      updateData.specialization = specialization;
    if (photo !== undefined) updateData.photo = photo;
    if (credentialType !== undefined)
      updateData.credentialType = String(credentialType).slice(0, 50);
    if (credentialNumber !== undefined)
      updateData.credentialNumber = String(credentialNumber).slice(0, 100);
    if (credentialExpiresAt !== undefined)
      updateData.credentialExpiresAt = String(credentialExpiresAt).slice(0, 10);
    if (supervisionTrainingCompleted !== undefined)
      updateData.supervisionTrainingCompleted = Boolean(
        supervisionTrainingCompleted,
      );
    if (isActive !== undefined) updateData.isActive = isActive;
    if (accountType !== undefined)
      updateData.accountType =
        accountType === "consultant" ? "consultant" : "supervisor";

    await adminDb.collection("supervisors").doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
