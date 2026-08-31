import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return false;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return (
      decoded.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, message, targetType, targetId } = await req.json();
  if (!type || !message)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const isAllSupervisors = targetType === "all" || targetType === "all_supervisors";
  const isAllTrainees = targetType === "all_trainees";
  if (isAllSupervisors || isAllTrainees) {
    const audienceCollection = isAllSupervisors ? "supervisors" : "trainees";
    const recipientField = isAllSupervisors ? "supervisorId" : "traineeId";
    const audienceSnap = await adminDb.collection(audienceCollection).get();
    const batch = adminDb.batch();
    audienceSnap.docs.forEach((doc) => {
      const ref = adminDb.collection("notifications").doc();
      batch.set(ref, {
        type,
        message,
        targetType: isAllSupervisors ? "all_supervisors" : "all_trainees",
        [recipientField]: doc.id,
        targetId: doc.id,
        targetName: doc.data().name || "",
        read: false,
        createdAt: createdAt.toISOString(),
        expiresAt,
      });
    });
    await batch.commit();
    const ref = await adminDb.collection("notificationCampaigns").add({
      type,
      message,
      targetType: isAllSupervisors ? "all_supervisors" : "all_trainees",
      read: false,
      createdAt: createdAt.toISOString(),
      expiresAt,
    });
    return NextResponse.json({ id: ref.id });
  }

  const recipientCollection = targetType === "trainee" ? "trainees" : "supervisors";
  const recipientField = targetType === "trainee" ? "traineeId" : "supervisorId";
  const recipientSnap = await adminDb.collection(recipientCollection).doc(targetId).get();
  if (!recipientSnap.exists)
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  const ref = await adminDb.collection("notifications").add({
    type,
    message,
    targetType,
    [recipientField]: targetId,
    targetId,
    targetName: recipientSnap.data()?.name || "",
    read: false,
    createdAt: createdAt.toISOString(),
    expiresAt,
  });

  return NextResponse.json({ id: ref.id });
}
