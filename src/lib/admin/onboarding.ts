import { resolveLifecycleStage } from "@/lib/lifecycle/stages";

/**
 * The joining pipeline, from a new application to assignment. A trainee sits
 * in one column by their lifecycle stage; an application declined after the
 * interview waits apart until it is reopened. Assignment moves the trainee
 * out of the pipeline into service.
 */

export type Column = "registered" | "initial_interview" | "post_interview" | "contracting" | "declined";

export const COLUMNS: { key: Column; label: string; hint: string; color: string; next?: { stage: string; label: string } }[] = [
  { key: "registered", label: "طلب جديد", hint: "سجّل من الموقع ولم يبدأ معه أي إجراء", color: "#8b5cf6", next: { stage: "initial_interview", label: "بدء المقابلة" } },
  { key: "initial_interview", label: "المقابلة", hint: "المقابلة الأولية مع المشرف", color: "#2563eb", next: { stage: "post_interview", label: "تمت المقابلة" } },
  { key: "post_interview", label: "القرار", hint: "بانتظار قرار الطرفين أو مراجعة الإدارة", color: "#0891b2", next: { stage: "contracting", label: "قبول: إلى التعاقد" } },
  { key: "contracting", label: "التعاقد", hint: "الاتفاقية والموافقات، ثم الإسناد لمشرف", color: "#d97706" },
  { key: "declined", label: "متوقف", hint: "لم يتم الاتفاق بعد المقابلة", color: "#94a3b8" },
];

const ORDER: Column[] = ["registered", "initial_interview", "post_interview", "contracting"];
export const previousStage = (column: Column) => (ORDER.indexOf(column) > 0 ? ORDER[ORDER.indexOf(column) - 1] : null);

export function boardColumn(trainee: { status?: string; lifecycleStage?: string; onboardingStage?: string | null; isDemo?: boolean }): Column | null {
  if (trainee.isDemo) return null;
  const stage = resolveLifecycleStage(trainee);
  if (!ORDER.includes(stage as Column)) return null;
  if (trainee.onboardingStage === "interview_declined") return "declined";
  return stage as Column;
}

export type Movement = { applications: number; interviews: number; decisions: number; contracting: number; assigned: number; declined: number };
export const MOVEMENT: { key: keyof Movement; label: string; color: string }[] = [
  { key: "applications", label: "طلبات جديدة", color: "#8b5cf6" },
  { key: "interviews", label: "مقابلات", color: "#2563eb" },
  { key: "decisions", label: "انتهت مقابلتهم", color: "#0891b2" },
  { key: "contracting", label: "دخلوا التعاقد", color: "#d97706" },
  { key: "assigned", label: "أُسندوا لمشرف", color: "#0b8f7a" },
  { key: "declined", label: "لم يتم الاتفاق", color: "#94a3b8" },
];

const PRE_SERVICE = new Set(["registered", "initial_interview", "post_interview", "contracting", "awaiting_decisions", "admin_review", "ready_assignment"]);

/** How many trainees entered each step in each month, from the recorded transitions. */
export function monthlyMovement(
  months: string[],
  transitions: { toStage?: string; fromStage?: string; changedMonth?: string; changedAt?: string; traineeId?: string }[],
  trainees: { createdAt?: string; isDemo?: boolean }[],
) {
  const out = new Map<string, Movement>(months.map((m) => [m, { applications: 0, interviews: 0, decisions: 0, contracting: 0, assigned: 0, declined: 0 }]));
  for (const t of trainees) {
    const row = !t.isDemo && out.get(String(t.createdAt || "").slice(0, 7));
    if (row) row.applications += 1;
  }
  // One count per trainee and step in a month, even if moved back and forth.
  const seen = new Set<string>();
  for (const move of transitions) {
    const month = move.changedMonth || String(move.changedAt || "").slice(0, 7);
    const row = out.get(month);
    if (!row) continue;
    const key = move.toStage === "initial_interview" ? "interviews"
      : move.toStage === "post_interview" ? "decisions"
        : move.toStage === "contracting" ? "contracting"
          : move.toStage === "interview_declined" ? "declined"
            : move.toStage === "active_service" && PRE_SERVICE.has(String(move.fromStage || "")) ? "assigned" : null;
    if (!key) continue;
    const id = `${month}|${key}|${move.traineeId || Math.random()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    row[key] += 1;
  }
  return out;
}

export function daysSince(iso: string | undefined, now = Date.now()) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
}
