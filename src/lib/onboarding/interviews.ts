/**
 * The joining fee covers two initial interviews: a trainee who does not
 * agree with the first supervisor may try a second one at no extra cost.
 * The administration can allow more for a single trainee.
 *
 * An interview counts once it is booked and not cancelled: still pending,
 * held, or closed after it was held. A cancelled booking gives the
 * interview back, and so does a missed one: the trainee reschedules it
 * (confirmed by the program owner, 2026-11-17).
 */
export const INCLUDED_INTERVIEWS = 2;

type Booking = { bookingType?: string; status?: string; meetingStatus?: string };

export function countsAsInterview(booking: Booking) {
  return (booking.bookingType || "initial_interview") === "initial_interview" && booking.status !== "cancelled" && booking.meetingStatus !== "missed";
}

export function interviewAllowance(extra: unknown) {
  const n = Number(extra);
  return INCLUDED_INTERVIEWS + (Number.isInteger(n) && n > 0 ? n : 0);
}

export function interviewsUsed(bookings: Booking[]) {
  return bookings.filter(countsAsInterview).length;
}

/** The trainee's latest initial interview was missed: it needs a new date. */
export function needsReschedule(bookings: (Booking & { date?: string })[]) {
  const interviews = bookings.filter((b) => (b.bookingType || "initial_interview") === "initial_interview" && b.status !== "cancelled")
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return interviews.at(-1)?.meetingStatus === "missed";
}
