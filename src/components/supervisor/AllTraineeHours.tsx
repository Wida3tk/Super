"use client";

import { useState } from "react";
import type { FieldworkActivity } from "@/types";

const statuses: Record<string, string> = {
  draft: "مسودة", submitted: "بانتظار الاعتماد", approved: "معتمد",
  revision_requested: "مطلوب تعديل", rejected: "مرفوض",
};
const types: Record<string, string> = {
  direct: "مباشر", indirect: "غير مباشر",
  supervision_direct: "إشراف مباشر", supervision_indirect: "إشراف غير مباشر",
};

export default function AllTraineeHours({ activities }: { activities: FieldworkActivity[] }) {
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const rows = activities.filter((row) => !(row as FieldworkActivity & { deletedAt?: string }).deletedAt);
  const months = [...new Set(rows.map((row) => row.month || row.date.slice(0, 7)))].sort().reverse();
  const visible = rows.filter((row) =>
    (!month || (row.month || row.date.slice(0, 7)) === month) &&
    (!status || row.status === status) && (!type || row.activityType === type),
  ).sort((a, b) => b.date.localeCompare(a.date));
  const total = visible.reduce((sum, row) => sum + Number(row.duration || 0), 0);
  const approved = visible.filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + Number(row.duration || 0), 0);
  const hours = (value: number) => Number(value.toFixed(2)).toLocaleString("ar");

  return <section className="panel">
    <h3>جميع ساعات المتدرب</h3>
    <p className="muted">السجل الكامل، بما فيه الساعات المسجلة يدويًا والمسودات والساعات قيد المراجعة. تُحتسب الساعات المعتمدة فقط في التقدم.</p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0" }}>
      <select aria-label="تصفية الشهر" value={month} onChange={(event) => setMonth(event.target.value)}>
        <option value="">جميع الشهور</option>{months.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <select aria-label="تصفية الحالة" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">جميع الحالات</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="تصفية نوع النشاط" value={type} onChange={(event) => setType(event.target.value)}>
        <option value="">جميع أنواع الساعات</option>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <p>{visible.length} سجل · مجموع الساعات المعروضة: {hours(total)} · المعتمد منها: {hours(approved)} ساعة</p>
    {!visible.length ? <p className="muted">لا توجد ساعات تطابق التصفية الحالية.</p> : <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 750, textAlign: "right", borderCollapse: "collapse" }}>
        <thead><tr>{["التاريخ والوقت", "نوع النشاط", "المدة", "الحالة", "تفاصيل النشاط"].map((label) => <th key={label} style={{ padding: 12 }}>{label}</th>)}</tr></thead>
        <tbody>{visible.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0" }}>
          <td style={{ padding: 12 }}>{row.date}<small style={{ display: "block" }}>{row.startTime && row.endTime ? `${row.startTime} – ${row.endTime}` : ""}</small></td>
          <td style={{ padding: 12 }}>{types[row.activityType] || row.activityType}</td>
          <td style={{ padding: 12 }}>{hours(Number(row.duration || 0))} ساعة</td>
          <td style={{ padding: 12 }}>{statuses[row.status] || row.status}</td>
          <td style={{ padding: 12 }}><details><summary>{row.description || "عرض التفاصيل"}</summary>
            {row.centerName && <p>المركز: {row.centerName}</p>}
            {row.clientCode && <p>رمز المستفيد: {row.clientCode}</p>}
            <p>الصيغة: {row.format === "group" ? "جماعي" : "فردي"} · المكان: {row.setting === "in_person" ? "حضوري" : row.setting === "video" ? "عن بُعد" : "غير محدد"}</p>
            {row.evidenceNote && <p>التوثيق: {row.evidenceNote}</p>}
            {row.reviewerNote && <p>ملاحظة المراجعة: {row.reviewerNote}</p>}
          </details></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
