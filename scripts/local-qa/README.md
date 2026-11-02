# بيئة الاختبار المحلية (بيانات وهمية فقط)

هذه الأدوات تشغّل النظام على **Firebase Emulator** ببيانات تجريبية مُولَّدة، ولا تتصل بقاعدة البيانات الحقيقية إطلاقاً
(`seed.cjs` يرفض العمل إن لم تكن متغيرات الـ emulator مضبوطة).

## التشغيل

من جذر المشروع، في ثلاث نوافذ طرفية:

```bash
# 1) الـ emulator (يحتاج firebase-tools و Java)
cd scripts/local-qa/emulator && npx firebase-tools emulators:start --project demo-super --only auth,firestore,storage
```

```bash
# 2) تطبيق Next
. scripts/local-qa/env.sh && npx next dev -p 3000
```

```bash
# 3) تعبئة البيانات التجريبية (18 متدرب، 4 مشرفين، ساعات أكتوبر/نوفمبر 2026)
. scripts/local-qa/env.sh && node scripts/local-qa/seed.cjs
```

حسابات الدخول (كلمة المرور `Passw0rd!x`):

| الدور | البريد |
| --- | --- |
| إدارة | admin@sulukera.test |
| مشرف | hind@sulukera.test |
| متدرب | trainee1@example.test |

## لقطات الشاشة

```bash
mkdir -p scripts/local-qa/shots && node scripts/local-qa/shots.cjs scripts/local-qa/shots
```

تلتقط كل الصفحات بعرض 1440 و390 وتطبع عرض التمرير الأفقي لكل صفحة. يحتاج `playwright` مثبتاً.
