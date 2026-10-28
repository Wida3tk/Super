export const workspaceSections = [
  { label: "المتابعة", tabs: [["overview", "الملخص والتقدم"], ["plan", "خطة الإشراف"], ["assessment", "تقييم الكفاءة"], ["reports", "التقارير الدورية"], ["improvement", "تحسين الأداء"]] },
  { label: "الساعات والاجتماعات", tabs: [["hours", "جميع الساعات"], ["meetings", "الجلسات والمحاضر"]] },
  { label: "الملف والمستندات", tabs: [["agreement", "الاتفاقية والإسناد"], ["documents", "الموافقات والمستندات"]] },
] as const;

export function approvalMonths(months: readonly { month: string }[], todayMonth: string) {
  return [...new Set([todayMonth, ...months.map(row => row.month)])]
    .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= todayMonth).sort().reverse();
}
