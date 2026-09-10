"use client";

import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function DemoLauncher() {
  const [loading, setLoading] = useState<"supervisor" | "trainee" | null>(null);
  const [error, setError] = useState("");

  async function start(role: "supervisor" | "trainee") {
    setLoading(role); setError("");
    let visitorId = localStorage.getItem("sulukera_demo_visitor");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("sulukera_demo_visitor", visitorId);
    }
    try {
      const response = await fetch("/api/demo/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, visitorId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const credential = await signInWithCustomToken(auth, result.token);
      const token = await credential.user.getIdToken(true);
      const session = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!session.ok) throw new Error("SESSION_FAILED");
      window.location.href = result.destination;
    } catch {
      setError("تعذر بدء التجربة الآن. يرجى المحاولة مرة أخرى.");
      setLoading(null);
    }
  }

  return <div className="demo-actions">
    <button onClick={() => start("trainee")} disabled={Boolean(loading)}><span>تجربة المتدرب</span><small>استعرض جميع الخصائص والخدمات</small></button>
    <button onClick={() => start("supervisor")} disabled={Boolean(loading)}><span>تجربة المشرف</span><small>المتدربون والجلسات والساعات</small></button>
    {loading && <div className="demo-loading">جاري تجهيز مساحة التجربة...</div>}
    {error && <div className="demo-error">{error}</div>}
  </div>;
}
