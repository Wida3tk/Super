"use client";
const messages: Record<string, string> = {
  UNAUTHORIZED: "انتهت الجلسة أو عُطّل الوصول. سجّل الدخول مجددًا.", FORBIDDEN: "هذا الإجراء أو الملف خارج صلاحيتك.", ACCESS_DISABLED: "عُطّل الوصول أو تغيّر نطاقه.",
  EMAIL_EXISTS: "البريد مستخدم مسبقًا. استخدم بريدًا وظيفيًا مستقلًا.", PHONE_EXISTS: "الرقم مستخدم في ملف آخر.", INVALID_DATA: "تحقق من الحقول والنطاق المحدد.",
  INVALID_SCOPE: "اختيار المشرفين غير صالح أو يتضمن حسابًا غير نشط.", INVALID_FILE: "اختر ملف PDF أو صورة أو Word بحجم لا يتجاوز 10MB وعنوانًا واضحًا.",
  ACTION_NOT_ALLOWED: "هذه العملية غير متاحة للمساعد.", AUTH_UPDATE_FAILED_ACCESS_DISABLED: "تعذر تحديث تسجيل الدخول؛ أُبقي الحساب معطّلًا للأمان. حاول مجددًا.",
};
export async function assistantFetch(path: string, body?: Record<string, unknown> | FormData, method?: string) {
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(path, { method: method || (body ? "POST" : "GET"), cache: "no-store", signal: controller.signal,
      ...(body instanceof FormData ? { body } : body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(messages[data.error] || "تعذر تنفيذ العملية؛ تحقق من الحالة قبل إعادة المحاولة.");
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("انتهت مهلة الاتصال. حدّث البيانات للتحقق قبل تكرار العملية.");
    throw error;
  } finally { clearTimeout(deadline); }
}
