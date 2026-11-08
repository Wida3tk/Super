import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { scalarCellValue } from "@/lib/imports/cellValue";

const mocks = vi.hoisted(() => ({ email: "supervisor@example.test", existing: false, write: vi.fn(), updateRow: vi.fn(), deleteRow: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({ requireAdmin: async () => ({ uid: "admin" }) }));
vi.mock("@/lib/fieldwork/syncTotals", () => ({ syncTraineeFieldworkTotals: mocks.write }));
vi.mock("@/lib/imports/priorSafeBatch", () => ({ priorSafeImportBatch: () => ({ set: mocks.updateRow, delete: mocks.deleteRow, create: mocks.write, commit: async () => {} }) }));
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { createUser: mocks.write, getUserByEmail: mocks.write },
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => ({ id, get: async () => ({ exists: true, data: () => ({ email: mocks.email, name: "Supervisor" }) }) }),
      get: async () => ({ docs: name === "trainees" && mocks.existing ? [{ id: "t", data: () => ({ email: "trainee@example.test", currentSupervisorId: "s" }), ref: { set: mocks.write } }] : [] }),
      where: () => ({ where: () => ({ get: async () => ({ docs: [{ id: "unrelated", data: () => ({ activityType: "supervision_indirect", supervisorHoursImport: { version: 1 }, date: "2025-07-01" }) }] }) }) }),
      add: mocks.write,
    }),
    getAll: async (...refs: unknown[]) => refs.map(() => ({ exists: true })), runTransaction: mocks.write,
  },
}));
import { POST } from "./route";

async function submit(bytes: ArrayBuffer, commit: boolean, corrections?: unknown, previewToken?: string) {
  const form = new FormData();
  form.set("file", new File([bytes], "supervisor.xlsx"));
  form.set("supervisorId", "s");
  form.set("commit", String(commit));
  if (corrections) form.set("corrections", JSON.stringify(corrections));
  if (previewToken) form.set("previewToken", previewToken);
  return POST(new Request("https://test/api/admin/supervisor-hours-import", { method: "POST", body: form }) as never);
}

async function workbook(header: string, dates: ExcelJS.CellValue[]) {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("لوحة المعلومات الرئيسية").getCell("E3").value = mocks.email;
  const sheet = book.addWorksheet("Trainee");
  sheet.getCell("K3").value = "Trainee";
  sheet.getCell("K4").value = "trainee@example.test";
  sheet.getCell("B20").value = 1;
  sheet.getCell("G11").value = header;
  sheet.getCell("B21").value = { formula: "G11" };
  sheet.getCell("L22").value = "فردي";
  dates.forEach((date, index) => { sheet.getCell(`B${23 + index}`).value = date; sheet.getCell(`L${23 + index}`).value = 1; });
  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}

it("previews valid day-first text and cached formula dates in their calendar month", async () => {
  const response = await submit(await workbook("أغسطس 2025", ["٣٠/٨/٢٠٢٥", { formula: "DATE(2025,8,31)", result: 45900 }]), false);
  expect(response.status).toBe(200);
  expect((await response.json()).preview).toMatchObject({ dateIssues: [], months: [{ month: "2025-08", hours: 2 }] });
});

it("previews corrected months and explicit dates without changing durations or writing records", async () => {
  const bytes = await workbook("أغسطس 2024", ["30/8/2025", 46062]);
  const corrections = { months: [{ sheet: "Trainee", cell: "B21", value: "2025-08" }], dates: [{ sheet: "Trainee", cell: "B24", value: "2025-08-31" }] };
  const preview = await submit(bytes, false, corrections);
  expect(preview.status).toBe(200);
  const data = await preview.json();
  expect(data.preview).toMatchObject({ dateIssues: [], months: [{ month: "2025-08", hours: 2 }] });
  expect(data.previewToken).toMatch(/^[a-f0-9]{64}$/);
  const changed = { ...corrections, dates: [{ sheet: "Trainee", cell: "B24", value: "2025-08-29" }] };
  const commit = await submit(bytes, true, changed, data.previewToken);
  expect(commit.status).toBe(409);
  expect((await commit.json()).error).toBe("IMPORT_PREVIEW_CHANGED");
  expect(mocks.write).not.toHaveBeenCalled();
});

it("rejects impossible, future, and unrelated cell edits before writing", async () => {
  const bytes = await workbook("أغسطس 2025", ["30/8/2025"]);
  for (const [cell, value] of [["B23", "2025-08-32"], ["B23", "2099-08-30"], ["K4", "2025-08-30"]]) {
    const response = await submit(bytes, true, { months: [], dates: [{ sheet: "Trainee", cell, value }] });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("INVALID_CORRECTIONS");
  }
  expect(mocks.write).not.toHaveBeenCalled();
});

it("commits the reviewed correction with original values and preserves unrelated imports", async () => {
  mocks.existing = true;
  try {
    const bytes = await workbook("أغسطس 2024", [46062]);
    const corrections = { months: [{ sheet: "Trainee", cell: "B21", value: "2025-08" }], dates: [{ sheet: "Trainee", cell: "B23", value: "2025-08-30" }] };
    const preview = await (await submit(bytes, false, corrections)).json();
    const response = await submit(bytes, true, corrections, preview.previewToken);
    expect(response.status).toBe(200);
    expect(mocks.updateRow).toHaveBeenCalledOnce();
    expect(mocks.updateRow.mock.calls[0][1]).toMatchObject({ date: "2025-08-30", month: "2025-08", duration: 1,
      supervisorHoursImport: { dateCorrection: { originalDate: "2026-02-09", originalMonth: "2024-08", correctedBy: "admin" } },
    });
    expect(mocks.deleteRow).not.toHaveBeenCalled();
  } finally { mocks.existing = false; mocks.write.mockClear(); }
});

it("blocks all writes when saved date serials conflict with the block or a date is missing", async () => {
  const response = await submit(await workbook("أكتوبر 2026", [46183, null, "31/9/2026"]), true);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "SUPERVISOR_IMPORT_DATE_CONFLICT", preview: { dateIssues: [
    { cell: "B23", date: "2026-06-10", expectedMonth: "2026-10" },
    { cell: "B24", date: "" }, { cell: "B25", date: "" },
  ] } });
  expect(mocks.write).not.toHaveBeenCalled();
});

it.runIf(!!process.env.SUPERVISOR_IMPORT_FIXTURE)("blocks the supplied workbook without writing records", async () => {
  const file = await readFile(process.env.SUPERVISOR_IMPORT_FIXTURE!);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(file as never);
  const main = book.getWorksheet("لوحة المعلومات الرئيسية")!;
  mocks.email = String(scalarCellValue(main.getCell("E3").value) || scalarCellValue(main.getCell("F3").value)).trim().toLowerCase();
  const response = await submit(Uint8Array.from(file).buffer, true);
  expect(response.status).toBe(409);
  const result = await response.json();
  expect(result.error).toBe("SUPERVISOR_IMPORT_DATE_CONFLICT");
  expect(result.preview.dateIssues).toEqual(expect.arrayContaining([
    expect.objectContaining({ cell: "B23", date: "2026-08-30", expectedMonth: "2025-08" }),
    expect.objectContaining({ cell: "W23", date: "2026-02-09", expectedMonth: "2025-09" }),
    expect.objectContaining({ cell: "AO23", date: "2026-06-10", expectedMonth: "2025-10" }),
    expect.objectContaining({ cell: "AN24", date: "2026-01-10", expectedMonth: "2025-10" }),
  ]));
  expect(mocks.write).not.toHaveBeenCalled();
});
