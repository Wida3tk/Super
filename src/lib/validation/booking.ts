import type { CreateBookingPayload } from "@/types";

export type BookingValidationError =
  | "MISSING_NAME"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_PASSWORD"
  | "INVALID_CONSULTATION_TYPE"
  | "INVALID_SLOT";

export function validateBookingPayload(
  payload: CreateBookingPayload,
): BookingValidationError | null {
  if (!payload.studentName?.trim()) return "MISSING_NAME";
  if (!payload.studentEmail?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
    return "INVALID_EMAIL";
  if (!payload.studentPhone?.match(/^\+?[\d\s-]{8,15}$/))
    return "INVALID_PHONE";
  if (!payload.password || payload.password.length < 8)
    return "INVALID_PASSWORD";
  if (
    payload.bookingType === "consultation" &&
    !["behavior_analysis", "organizational_behavior"].includes(
      payload.consultationType || "",
    )
  )
    return "INVALID_CONSULTATION_TYPE";
  if (!payload.supervisorId?.trim() || !payload.availabilitySlotId?.trim())
    return "INVALID_SLOT";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    !/^\d{2}:\d{2}$/.test(payload.time)
  ) {
    return "INVALID_SLOT";
  }
  return null;
}

export function isManagementToken(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export function getInterviewSeatDelta(
  previousStatus: string,
  nextStatus: string,
  bookingType = "initial_interview",
): number {
  if (bookingType !== "initial_interview" || previousStatus === nextStatus)
    return 0;
  if (previousStatus !== "missed" && nextStatus === "missed") return 1;
  if (previousStatus === "missed" && nextStatus !== "missed") return -1;
  return 0;
}

export function isBookingReference(value: string): boolean {
  return /^SUL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);
}

export function maskPersonName(value: unknown): string {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return parts
    .map((part) => (part.length <= 1 ? "*" : `${part[0]}${"*".repeat(Math.min(part.length - 1, 4))}`))
    .join(" ");
}
