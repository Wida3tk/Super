import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_MAP: Record<string, string> = {
  "Direct (With Client)": "direct",
  "Indirect (Without Client)": "indirect",
  "Supervision (Direct)": "supervision_direct",
  "Supervision (Indirect)": "supervision_indirect",
};

function scalar(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object" && "result" in value) {
    return value.result;
  }
  return value;
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dotted = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    return `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }
  return "";
}

function timeValue(value: unknown) {
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round(value * 24 * 60);
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return String(value || "").trim().slice(0, 5);
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const file = form.get("file");
    const license = String(form.get("license") || "");
    if (!(file instanceof File) || !["QASP-S", "QBA"].includes(license)) {
      return NextResponse.json({ error: "INVALID_FILE_OR_LICENSE" }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
    const infoSheet = workbook.getWorksheet("Supervisee Information");
    if (!infoSheet) {
      return NextResponse.json({ error: "UNSUPPORTED_TRACKER_FILE" }, { status: 400 });
    }
    const name = String(scalar(infoSheet.getCell("C5").value) || "").trim();
    const email = String(scalar(infoSheet.getCell("C6").value) || "").trim().toLowerCase();
    const startDate = dateValue(scalar(infoSheet.getCell("C10").value));
    if (!name || !email.includes("@") || !startDate) {
      return NextResponse.json({ error: "MISSING_TRAINEE_INFORMATION" }, { status: 400 });
    }

    const activities: Array<Record<string, unknown>> = [];
    for (let month = 1; month <= 20; month += 1) {
      const sheet = workbook.getWorksheet(`Month ${month}`);
      if (!sheet) continue;
      for (let rowNumber = 10; rowNumber <= Math.min(sheet.rowCount, 1000); rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        const activityType = TYPE_MAP[String(scalar(row.getCell(6).value) || "").trim()];
        const duration = Number(scalar(row.getCell(10).value));
        const date = dateValue(scalar(row.getCell(2).value));
        if (!activityType || !date || !Number.isFinite(duration) || duration <= 0) continue;
        activities.push({
          sourceMonth: month,
          sourceRow: rowNumber,
          date,
          startTime: timeValue(scalar(row.getCell(4).value)),
          endTime: timeValue(scalar(row.getCell(5).value)),
          duration,
          activityType,
          setting: String(scalar(row.getCell(7).value) || "").trim(),
          format: String(scalar(row.getCell(8).value) || "").trim(),
          observedWithClient: String(scalar(row.getCell(9).value) || "").trim(),
          description: String(scalar(row.getCell(11).value) || "").trim(),
        });
      }
    }
    if (!activities.length) {
      return NextResponse.json({ error: "NO_VALID_ACTIVITIES" }, { status: 400 });
    }
    const totalSupervision = activities
      .filter((row) => String(row.activityType).startsWith("supervision_"))
      .reduce((sum, row) => sum + Number(row.duration), 0);

    return NextResponse.json({
      trainees: [
        {
          info: { name, email, supervisionStartDate: startDate },
          supervisorSummary: { license, totalSupervision },
          activities,
        },
      ],
      summary: {
        name,
        email,
        license,
        activityCount: activities.length,
        fieldworkHours: activities
          .filter((row) => ["direct", "indirect"].includes(String(row.activityType)))
          .reduce((sum, row) => sum + Number(row.duration), 0),
        supervisionHours: totalSupervision,
      },
    });
  } catch (error) {
    console.error("Tracker parse failed", error);
    return NextResponse.json({ error: "TRACKER_PARSE_FAILED" }, { status: 400 });
  }
}
