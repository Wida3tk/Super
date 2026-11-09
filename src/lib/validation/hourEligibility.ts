/**
 * Whether hours on a date can count toward a QABA credential.
 *
 * Board rules (qababoard.com, checked 2026-11-09):
 * - no hours before the first day of the required coursework, and none
 *   retroactively;
 * - no hours outside a valid supervision contract;
 * - hours must fall within the accrual window (7 years);
 * - the supervisor's credential must be active on the date.
 * Returns the first problem as a stable code, or null when the date is valid.
 */
export type HourDateProblem =
  | "INVALID_DATE"
  | "FUTURE_DATE"
  | "BEFORE_COURSEWORK_START"
  | "BEFORE_FIELDWORK_START"
  | "OUTSIDE_ACCRUAL_WINDOW"
  | "SUPERVISOR_CREDENTIAL_EXPIRED";

export const HOUR_DATE_MESSAGES: Record<HourDateProblem, string> = {
  INVALID_DATE: "التاريخ غير صحيح.",
  FUTURE_DATE: "لا يمكن تسجيل ساعات بتاريخ في المستقبل.",
  BEFORE_COURSEWORK_START: "التاريخ قبل أول يوم في المقررات؛ لا تُحتسب ساعات قبله حسب QABA.",
  BEFORE_FIELDWORK_START: "التاريخ قبل بدء عقد الإشراف؛ لا تُحتسب ساعات خارج عقد ساري حسب QABA.",
  OUTSIDE_ACCRUAL_WINDOW: "التاريخ أقدم من مدة احتساب الساعات (7 سنوات) حسب QABA.",
  SUPERVISOR_CREDENTIAL_EXPIRED: "اعتماد المشرف منتهٍ في هذا التاريخ؛ لا تُحتسب الساعات حسب QABA.",
};

const day = (value: unknown) => {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};

export function hourDateProblem(input: {
  date: string;
  today?: string;
  courseworkStartDate?: unknown;
  fieldworkStartDate?: unknown;
  supervisorCredentialExpiresAt?: unknown;
  accrualWindowYears?: number;
}): HourDateProblem | null {
  const date = day(input.date);
  const parsed = date ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return "INVALID_DATE";
  const today = day(input.today) || new Date().toISOString().slice(0, 10);
  if (date > today) return "FUTURE_DATE";
  const coursework = day(input.courseworkStartDate);
  if (coursework && date < coursework) return "BEFORE_COURSEWORK_START";
  const fieldwork = day(input.fieldworkStartDate);
  if (fieldwork && date < fieldwork) return "BEFORE_FIELDWORK_START";
  const years = input.accrualWindowYears ?? 7;
  const earliest = `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;
  if (date < earliest) return "OUTSIDE_ACCRUAL_WINDOW";
  const expires = day(input.supervisorCredentialExpiresAt);
  if (expires && date > expires) return "SUPERVISOR_CREDENTIAL_EXPIRED";
  return null;
}

/** Same supervisor, date, type, duration and trainees: a session logged twice. */
export function isDuplicateSession(
  candidate: { type: string; duration?: number | null; traineeIds: string[] },
  existing: Array<{ type?: string; duration?: number | null; traineeIds?: string[]; deletedAt?: unknown; status?: string }>,
) {
  const key = (ids: string[] = []) => [...ids].sort().join(",");
  return existing.some((session) =>
    !session.deletedAt && session.status !== "deleted" &&
    session.type === candidate.type &&
    Number(session.duration || 0) === Number(candidate.duration || 0) &&
    key(session.traineeIds) === key(candidate.traineeIds));
}
