// src/types/index.ts

export type BookingStatus =
  "confirmed" | "cancelled" | "rescheduled" | "completed";

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
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
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
  bookingType?: "initial_interview" | "consultation";
  consultationType?: "behavior_analysis" | "organizational_behavior";
}

export interface Review {
  id: string;
  bookingId: string;
  supervisorId: string;
  rating: number; // 1–5
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
  bookingType?: "initial_interview" | "consultation";
  consultationType?: "behavior_analysis" | "organizational_behavior";
  password?: string;
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
  requiredHours: number;
  status: TraineeStatus;
  onboardingStage?: OnboardingStage; // فقط لو status = onboarding
  currentSupervisorId?: string;
  createdAt: string;
  updatedAt: string;
  // إحصائيات محسوبة (تتحدث عند كل جلسة)
  totalIndividualHours: number;
  totalGroupHours: number;
  totalHours: number;
  authUid?: string;
  accountStatus?: "invited" | "active";
}

export type FieldworkActivityType =
  "direct" | "indirect" | "supervision_direct" | "supervision_indirect";
export type FieldworkActivityStatus =
  "draft" | "submitted" | "approved" | "revision_requested" | "rejected";

export interface FieldworkActivity {
  id: string;
  traineeId: string;
  supervisorId: string;
  date: string;
  month: string;
  startTime: string;
  endTime: string;
  duration: number;
  activityType: FieldworkActivityType;
  setting?: "in_person" | "video";
  format?: "individual" | "group";
  observedWithClient?: boolean;
  description: string;
  activityCategory?:
    | "service_delivery"
    | "data_collection"
    | "data_analysis"
    | "assessment"
    | "program_development"
    | "reporting_graphing"
    | "stakeholder_training"
    | "fidelity_monitoring"
    | "person_centered_meeting"
    | "research_programming"
    | "other_aba";
  centerName?: string;
  clientCode?: string;
  planGoalId?: string;
  evidenceNote?: string;
  status: FieldworkActivityStatus;
  reviewerNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SupervisionDocumentType =
  | "contract"
  | "guardian_consent"
  | "center_approval"
  | "observation_consent"
  | "video_consent"
  | "data_consent"
  | "supervisor_credential"
  | "coursework"
  | "background_check"
  | "recommendation"
  | "final_verification"
  | "other";
export interface SupervisionDocument {
  id: string;
  traineeId: string;
  supervisorId: string;
  type: SupervisionDocumentType;
  title: string;
  centerName?: string;
  clientCode?: string;
  issuedAt: string;
  expiresAt?: string;
  status:
    | "uploaded"
    | "reviewed"
    | "replace_required"
    | "valid"
    | "expired"
    | "revoked";
  fileName?: string;
  fileUrl?: string;
  notes?: string;
  createdAt: string;
}
export interface MeetingMinute {
  id: string;
  traineeId: string;
  supervisorId: string;
  date: string;
  startTime: string;
  endTime: string;
  format: "individual" | "group";
  setting: "in_person" | "video";
  observedWithClient: boolean;
  agenda: string;
  discussion: string;
  decisions: string;
  actionItems: string;
  competencyIds: string[];
  planGoalIds: string[];
  acknowledgedByTrainee?: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CompetencyScore {
  competencyId: string;
  score: number;
  observationMethod: "live" | "role_play" | "discussion" | "work_product";
  note?: string;
}
export interface CompetencyAssessment {
  id: string;
  traineeId: string;
  supervisorId: string;
  date: string;
  period: "initial" | "quarterly";
  scores: CompetencyScore[];
  strengths?: string;
  developmentPriorities?: string;
  recommendation?: string;
  totalScore: number;
  maxScore: number;
  createdAt: string;
}
export interface SupervisionPlanGoal {
  id: string;
  domain: string;
  title: string;
  startDate?: string;
  dueDate?: string;
  masteryCriterion?: string;
  status: "not_started" | "in_progress" | "achieved" | "retrain";
  supervisorNote?: string;
  order: number;
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

export interface SupervisionAgreement {
  id: string;
  traineeId: string;
  currentSupervisorId: string;
  signedAt: string;
  effectiveFrom: string;
  durationMonths: number;
  financialTermMonths: number;
  plannedSupervisionHours: number;
  carriedSupervisionHours: number;
  noticeDays: number;
  status: "draft" | "active" | "paused" | "completed" | "terminated";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
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
  scheduledTime?: string;
  noticeGivenAt?: string;
  noticeHours?: number;
  timelyNotice?: boolean;
  absenceSequence?: number;
  recommendedAction?: "warning" | "billable_warning" | "admin_review";
  billingStatus?: "pending" | "not_billable" | "billable";
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
