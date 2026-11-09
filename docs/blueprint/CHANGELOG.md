# سجل التغييرات — خطة الأيام العشرة

## اليومان 1–2: القواعد الصحيحة (فرع `build/d01-rules`)

| المهمة | ما تغيّر | الملفات | الاختبار |
| --- | --- | --- | --- |
| D1.1 إصدارات القواعد | القواعد صارت بيانات بإصدارات (`QABA-QBA-1500`، `QABA-QBA-2000`، `QABA-QASP-S-1000`) مع روابط البورد. نسبة 5% ونطاق 20–140 من الساعات المستقلة حسب النموذج الشهري الرسمي (قرار 2026-11-09). | `src/lib/qaba/ruleSets.ts`، `src/lib/qaba/compliance.ts` | `compliance.test.ts`: 100 مستقل + 5 إشراف محقق، 100 + 4 ناقص ساعة، 140 مستقل داخل النطاق |
| D1.2 1500 أو 2000 | القاعدة بتاريخ بدء الميدان (`fieldworkStartDate` ثم أول ساعة معتمدة ثم تاريخ العقد)، وتنتهي قاعدة 1500 في 2029-01-01 لمن لم يكمل. `syncTraineeFieldworkTotals` يخزّن `fieldworkStartedAt`. صفحة المتدرب تعرض بدء الميدان والموعد. | `compliance.ts`، `syncTotals.ts`، `admin/trainees/[id]/page.tsx` | بدء 2025-06 ← 1500 حتى 2029 ثم 2000؛ أول ساعة تسبق تاريخ العقد |
| D1.3 الجماعي مرة واحدة | ساعات المشرف تُحسب بالجلسة لا بسطور المتدربين. | `src/lib/supervision/supervisorHours.ts`، `SupervisorMonthlyWork.tsx`، `AdminSupervisionPanel.tsx`، `supervisionPanelData.ts` وصفحات الإنتاجية والأشهر والإسناد | جماعية ساعة مع 3 متدربين + فردية نصف ساعة = 1.5 للمشرف |
| D1.4 الحسابات المحلية | أُزيلت حسابات 5% والأهداف الثابتة خارج محرك القواعد. الشاشات تقرأ مجاميع السجل (`traineeSupervisionHours`)، والعدّادات القديمة فقط لمن لم تُبنَ مجاميعه. العدّادات القديمة `@deprecated`. | `TraineeSupervisionWorkspace.tsx`، `TraineeMonthlyView.tsx`، `api/supervisor/session`، `ExportClient.tsx`، `directory.ts`، `admin/page.tsx` | `traineeSupervision.test.ts` |
| D1.4 سكربت التدقيق | `scripts/audit-hour-counters.cjs` (قراءة فقط): العدّادات مقابل السجل لكل متدرب. **يحتاج تشغيلًا على البيانات الحقيقية.** | `scripts/audit-hour-counters.cjs` | — |
| D1.5 التحقق | جلسة المشرف تُرفض: قبل المقررات، قبل بدء العقد، خارج 7 سنوات، بعد انتهاء اعتماد المشرف، أو مكررة. نشاط المتدرب يُفحص بنافذة 7 سنوات. الرسائل بالعربية تظهر في الواجهة. | `src/lib/validation/hourEligibility.ts`، `api/supervisor/session`، `api/trainee/activities` | `hourEligibility.test.ts`، 3 اختبارات جديدة في `session/route.test.ts` |

**ما لم يتغير:** البيانات المخزّنة. لا يوجد أي ترحيل أو كتابة على البيانات القديمة في هذا الفرع.

**بوابة العبور (أكتوبر = 129.5 ساعة):** تُتحقق على البيانات الحقيقية بعد النشر التجريبي، من صفحة الإنتاجية لشهر أكتوبر.
