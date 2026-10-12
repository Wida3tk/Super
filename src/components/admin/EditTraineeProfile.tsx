"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export default function EditTraineeProfile({ trainee }: { trainee: { id: string; name: string; email: string; phone?: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: trainee.name, email: trainee.email, phone: trainee.phone || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/trainee-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traineeId: trainee.id, ...form }) });
      if (!response.ok) { const data = await response.json(); setError(["EMAIL_EXISTS", "IDENTITY_EXISTS"].includes(data.error) ? "البريد أو الجوال مستخدم في ملف آخر، أو تغيرت البيانات. حدّث الصفحة وحاول مجددًا." : "تعذر الحفظ. تحقق من البيانات وحاول مجددًا."); return; }
      setOpen(false); router.refresh();
    } catch { setError("تعذر الاتصال. حاول مجددًا."); } finally { setSaving(false); }
  }
  return <><button type="button" onClick={() => { setOpen(true); setError(""); }} style={{ font: "inherit", color: "#fff", background: "#ffffff18", border: "1px solid #ffffff42", borderRadius: 10, padding: "9px 13px", cursor: "pointer" }}>✎ تعديل البيانات</button>
    {open && <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 1300, background: "#001442aa", display: "grid", placeItems: "center", padding: 18 }}><section role="dialog" aria-modal="true" aria-label="تعديل بيانات المتدرب" style={{ background: "white", color: "#001442", width: "min(500px,100%)", padding: 24, borderRadius: 18 }}><h3 style={{marginTop:0}}>تعديل بيانات المتدرب</h3><p style={{fontSize:12,color:"#64748b"}}>البريد الجديد سيكون بريد تسجيل الدخول. الساعات والإسناد تبقى محفوظة.</p><form onSubmit={save} style={{display:"grid",gap:14}}>{([["name","الاسم الكامل"],["email","البريد الإلكتروني"],["phone","رقم الجوال"]] as const).map(([key,label])=><label key={key} style={{display:"grid",gap:6,fontSize:13}}>{label}<input required={key!=="phone"} type={key==="email"?"email":key==="phone"?"tel":"text"} dir={key==="name"?"rtl":"ltr"} value={form[key]} onChange={event=>setForm({...form,[key]:event.target.value})} style={{font:"inherit",padding:11,border:"1px solid #CBD5E1",borderRadius:9,color:"#001442"}} /></label>)}{error&&<p role="alert" style={{color:"#b91c1c",fontSize:12}}>{error}</p>}<div style={{display:"flex",gap:8}}><button disabled={saving} style={{font:"inherit",background:"#0d40fc",color:"white",border:0,borderRadius:9,padding:11}}>{saving?"جاري الحفظ...":"حفظ البيانات"}</button><button type="button" disabled={saving} onClick={()=>setOpen(false)} style={{font:"inherit",padding:11,borderRadius:9,border:"1px solid #CBD5E1",background:"white",color:"#475569"}}>إلغاء</button></div></form></section></div>}</>;
}
