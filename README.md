# 🎓 Supervision Booking Platform

منصة حجز جلسات الإشراف الأكاديمي — SaaS MVP جاهز للإنتاج

## المواصفات التقنية

| التقنية | الإصدار |
|---------|---------|
| Next.js | 14 (App Router) |
| TypeScript | 5.x |
| Tailwind CSS | 3.x |
| Firebase | 10.x (Auth + Firestore) |
| next-intl | 3.x |
| Google Calendar API | v3 |

---

## هيكل المشروع

```
supervision-booking/
├── messages/
│   ├── ar.json                    # الترجمة العربية
│   └── en.json                    # الترجمة الإنجليزية
├── public/
│   └── assets/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx          # Layout مع RTL/LTR
│   │   │   ├── page.tsx            # الصفحة الرئيسية - قائمة المشرفين
│   │   │   ├── supervisor/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # بروفايل المشرف + الحجز
│   │   │   ├── booking-success/
│   │   │   │   └── page.tsx        # تأكيد الحجز
│   │   │   ├── manage-booking/
│   │   │   │   └── [token]/
│   │   │   │       └── page.tsx    # إلغاء/إدارة الحجز
│   │   │   ├── supervisor-dashboard/
│   │   │   │   └── page.tsx        # لوحة المشرف
│   │   │   └── admin/
│   │   │       └── page.tsx        # لوحة الإدارة
│   │   └── api/
│   │       ├── book/route.ts        # API الحجز
│   │       ├── cancel/route.ts      # API الإلغاء
│   │       ├── availability/route.ts
│   │       └── calendar/route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── LanguageSwitcher.tsx
│   │   ├── booking/
│   │   │   ├── BookingForm.tsx
│   │   │   ├── SlotPicker.tsx
│   │   │   └── BookingCard.tsx
│   │   ├── supervisor/
│   │   │   ├── SupervisorCard.tsx
│   │   │   ├── SupervisorProfile.tsx
│   │   │   └── AvailabilityManager.tsx
│   │   └── admin/
│   │       ├── StatsCards.tsx
│   │       ├── BookingsTable.tsx
│   │       └── SupervisorsTable.tsx
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts           # Firebase Client SDK
│   │   │   ├── admin.ts            # Firebase Admin SDK
│   │   │   └── firestore.rules     # قواعد الأمان
│   │   ├── calendar/
│   │   │   └── googleCalendar.ts   # Google Calendar API
│   │   ├── email/
│   │   │   └── emailService.ts     # خدمة البريد
│   │   └── actions/
│   │       ├── bookingActions.ts   # Server Actions
│   │       └── supervisorActions.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useBooking.ts
│   ├── types/
│   │   └── index.ts                # TypeScript Types
│   └── i18n/
│       ├── routing.ts
│       └── request.ts
├── .env.local.example
├── next.config.ts
├── middleware.ts
└── package.json
```

---

## إعداد Firebase

### 1. إنشاء مشروع Firebase
```bash
# تثبيت Firebase CLI
npm install -g firebase-tools
firebase login
firebase init
```

### 2. تفعيل الخدمات المطلوبة
- Authentication → Email/Password
- Firestore Database
- Storage (للصور)

### 3. قواعد Firestore
```
انسخ محتوى src/lib/firebase/firestore.rules إلى Firebase Console
```

---

## إعداد Google Calendar API

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com)
2. أنشئ مشروعاً جديداً
3. فعّل **Google Calendar API**
4. أنشئ **Service Account**
5. شارك تقويم Google Workspace مع الـ Service Account
6. انسخ بيانات الاعتماد إلى `.env.local`

---

## متغيرات البيئة

```bash
cp .env.local.example .env.local
# ثم املأ القيم
```

---

## التثبيت والتشغيل

```bash
npm install
npm run dev
# http://localhost:3000
```

---

## النشر على Vercel

```bash
npm install -g vercel
vercel --prod
```

أضف جميع متغيرات البيئة في إعدادات Vercel Dashboard.

---

## ميزات المنصة

### للطالب (بدون حساب)
- ✅ تصفح المشرفين وبروفايلاتهم
- ✅ اختيار موعد متاح
- ✅ حجز جلسة خلال أقل من دقيقتين
- ✅ استلام بريد تأكيد مع رابط Google Meet
- ✅ رابط فريد لإدارة الحجز
- ✅ إلغاء الحجز بالتوكن

### للمشرف (بحساب)
- ✅ إضافة أوقات متاحة
- ✅ توليد تلقائي لشرائح 30 دقيقة
- ✅ إدارة الجلسات (إعادة جدولة / إلغاء)
- ✅ إحصائيات التقييمات

### للمدير
- ✅ لوحة إحصاءات شاملة
- ✅ تصدير البيانات CSV
- ✅ إيقاف/تفعيل المشرفين
- ✅ عرض التقييمات
