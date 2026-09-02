import type { TraineeLifecycleStage } from "@/types";

export const LIFECYCLE_STAGES: Array<{
  key: TraineeLifecycleStage;
  label: string;
  short: string;
  color: string;
}> = [
  { key: "registered", label: "مرحلة تسجيل جديد", short: "تسجيل جديد", color: "#8B5CF6" },
  { key: "initial_interview", label: "مرحلة المقابلة الأولية", short: "المقابلة الأولية", color: "#2563EB" },
  { key: "post_interview", label: "مرحلة ما بعد المقابلة", short: "ما بعد المقابلة", color: "#7C3AED" },
  { key: "contracting", label: "مرحلة التعاقد", short: "التعاقد", color: "#D97706" },
  { key: "active_service", label: "مرحلة البدء والاستمرار", short: "البدء والاستمرار", color: "#059669" },
  { key: "approved_pause", label: "مرحلة التأجيل المسموح", short: "التأجيل المسموح", color: "#64748B" },
  { key: "supervisor_transfer", label: "مرحلة الانتقال إلى مشرف آخر", short: "الانتقال لمشرف آخر", color: "#0891B2" },
  { key: "platform_suspension", label: "مرحلة الإيقاف من المنصة", short: "الإيقاف من المنصة", color: "#DC2626" },
  { key: "financial_clearance", label: "مرحلة المخالصة المالية", short: "المخالصة المالية", color: "#C2410C" },
  { key: "completed", label: "مرحلة الإنهاء والإكمال", short: "الإنهاء والإكمال", color: "#0F766E" },
];

// نفس منطق استنتاج المرحلة المستخدم في لوحة الإدارة (TraineeLifecyclePanel) — يبقي العدّ متطابقًا بين اللوحتين.
export function resolveLifecycleStage(trainee: any): TraineeLifecycleStage {
  if (trainee?.lifecycleStage) return trainee.lifecycleStage;
  if (trainee?.status === "active") return "active_service";
  if (trainee?.status === "paused") return "approved_pause";
  if (trainee?.status === "completed") return "completed";
  if (
    trainee?.onboardingStage === "contracting" ||
    trainee?.onboardingStage === "ready_assignment"
  )
    return "contracting";
  if (
    ["awaiting_decisions", "admin_review", "interview_declined"].includes(
      trainee?.onboardingStage,
    )
  )
    return "post_interview";
  return "initial_interview";
}
