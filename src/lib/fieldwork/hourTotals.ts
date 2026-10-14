import type { FieldworkActivity } from "@/types";

export function approvedHourRows(activities: FieldworkActivity[]) {
  return activities.filter(row => row.status === "approved" &&
    Number.isFinite(Number(row.duration)) && Number(row.duration) > 0 &&
    ["direct", "indirect", "supervision_direct", "supervision_indirect"].includes(row.activityType))
    .map(row => ({ ...row, duration: Number(row.duration) }));
}

export function calculateHourTotals(activities: FieldworkActivity[]) {
  let direct = 0, indirect = 0, supervision = 0, group = 0;
  for (const row of approvedHourRows(activities)) {
    if (row.activityType === "direct") direct += row.duration;
    else if (row.activityType === "indirect") indirect += row.duration;
    else {
      supervision += row.duration;
      if (row.format === "group") group += row.duration;
    }
  }
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return { direct: round(direct), indirect: round(indirect), supervision: round(supervision),
    group: round(group), individual: round(supervision - group), fieldwork: round(direct + indirect + supervision) };
}
