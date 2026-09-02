import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/serverAuth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text || "").trim();
    if ("hyperlink" in value) return String((value as { text?: string; hyperlink?: string }).text || (value as { hyperlink?: string }).hyperlink || "").replace(/^mailto:/, "").trim();
    if ("result" in value) return String(value.result || "").trim();
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const commit = form.get("commit") === "true";
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "INVALID_XLSX" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
    const sheet = workbook.getWorksheet("لوحة المعلومات الرئيسية");
    if (!sheet) return NextResponse.json({ error: "UNSUPPORTED_SUPERVISOR_FILE" }, { status: 400 });
    const name = cellText(sheet.getCell("E2").value) || cellText(sheet.getCell("F2").value);
    let email = cellText(sheet.getCell("E3").value) || cellText(sheet.getCell("F3").value);
    const credential = cellText(sheet.getCell("E4").value) || cellText(sheet.getCell("F4").value);
    const availableSeats = Math.max(0, Number(sheet.getCell("I4").result ?? sheet.getCell("I4").value) || 0);
    if (!email.includes("@")) {
      sheet.getRows(1, 8)?.forEach((row) => row.eachCell((cell) => { const candidate = cellText(cell.value); if (!email.includes("@") && candidate.includes("@")) email = candidate; }));
    }
    email = email.toLowerCase().replace(/^mailto:/, "");
    if (!name || !email.includes("@")) return NextResponse.json({ error: "MISSING_SUPERVISOR_INFORMATION" }, { status: 400 });
    const preview = { name, email, credential, availableSeats, accountType: "supervisor", sourceFile: file.name };
    if (!commit) return NextResponse.json({ ok: true, preview });
    const duplicate = await adminDb.collection("supervisors").where("email", "==", email).limit(1).get();
    let authUid = String(duplicate.docs[0]?.data().authUid || "");
    if (!authUid) {
      try { authUid = (await adminAuth.getUserByEmail(email)).uid; }
      catch { authUid = (await adminAuth.createUser({ email, displayName: name })).uid; }
    }
    const ref = duplicate.empty ? adminDb.collection("supervisors").doc() : duplicate.docs[0].ref;
    await ref.set({ ...preview, authUid, isActive: true, accountStatus: "prepared", updatedAt: new Date().toISOString(), ...(duplicate.empty ? { createdAt: new Date().toISOString() } : {}) }, { merge: true });
    await adminAuth.setCustomUserClaims(authUid, { role: "supervisor", supervisorId: ref.id });
    return NextResponse.json({ ok: true, supervisorId: ref.id, created: duplicate.empty, accountStatus: "prepared", emailSent: false, preview });
  } catch (error) {
    console.error("Supervisor import failed", error);
    return NextResponse.json({ error: "SUPERVISOR_IMPORT_FAILED" }, { status: 400 });
  }
}
