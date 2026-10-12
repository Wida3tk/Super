import { resolveLifecycleStage } from "./stages";

export const MAIN_STAGES = [
  { key: "registered", label: "تقديم الطلب" },
  { key: "initial_interview", label: "المقابلة" },
  { key: "contracting", label: "اعتماد الاتفاقية" },
  { key: "active_service", label: "البدء بالإشراف" },
  { key: "completed", label: "انتهاء الإشراف" },
] as const;
export const EXCEPTIONAL_ACTIONS = [
  { key: "approved_pause", label: "طلب تأجيل الإشراف" },
  { key: "supervisor_transfer", label: "طلب تغيير المشرف" },
  { key: "platform_suspension", label: "إيقاف الإشراف" },
  { key: "financial_clearance", label: "المخالصة المالية" },
] as const;
type Transition = { fromStage?: string; toStage?: string; changedAt?: string; traineeId?: string };
const mainIndex = (stage: string) => MAIN_STAGES.findIndex(
  (item) => item.key === (stage === "post_interview" ? "initial_interview" : stage),
);

// Presentation only: never writes a stage or changes service eligibility.
export function mainStageIndex(trainee: any, transitions: Transition[] = []) {
  const current = mainIndex(resolveLifecycleStage(trainee));
  if (current >= 0) return current;
  const history = transitions.filter((item) => !item.traineeId || item.traineeId === trainee.id)
    .sort((a, b) => String(b.changedAt || "").localeCompare(String(a.changedAt || "")));
  for (const item of history) {
    const index = mainIndex(item.toStage || "");
    if (index >= 0) return index;
    const previous = mainIndex(item.fromStage || "");
    if (previous >= 0) return previous;
  }
  // For legacy files without history, show only the last evidenced milestone.
  return trainee.currentSupervisorId ? 3 : 0;
}
