import type { FieldworkActivity } from "@/types";

export type QabaCredential = "QASP-S" | "QBA";

export function credentialRules(
  credential: QabaCredential,
  _fieldworkStartDate?: string,
) {
  if (credential === "QASP-S")
    return {
      label: "مساعد محلل سلوك",
      total: 1000,
      supervisionTarget: 50,
      minIndirect: 600,
      maxDirect: 400,
      monthlyMin: 20,
      monthlyMax: 140,
      supervisionRate: 0.05,
      maxGroupRate: 0.5,
    };
  return {
    label: "محلل سلوك",
    total: 2000,
    supervisionTarget: 100,
    minIndirect: 1200,
    maxDirect: 800,
    monthlyMin: 20,
    monthlyMax: 140,
    supervisionRate: 0.05,
    maxGroupRate: 0.5,
  };
}

export function buildCompliance(
  activities: FieldworkActivity[],
  credential: QabaCredential,
  fieldworkStartDate?: string,
) {
  const rules = credentialRules(credential, fieldworkStartDate);
  const approved = activities.filter((a) => a.status === "approved");
  const direct = approved
    .filter((a) => a.activityType === "direct")
    .reduce((n, a) => n + a.duration, 0);
  const indirect = approved
    .filter((a) => a.activityType === "indirect")
    .reduce((n, a) => n + a.duration, 0);
  const supervisionRows = approved.filter((a) =>
    a.activityType.startsWith("supervision_"),
  );
  const supervision = supervisionRows.reduce((n, a) => n + a.duration, 0);
  const group = supervisionRows
    .filter((a) => a.format === "group")
    .reduce((n, a) => n + a.duration, 0);
  const fieldwork = direct + indirect;
  const directRate = fieldwork ? direct / fieldwork : 0;
  const indirectRate = fieldwork ? indirect / fieldwork : 0;
  const byMonth = new Map<
    string,
    {
      fieldwork: number;
      direct: number;
      indirect: number;
      supervision: number;
      group: number;
    }
  >();
  for (const a of approved) {
    const row = byMonth.get(a.month) || {
      fieldwork: 0,
      direct: 0,
      indirect: 0,
      supervision: 0,
      group: 0,
    };
    if (a.activityType.startsWith("supervision_")) {
      row.supervision += a.duration;
      if (a.format === "group") row.group += a.duration;
    } else {
      row.fieldwork += a.duration;
      if (a.activityType === "direct") row.direct += a.duration;
      if (a.activityType === "indirect") row.indirect += a.duration;
    }
    byMonth.set(a.month, row);
  }
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, v]) => ({
      month,
      ...v,
      supervisionRate: v.fieldwork ? v.supervision / v.fieldwork : 0,
      groupRate: v.supervision ? v.group / v.supervision : 0,
      directRate: v.fieldwork ? v.direct / v.fieldwork : 0,
      indirectRate: v.fieldwork ? v.indirect / v.fieldwork : 0,
      validHoursBand:
        v.fieldwork >= rules.monthlyMin && v.fieldwork <= rules.monthlyMax,
      meetsSupervision:
        v.fieldwork > 0 && v.supervision / v.fieldwork >= rules.supervisionRate,
      meetsGroupLimit:
        v.supervision === 0 || v.group / v.supervision <= rules.maxGroupRate,
      // QABA applies the 40/60 distribution to the accumulated fieldwork.
      // Keep monthly ratios for coaching, but do not reject an otherwise valid
      // month because its local activity mix differs from the cumulative mix.
      meetsDirectLimit: directRate <= 0.4,
      meetsIndirectMinimum: indirectRate >= 0.6,
    }));
  return {
    rules,
    direct,
    indirect,
    supervision,
    group,
    fieldwork,
    directRate,
    indirectRate,
    meetsDirectLimit: directRate <= 0.4,
    meetsIndirectMinimum: indirectRate >= 0.6,
    months,
  };
}
