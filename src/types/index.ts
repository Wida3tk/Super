// src/types/index.ts

export type BookingStatus = 'confirmed' | 'cancelled' | 'rescheduled' | 'completed';

export interface Supervisor {
  id: string;
  name: string;
  email: string;
  photo: string;
  bio: string;
  totalSessions: number;
  ratingAverage: number;
  isActive: boolean;
}

export interface AvailabilitySlot {
  id: string;
  supervisorId: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm
  isBooked: boolean;
  bookingId?: string;
}

export interface Booking {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  supervisorId: string;
  supervisorName?: string;
  date: string;
  time: string;
  meetLink: string;
  googleEventId: string;
  status: BookingStatus;
  managementToken: string;
  referenceNumber?: string;
  availabilitySlotId?: string;
  reminderSent?: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  supervisorId: string;
  rating: number;        // 1–5
  comment: string;
  createdAt: string;
}

export interface CreateBookingPayload {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  supervisorId: string;
  availabilitySlotId: string;
  date: string;
  time: string;
}

export interface CalendarEventPayload {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  attendees: string[];
  description?: string;
}

export interface AdminStats {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  occupancyRate: number;
  sessionsBySupervisor: { supervisorId: string; name: string; count: number }[];
}
// ===========================
// سلوكيرا — أنواع نظام الإشراف
// ===========================

// رخصة المتدرب
export type License = "QASP-S" | "QBA";

// حالة المتدرب
export type TraineeStatus =
  | "onboarding" // قيد البوردنق
  | "active" // نشط
  | "paused" // مؤجل
  | "withdrawn" // منسحب
  | "completed"; // مكتمل

// مرحلة البوردنق
export type OnboardingStage =
  | "initial_interview" // مقابلة أولية
  | "post_interview" // ما بعد المقابلة
  | "contracting"; // التعاقد

// نوع الجلسة
export type SessionType =
  | "individual" // فردية
  | "group" // جماعية
  | "absence" // غياب
  | "warning"; // إنذار

// سبب الغياب
export type AbsenceReason =
  | "health" // ظرف صحي
  | "emergency" // ظرف طارئ
  | "notified_absence" // غياب بإشعار مسبق
  | "unnotified_absence" // غياب بدون إشعار
  | "trainee_postpone" // تأجيل بطلب من المتدرب
  | "other"; // أخرى

// سبب الإنذار
export type WarningReason =
  | "repeated_absence" // تكرار الغياب
  | "late_attendance" // عدم الالتزام بالمواعيد
  | "late_documents" // تأخر في تسليم المستندات
  | "policy_violation" // مخالفة سياسات البرنامج
  | "other"; // أخرى

// ===========================
// المتدرب
// ===========================
export interface Trainee {
  id: string;
  name: string;
  email: string;
  phone: string;
  license: License;
  requiredHours: 50 | 100; // QASP-S = 50, QBA = 100
  status: TraineeStatus;
  onboardingStage?: OnboardingStage; // فقط لو status = onboarding
  currentSupervisorId?: string;
  createdAt: string;
  updatedAt: string;
  // إحصائيات محسوبة (تتحدث عند كل جلسة)
  totalIndividualHours: number;
  totalGroupHours: number;
  totalHours: number;
}

// ===========================
// الإسناد (ربط المتدرب بالمشرف)
// ===========================
export interface Assignment {
  id: string;
  traineeId: string;
  supervisorId: string; // يطابق supervisors/{id} الموجود
  startDate: string;
  endDate?: string; // يُملأ عند النقل أو الإنهاء
  hoursAtTransfer?: number; // الساعات وقت النقل
  notes?: string;
  createdAt: string;
  createdBy: string; // adminId
}

// ===========================
// الجلسة
// ===========================
export interface Session {
  id: string;
  supervisorId: string;
  traineeIds: string[]; // مصفوفة — للجماعية أكثر من واحد
  type: SessionType;
  date: string; // "2026-05-06"
  month: string; // "2026-05"
  duration?: number; // بالساعة — فقط للفردية والجماعية
  absenceReason?: AbsenceReason; // فقط للغياب
  warningReason?: WarningReason; // فقط للإنذار
  notes?: string;
  createdAt: string;
  createdBy: string; // supervisorId أو adminId
}

// ===========================
// الملخص الشهري (snapshot)
// ===========================
export interface MonthlySnapshot {
  id: string; // "{supervisorId}_{traineeId}_{2026-05}"
  supervisorId: string;
  traineeId: string;
  month: string; // "2026-05"
  workHours: number; // ساعات عمل المتدرب — يدخلها المشرف
  requiredHours: number; // 5% من workHours — محسوبة تلقائياً
  individualHours: number; // مجموع الفردي هذا الشهر
  groupHours: number; // مجموع الجماعي هذا الشهر
  totalHours: number; // individualHours + groupHours
  groupPercentage: number; // (groupHours / totalHours) * 100
  absenceCount: number;
  warningCount: number;
  lockedAt?: string; // تاريخ القفل (تلقائي أو يدوي)
  lockedBy?: string; // "auto" أو adminId
  updatedAt: string;
}

// ===========================
// أنواع مساعدة للـ UI
// ===========================

// ملخص المشرف للشهر (للوحة الأدمن)
export interface SupervisorMonthlySummary {
  supervisorId: string;
  supervisorName: string;
  month: string;
  totalIndividual: number;
  totalGroup: number;
  totalHours: number;
  traineeCount: number;
  isLocked: boolean;
}

// بيانات التصدير
export interface ExportRow {
  supervisorName: string;
  traineeName: string;
  license: string;
  month: string;
  workHours: number;
  requiredHours: number;
  individualHours: number;
  groupHours: number;
  totalHours: number;
  absenceCount: number;
  warningCount: number;
  status: string;
}
