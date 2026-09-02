"use client";

import { useMemo, useState } from "react";
import type { FieldworkActivity } from "@/types";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const n = (value: unknown) => Number(value || 0);

export default function MonthlyHoursInsights({ activities, supervisionTarget }: { activities: FieldworkActivity[]; supervisionTarget: number }) {
  const approved = useMemo(() => activities.filter((item) => item.status === "approved"), [activities]);
  const months = useMemo(() => [...new Set(approved.map((item) => item.month || item.date.slice(0, 7)).filter(Boolean))].sort().reverse(), [approved]);
  const [month, setMonth] = useState(months[0] || "");
  const rows = approved.filter((item) => (item.month || item.date.slice(0, 7)) === month);
  const fieldwork = rows.filter((item) => !item.activityType.startsWith("supervision_"));
  const supervision = rows.filter((item) => item.activityType.startsWith("supervision_"));
  const direct = fieldwork.filter((item) => item.activityType === "direct").reduce((sum, item) => sum + n(item.duration), 0);
  const indirect = fieldwork.filter((item) => item.activityType === "indirect").reduce((sum, item) => sum + n(item.duration), 0);
  const supervisionHours = supervision.reduce((sum, item) => sum + n(item.duration), 0);
  const totalSupervision = approved.filter((item) => item.activityType.startsWith("supervision_")).reduce((sum, item) => sum + n(item.duration), 0);
  const supervisionProgress = Math.min(100, supervisionTarget ? totalSupervision / supervisionTarget * 100 : 0);
  const days = Array.from({ length: month ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate() : 0 }, (_, index) => index + 1);
  const daily = days.map((day) => {
    const entries = rows.filter((item) => Number(item.date.slice(8, 10)) === day);
    return {
      day,
      direct: entries.filter((item) => item.activityType === "direct").reduce((sum, item) => sum + n(item.duration), 0),
      indirect: entries.filter((item) => item.activityType === "indirect").reduce((sum, item) => sum + n(item.duration), 0),
      supervision: entries.filter((item) => item.activityType.startsWith("supervision_")).reduce((sum, item) => sum + n(item.duration), 0),
    };
  });
  const maxDay = Math.max(...daily.map((day) => day.direct + day.indirect + day.supervision), 1);
  const monthLabel = (value: string) => { const [year, index] = value.split("-"); return `${MONTHS[Number(index) - 1] || index} ${year}`; };

  if (!months.length) return <section className="panel"><h3>تحليل الساعات الشهري</h3><p className="muted">سيظهر الرسم البياني بعد اعتماد أول ساعات لك.</p></section>;

  return <section className="panel" style={{ marginBottom: 16 }} dir="rtl">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
      <div><h3 style={{ margin: 0 }}>ملخص الساعات الشهري</h3><p className="muted" style={{ margin: "6px 0 0" }}>راجع توزيع ساعاتك يومًا بيوم، وجميع الأرقام أدناه للساعات المعتمدة فقط.</p></div>
      <select value={month} onChange={(event) => setMonth(event.target.value)} style={{ minWidth: 160 }} aria-label="اختر الشهر">
        {months.map((value) => <option value={value} key={value}>{monthLabel(value)}</option>)}
      </select>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, margin: "18px 0" }}>
      {[["إجمالي الشهر", direct + indirect, "#0D40FC"], ["مباشرة", direct, "#059669"], ["غير مباشرة", indirect, "#0891B2"], ["إشراف", supervisionHours, "#7C3AED"]].map(([label, value, color]) => <div key={String(label)} style={{ border: "1px solid #E2E8F0", borderRadius: 13, padding: 13, borderTop: `3px solid ${color}` }}><b style={{ display: "block", color: String(color), fontSize: 23 }}>{n(value).toFixed(1).replace(".0", "")} <small style={{ fontSize: 11 }}>ساعة</small></b><span className="muted">{String(label)}</span></div>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(190px,1fr)", gap: 18 }} className="monthly-insights-grid">
      <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, padding: "14px 12px 10px", overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}><b>توزيع الساعات على أيام الشهر</b><div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748B" }}><span>● <i style={{ color: "#059669" }}>مباشرة</i></span><span>● <i style={{ color: "#0891B2" }}>غير مباشرة</i></span><span>● <i style={{ color: "#7C3AED" }}>إشراف</i></span></div></div>
        <div style={{ height: 210, minWidth: 620, display: "flex", alignItems: "end", gap: 3, borderBottom: "1px solid #CBD5E1", background: "repeating-linear-gradient(to top,#fff 0,#fff 51px,#EEF2F7 52px)" }}>
          {daily.map((item) => { const total = item.direct + item.indirect + item.supervision; return <div key={item.day} title={`يوم ${item.day}: ${total.toFixed(1)} ساعة`} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "stretch", position: "relative" }}>
            {total > 0 && <span style={{ position: "absolute", bottom: `${Math.min(180, total / maxDay * 170) + 18}px`, width: "100%", textAlign: "center", fontSize: 9, color: "#334155" }}>{total.toFixed(1).replace(".0", "")}</span>}
            <div style={{ height: `${item.supervision / maxDay * 170}px`, background: "#7C3AED", borderRadius: "3px 3px 0 0" }} /><div style={{ height: `${item.indirect / maxDay * 170}px`, background: "#0891B2" }} /><div style={{ height: `${item.direct / maxDay * 170}px`, background: "#059669" }} />
            <small style={{ textAlign: "center", fontSize: 8, height: 17, paddingTop: 3, color: item.day % 5 === 0 || item.day === 1 ? "#475569" : "transparent" }}>{item.day}</small>
          </div>; })}
        </div>
        <div style={{ textAlign: "center", color: "#64748B", fontSize: 11, marginTop: 7 }}>أيام {monthLabel(month)}</div>
      </div>
      <div style={{ border: "1px solid #E2E8F0", borderRadius: 14, padding: 16, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ width: 132, height: 132, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(#0D40FC ${supervisionProgress}%,#E8EEF7 0)`, position: "relative" }}><div style={{ width: 100, height: 100, borderRadius: "50%", background: "white", display: "grid", placeItems: "center", position: "absolute" }}><div><b style={{ display: "block", color: "#001442", fontSize: 22 }}>{supervisionProgress.toFixed(0)}%</b><small className="muted">من الهدف</small></div></div></div>
        <div><b style={{ display: "block", marginTop: 10 }}>تقدم ساعات الإشراف</b><span className="muted">{totalSupervision.toFixed(1)} من {supervisionTarget} ساعة</span><p style={{ color: "#64748B", fontSize: 11, lineHeight: 1.6, marginBottom: 0 }}>هذا المؤشر تراكمي ويجمع ساعات الإشراف المعتمدة في جميع الأشهر.</p></div>
      </div>
    </div>
    <style jsx>{`@media(max-width:760px){.monthly-insights-grid{grid-template-columns:1fr!important}}`}</style>
  </section>;
}
