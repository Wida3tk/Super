export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthenticatedTrainee, hasActiveTraineeService } from "@/lib/auth/serverAuth";

const labels: Record<string, string> = {
  direct: "مباشرة",
  indirect: "غير مباشرة",
  supervision_direct: "إشراف مباشر",
  supervision_indirect: "إشراف غير مباشر",
};
export async function GET(req: NextRequest) {
  const trainee = await getAuthenticatedTrainee();
  if (!trainee)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasActiveTraineeService(trainee))
    return NextResponse.json({ error: "ASSIGNMENT_REQUIRED" }, { status: 403 });
  const month = req.nextUrl.searchParams.get("month") || "";
  let locked = false;
  if (month) {
    const a = await adminDb
      .collection("monthlyApprovals")
      .doc(`${trainee.id}_${month}`)
      .get();
    locked = Boolean(a.exists && a.data()?.locked);
    if (!locked)
      return NextResponse.json({ error: "MONTH_NOT_LOCKED" }, { status: 409 });
  }
  const snap = await adminDb
    .collection("fieldworkActivities")
    .where("traineeId", "==", trainee.id)
    .limit(2000)
    .get();
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
  if (month)
    rows = rows.filter((x) => x.month === month && x.status === "approved");
  else rows = rows.filter((x) => x.status !== "rejected");
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const wb = new ExcelJS.Workbook();
  wb.creator = "سلوكيرا";
  const ws = wb.addWorksheet(month ? "Monthly Record" : "Draft Activity Log", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 6 }],
  });
  ws.columns = [
    { width: 7 },
    { width: 14 },
    { width: 13 },
    { width: 13 },
    { width: 11 },
    { width: 25 },
    { width: 28 },
    { width: 22 },
    { width: 18 },
    { width: 55 },
    { width: 18 },
  ];
  ws.mergeCells("A1:K1");
  ws.getCell("A1").value = locked
    ? `سلوكيرا — سجل شهر ${month} المغلق`
    : "سلوكيرا — نسخة مسودة غير معتمدة";
  ws.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: locked ? "FF001442" : "FF9A3412" },
  };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.getCell("A3").value = "المتدرب";
  ws.getCell("B3").value = trainee.name;
  ws.getCell("D3").value = "المسار";
  ws.getCell("E3").value = String((trainee as any).license || "");
  ws.getCell("G3").value = "حالة النسخة";
  ws.getCell("H3").value = locked ? "مغلقة ومعتمدة" : "مسودة";
  ws.getRow(6).values = [
    "#",
    "التاريخ",
    "البداية",
    "النهاية",
    "المدة",
    "نوع النشاط",
    "التصنيف",
    "المركز",
    "رمز المستفيد",
    "الوصف",
    "الحالة",
  ];
  ws.getRow(6).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(6).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0D40FC" },
  };
  rows.forEach((x, i) =>
    ws.addRow([
      i + 1,
      x.date,
      x.startTime,
      x.endTime,
      x.duration,
      labels[x.activityType] || x.activityType,
      x.activityCategory || "—",
      x.centerName || "—",
      x.clientCode || "—",
      x.description,
      x.status,
    ]),
  );
  ws.eachRow((r) => (r.alignment = { vertical: "middle", wrapText: true }));
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Sulukera_${month || "Draft"}_${trainee.name}.xlsx`)}`,
    },
  });
}
