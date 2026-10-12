import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { normalizeIdentityEmail, normalizeIdentityPhone } from "@/lib/identity/normalize";
import { logActivity } from "@/lib/activityLog";
import type { UserRecord } from "firebase-admin/auth";

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json();
  const name = String(body.name || "").trim();
  const email = normalizeIdentityEmail(body.email);
  const phone = normalizeIdentityPhone(body.phone);
  if (email === normalizeIdentityEmail(process.env.ADMIN_EMAIL))
    return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
  if (!name || name.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (body.phone && !phone) || typeof body.traineeId !== "string")
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const ref = adminDb.collection("trainees").doc(body.traineeId);
  const before = await ref.get();
  if (!before.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const old = before.data()!;
  const matches = await adminDb.collection("trainees").where("email", "==", email).get();
  if (matches.docs.some((doc) => doc.id !== ref.id)) return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
  let user: UserRecord | undefined;
  try {
    user = old.authUid ? await adminAuth.getUser(old.authUid) : await adminAuth.getUserByEmail(old.email);
  } catch (error: any) {
    if (error.code !== "auth/user-not-found") return NextResponse.json({ error: "AUTH_FAILED" }, { status: 500 });
  }
  const key = (kind: string, value: string) => adminDb.collection("identityKeys").doc(`${kind}_${createHash("sha256").update(value).digest("hex")}`);
  const emailRef = key("email", email);
  const phoneRef = phone ? key("phone", phone) : null;
  let authChanged = false;
  let committed = false;
  try {
    // Lock both identity reservations and the profile while updating Auth.
    // Auth update is idempotent if Firestore retries the transaction.
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.data()?.email !== old.email || current.data()?.phone !== old.phone) throw new Error("PROFILE_CHANGED");
      const emailKey = await tx.get(emailRef);
      const phoneKey = phoneRef ? await tx.get(phoneRef) : null;
      if ((emailKey.exists && emailKey.data()?.traineeId !== ref.id) || (phoneKey?.exists && phoneKey.data()?.traineeId !== ref.id)) throw new Error("IDENTITY_EXISTS");
      const oldEmailRef = key("email", normalizeIdentityEmail(old.email));
      const oldPhone = normalizeIdentityPhone(old.phone);
      const oldPhoneRef = oldPhone ? key("phone", oldPhone) : null;
      const oldEmailKey = await tx.get(oldEmailRef);
      const oldPhoneKey = oldPhoneRef ? await tx.get(oldPhoneRef) : null;
      const bookings = email !== old.email
        ? await tx.get(adminDb.collection("bookings").where("studentEmail", "==", old.email))
        : null;
      if (bookings && bookings.size > 400) throw new Error("TOO_MANY_BOOKINGS");
      if (user) { await adminAuth.updateUser(user.uid, { email, displayName: name }); authChanged = true; }
      const now = new Date().toISOString();
      tx.update(ref, { name, email, phone, updatedAt: now });
      bookings?.docs.forEach((booking) => tx.update(booking.ref, { studentEmail: email }));
      tx.set(emailRef, { kind: "email", value: email, traineeId: ref.id });
      if (phoneRef) tx.set(phoneRef, { kind: "phone", value: phone, traineeId: ref.id });
      if (oldEmailRef.id !== emailRef.id && oldEmailKey.data()?.traineeId === ref.id) tx.delete(oldEmailRef);
      if (oldPhoneRef && oldPhoneRef.id !== phoneRef?.id && oldPhoneKey?.data()?.traineeId === ref.id) tx.delete(oldPhoneRef);
    });
    committed = true;
    if (user && email !== old.email) await adminAuth.revokeRefreshTokens(user.uid);
    await logActivity({ type: "admin_trainee_profile", message: `حدّثت الإدارة بيانات ${name}`, traineeId: ref.id });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (!committed && authChanged && user) await adminAuth.updateUser(user.uid, { email: old.email, displayName: old.name }).catch((rollbackError) => console.error("Trainee profile Auth rollback failed", rollbackError.code));
    const conflict = ["IDENTITY_EXISTS", "PROFILE_CHANGED", "auth/email-already-exists"].includes(error.message) || error.code === "auth/email-already-exists";
    return NextResponse.json({ error: conflict ? "IDENTITY_EXISTS" : "UPDATE_FAILED" }, { status: conflict ? 409 : 500 });
  }
}
