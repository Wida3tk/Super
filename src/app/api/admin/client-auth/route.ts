import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json();
    const uid = String(body.uid || "");
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    if (!uid || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "INVALID_DATA" }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });
    }
    const clientRef = adminDb.collection("clients").doc(uid);
    const client = await clientRef.get();
    if (!client.exists)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const previousEmail = String(client.data()?.email || "").toLowerCase();
    await adminAuth.updateUser(uid, {
      email,
      displayName: name,
      ...(password ? { password } : {}),
    });
    await clientRef.update({
      email,
      name,
      phone,
      updatedAt: new Date().toISOString(),
    });

    if (previousEmail && previousEmail !== email) {
      const bookings = await adminDb
        .collection("bookings")
        .where("studentEmail", "==", previousEmail)
        .get();
      for (let offset = 0; offset < bookings.docs.length; offset += 450) {
        const batch = adminDb.batch();
        bookings.docs
          .slice(offset, offset + 450)
          .forEach((doc) => batch.update(doc.ref, { studentEmail: email }));
        await batch.commit();
      }
    }
    return NextResponse.json({ success: true });
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
