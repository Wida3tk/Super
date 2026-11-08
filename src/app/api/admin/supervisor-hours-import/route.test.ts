import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { scalarCellValue } from "@/lib/imports/cellValue";

const mocks = vi.hoisted(() => ({ email: "supervisor@example.test", write: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/serverAuth", () => ({ requireAdmin: async () => ({ uid: "admin" }) }));
vi.mock("@/lib/fieldwork/syncTotals", () => ({ syncTraineeFieldworkTotals: mocks.write }));
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { createUser: mocks.write, getUserByEmail: mocks.write },
  adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ email: mocks.email, name: "Supervisor" }) }) }), get: async () => ({ docs: [] }), add: mocks.write }), runTransaction: mocks.write },
}));
import { POST } from "./route";

async function submit(bytes: ArrayBuffer, commit: boolean) {
  const form = new FormData();
  form.set("file", new File([bytes], "supervisor.xlsx"));
  form.set("supervisorId", "s");
  form.set("commit", String(commit));
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
