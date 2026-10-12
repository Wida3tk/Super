import { MAIN_STAGES, EXCEPTIONAL_ACTIONS, mainStageIndex } from "@/lib/lifecycle/presentation";
import { resolveLifecycleStage } from "@/lib/lifecycle/stages";

export default function SupervisionProgress({ trainee, transitions = [], requests = [] }: {
  trainee: any; transitions?: any[]; requests?: any[];
}) {
  const current = mainStageIndex(trainee, transitions);
  const stage = resolveLifecycleStage(trainee);
  const requestTypes: Record<string, string> = { approved_pause: "defer", supervisor_transfer: "change_supervisor", platform_suspension: "withdraw", financial_clearance: "financial_clearance" };
  const actions = EXCEPTIONAL_ACTIONS.filter((action) => action.key === stage ||
    requests.some((request) => request.type === requestTypes[action.key]) ||
    transitions.some((item) => item.toStage === action.key || item.fromStage === action.key));
  return <div dir="rtl" style={{ marginBottom: 18, fontFamily: "'IBM Plex Sans Arabic',Arial,sans-serif" }}>
    <section aria-label="المراحل الأساسية للإشراف" style={{ background: "linear-gradient(125deg,#001442,#0D40FC)", color: "white", borderRadius: 20, padding: 22 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>مسار الإشراف في سلوكيرا</h3>
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
        {MAIN_STAGES.map((item, index) => {
          const done = index < current || (index === 4 && stage === "completed");
          const active = index === current;
          return <li key={item.key} aria-current={active ? "step" : undefined} style={{ flex: "1 1 130px", padding: 12, borderRadius: 12, background: active ? "#FFFFFF" : "#ffffff12", color: active ? "#001442" : "white", border: active ? "2px solid #67E8F9" : "2px solid transparent" }}>
            <span style={{ display: "inline-grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: done ? "#99F6E4" : active ? "#DBEAFE" : "#ffffff20", color: done ? "#065F46" : "inherit", marginBottom: 8 }}>{done ? "✓" : index + 1}</span>
            <strong style={{ display: "block", fontSize: 14 }}>{item.label}</strong>
            <small style={{ display: "block", marginTop: 5, opacity: .85 }}>{done ? "مكتملة" : active ? "المرحلة الحالية" : "قادمة"}</small>
          </li>;
        })}
      </ol>
    </section>
    {!!actions.length && <section aria-label="الإجراءات الاستثنائية" style={{ marginTop: 12, background: "white", border: "1px solid #E2E8F0", borderRadius: 16, padding: 18, color: "#001442" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>الإجراءات الاستثنائية</h3>
      <p style={{ color: "#64748B", fontSize: 12 }}>إجراءات مرتبطة بملفك، ويظل مسار الإشراف الأساسي محفوظًا.</p>
      {actions.map((action) => <div key={action.key} style={{ padding: "9px 0", fontSize: 14 }}><strong>{action.label}</strong><span style={{ marginRight: 10, color: "#64748B", fontSize: 12 }}>{action.key === stage ? "الحالة الحالية" : "مسجل في الملف"}</span></div>)}
    </section>}
  </div>;
}
