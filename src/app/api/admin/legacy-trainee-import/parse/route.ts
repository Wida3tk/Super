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
  if (value && typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  return value;
}

function textValue(value: ExcelJS.CellValue) {
  return String(scalar(value) || "").trim();
}

function labeledValue(
  sheet: ExcelJS.Worksheet,
  labels: string[],
): ExcelJS.CellValue | null {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 30); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= Math.min(row.cellCount || 10, 10); column += 1) {
      const label = textValue(row.getCell(column).value).toLowerCase();
      if (!normalizedLabels.some((candidate) => label.includes(candidate))) continue;
      for (let valueColumn = column + 1; valueColumn <= Math.min(column + 2, 10); valueColumn += 1) {
        const value = row.getCell(valueColumn).value;
        if (textValue(value)) return value;
      }
    }
  }
  return null;
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
  const slashed = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slashed) {
    return `${slashed[3]}-${slashed[2].padStart(2, "0")}-${slashed[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
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
    const name = textValue(
      labeledValue(infoSheet, ["اسم المتدرب", "supervisee name", "trainee name"])
        || infoSheet.getCell("C5").value
        || infoSheet.getCell("B2").value,
    );
    const email = textValue(
      labeledValue(infoSheet, ["البريد الإلكتروني", "البريد الالكتروني", "email"])
        || infoSheet.getCell("C6").value
        || infoSheet.getCell("B3").value,
    ).toLowerCase();
    let startDate = dateValue(
      scalar(
        labeledValue(infoSheet, ["بداية الخبرة", "تاريخ بدء الإشراف", "supervision start", "start date"])
          || infoSheet.getCell("C10").value
          || infoSheet.getCell("B5").value,
      ),
    );
    if (!startDate) {
      const firstMonth = workbook.getWorksheet("Month 1");
      const overview = workbook.getWorksheet("Activity Overview");
      startDate = dateValue(
        scalar(firstMonth?.getCell("C4").value || overview?.getCell("C6").value),
      );
    }
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
