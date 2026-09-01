import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedSupervisor } from "@/lib/auth/serverAuth";

// تحديد إشعار كمقروء
export async function PATCH(req: NextRequest) {
  const supervisor = await getAuthenticatedSupervisor();
  if (!supervisor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notificationId } = await req.json();
  if (!notificationId)
    return NextResponse.json(
      { error: "Missing notificationId" },
      { status: 400 },
    );

  const notificationRef = adminDb
    .collection("notifications")
    .doc(notificationId);
  const notification = await notificationRef.get();
  if (
    !notification.exists ||
    notification.data()?.supervisorId !== supervisor.id
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await notificationRef.update({
    read: true,
    readAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
