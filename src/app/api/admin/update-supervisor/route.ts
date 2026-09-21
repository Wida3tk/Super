import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function POST(request: NextRequest) {
  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    if (!(await requireAdmin()))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    if (bio !== undefined && !String(bio).trim())
      return NextResponse.json({ error: "BIO_REQUIRED" }, { status: 400 });

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = String(bio).trim();
    updateData.publicProfileId = id;
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
  } catch {
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
