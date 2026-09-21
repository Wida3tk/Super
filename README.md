# 🎓 Sulukera Supervision Platform

منصة ثنائية اللغة لإدارة رحلة الإشراف المهني: التسجيل، المقابلات والحجوزات، إسناد المتدربين، الساعات الشهرية، الملفات، الموافقات، والإشعارات.

## التقنيات

| التقنية | الإصدار المستخدم |
|---|---|
| Next.js | 16 (App Router) |
| React | 19 |
| TypeScript | 5.x |
| Firebase | 12 (Auth + Firestore + Storage) |
| Firebase Admin | 13 |
| next-intl | 4 |
| Tailwind CSS | 3 |
| Vitest | 4 |
| Google Calendar / Drive | Google APIs |

يتطلب المشروع Node.js 24 أو أحدث.

## البوابات والميزات

- واجهة عامة عربية وإنجليزية لعرض المشرفين والاستشاريين والمواعيد.
- تسجيل المتدرب وحجز المقابلة الأولية أو الاستشارة.
- بوابة المتدرب للساعات والأنشطة والملفات والطلبات والموافقات.
- بوابة المشرف للجلسات والحجوزات والمقاعد والمتدربين والعمل الشهري.
- بوابة المدير للحسابات والإسناد والاستيراد والتصدير والمراقبة والإشعارات.
- تكامل Google Calendar لإنشاء الاجتماعات وGoogle Drive لملفات الإشراف.
- رسائل تأكيد وتذكير بالبريد.
- حماية صلاحيات، Rate Limiting، رؤوس أمنية، وسجل نشاط.

## التشغيل محليًا

```bash
npm ci
copy .env.local.example .env.local
npm run dev
```

ثم افتح `http://localhost:3000`.

املأ متغيرات `.env.local` قبل اختبار تسجيل الدخول أو Firebase أو Google APIs. لا ترفع الملف إلى Git.

## فحوص الجودة

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Actions يشغّل الفحوص الأربعة تلقائيًا لكل push إلى `main` ولكل Pull Request.

## الخدمات المطلوبة

### Firebase

- Authentication مع Email/Password.
- Firestore Database باسم `default`.
- Storage لصور المشرفين والمستندات القديمة.
- نشر القواعد الموجودة في `src/lib/firebase/firestore.rules`.

### Google Workspace

- Service Account مفعل له Google Calendar API وGoogle Drive API.
- مشاركة التقويم مع الحساب الخدمي.
- إعداد التفويض أو impersonation لحساب Drive عند استخدام Workspace.

### البريد

اضبط `EMAIL_SERVICE_API_KEY` وبيانات المرسل. عند غياب المفتاح تعمل العمليات الأساسية، لكن لن تصل رسائل التأكيد والدعوات.

## متغيرات الأمان

- `ADMIN_EMAIL`: البريد الوحيد المخول كبوابة مدير.
- `RATE_LIMIT_SALT`: قيمة عشوائية طويلة لعزل مفاتيح تحديد المعدل بين البيئات.
- `CRON_SECRET`: سر عشوائي لا يقل عن 16 حرفًا لحماية مهمة التذكيرات.
- `FIREBASE_PRIVATE_KEY_BASE64`: البديل المفضل للمفتاح متعدد الأسطر على منصات الاستضافة.

راجع [.env.local.example](./.env.local.example) للقائمة الكاملة.

## النشر

1. أضف متغيرات البيئة إلى Vercel.
2. انشر قواعد Firestore وتأكد من الفهارس المطلوبة.
3. اضبط Cron ليستدعي `/api/cron/reminders` مع `Authorization: Bearer <CRON_SECRET>`.
4. شغّل فحوص الجودة.
5. انشر إلى Vercel ثم نفّذ اختبارًا تجريبيًا كاملًا على حسابات اختبار.

## ملاحظات تشغيلية

- حذف جلسة الإشراف حذف منطقي يحافظ على سجل التدقيق ويعكس الساعات والإجماليات ذريًا.
- روابط إدارة الحجز تعتمد توكنًا عشوائيًا قويًا؛ لا تشارك الرابط علنًا.
- بيانات تحديد المعدل لا تخزن عنوان IP الخام.
- لا تصبح تعديلات قواعد Firestore فعالة حتى تُنشر إلى مشروع Firebase.
