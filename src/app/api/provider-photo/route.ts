export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const session = (await cookies()).get("__session")?.value;
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const decoded = await adminAuth
    .verifySessionCookie(session, true)
    .catch(() => null);
  if (
    !decoded ||
    decoded.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await req.formData();
  const providerId = String(form.get("providerId") || "");
  const file = form.get("file");
  const provider = await adminDb
    .collection("supervisors")
    .doc(providerId)
    .get();
  if (!provider.exists)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (
    !(file instanceof File) ||
    !allowed.has(file.type) ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  )
    return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `provider-photos/${providerId}/${Date.now()}.${ext}`;
  await adminStorage
    .bucket()
    .file(path)
    .save(Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      metadata: { cacheControl: "public,max-age=86400" },
    });
  const photo = `/api/provider-photo?id=${encodeURIComponent(providerId)}`;
  await provider.ref.update({
    photo,
    photoPath: path,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true, photo });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const provider = await adminDb.collection("supervisors").doc(id).get();
  if (
    !provider.exists ||
    provider.data()?.isActive === false ||
    !provider.data()?.photoPath
  )
    return new NextResponse(null, { status: 404 });
  const target = adminStorage.bucket().file(String(provider.data()!.photoPath));
  const [[meta], [buffer]] = await Promise.all([
    target.getMetadata(),
    target.download(),
  ]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": meta.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
