"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/lib/actions/bookingActions";

interface BookingSectionProps {
  supervisor: any;
  availableDates: string[];
  locale: string;
  bookingType?: "initial_interview" | "consultation";
}

export default function BookingSection({
  supervisor,
  availableDates,
  locale,
  bookingType = "initial_interview",
}: BookingSectionProps) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const dates = availableDates;

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/availability?supervisorId=${supervisor.id}&date=${date}`,
      );
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotSelect = (slot: any) => {
    setSelectedSlot(slot);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setError("");
    const result = await createBooking(
      {
        studentName,
        studentEmail,
        studentPhone,
        supervisorId: supervisor.id,
        availabilitySlotId: selectedSlot.id,
        date: selectedSlot.date,
        time: selectedSlot.time,
        bookingType,
        password,
      },
      locale as "ar" | "en",
    );
    if (!result.success && result.error === "NO_SEATS_AVAILABLE") {
      setError("عذراً، المقاعد امتلأت للتو. يرجى التواصل مع المشرف مباشرة.");
      setSubmitting(false);
      return;
    }
    if (!result.success && result.error === "ACCOUNT_EXISTS") {
      setError(
        "يوجد حساب بهذا البريد بالفعل. سجل الدخول إلى حسابك لحجز موعد جديد.",
      );
      setSubmitting(false);
      return;
    }
    if (result.success) {
      router.push(
        `/${locale}/booking-success?token=${result.managementToken}&ref=${result.referenceNumber}&date=${selectedSlot.date}&time=${selectedSlot.time}&supervisor=${encodeURIComponent(supervisor.name)}`,
      );
    } else {
      setError(result.error || "حدث خطأ، حاول مرة أخرى");
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("ar-SA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <>
      <style>{`
        .bk-root { direction: rtl; }

        /* STEPS */
        .bk-steps {
          display: flex; align-items: center; gap: 0;
          margin-bottom: 28px;
          background: #F8FAFC; border-radius: 14px; padding: 4px;
          border: 1px solid #EEF2F7;
        }
        .bk-step {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 16px; border-radius: 10px;
          font-size: 13px; font-weight: 600; color: #94A3B8;
          cursor: pointer; transition: all 0.2s;
        }
        .bk-step.active {
          background: #fff; color: #001442;
          box-shadow: 0 2px 8px rgba(1,20,66,0.1);
        }
        .bk-step.done { color: #10B981; }
        .bk-step-num {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800;
          background: #EEF2F7; color: #94A3B8;
        }
        .bk-step.active .bk-step-num { background: #0D40FC; color: #fff; }
        .bk-step.done .bk-step-num { background: #10B981; color: #fff; }
        .bk-step-divider { width: 1px; height: 24px; background: #EEF2F7; }

        /* DATE SELECT */
        .bk-label {
          font-size: 12px; font-weight: 700; color: #64748B;
          text-transform: uppercase; letter-spacing: 0.06em;
          margin-bottom: 8px; display: block;
        }
        .bk-select {
          width: 100%; padding: 12px 16px;
          border: 1.5px solid #D1D9E6; border-radius: 12px;
          font-size: 14px; font-weight: 500; color: #001442;
          background: #fff; cursor: pointer;
          outline: none; transition: border-color 0.18s;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: left 14px center;
        }
        .bk-select:focus { border-color: #0D40FC; box-shadow: 0 0 0 3px rgba(13,64,252,0.08); }

        /* TIME SLOTS */
        .slots-grid {
          display: grid; grid-template-columns: repeat(4,1fr); gap: 8px;
          margin-top: 16px;
        }
        @media(max-width:500px){ .slots-grid { grid-template-columns: repeat(3,1fr); } }
        .slot-btn {
          padding: 10px 6px; border-radius: 10px;
          font-size: 13px; font-weight: 600;
          border: 1.5px solid #D1D9E6; background: #fff;
          color: #001442; cursor: pointer;
          transition: all 0.16s; text-align: center;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
        }
        .slot-btn:hover { border-color: #0D40FC; color: #0D40FC; background: rgba(13,64,252,0.04); }
        .slot-btn.selected {
          border-color: #0D40FC; background: #0D40FC; color: #fff;
          box-shadow: 0 3px 10px rgba(13,64,252,0.25);
        }

        .slots-loading {
          text-align: center; padding: 24px;
          color: #94A3B8; font-size: 14px;
        }
        .slots-empty {
          text-align: center; padding: 24px;
          background: #F8FAFC; border-radius: 12px;
          border: 1px dashed #D1D9E6;
          color: #94A3B8; font-size: 13px;
          margin-top: 12px;
        }

        /* SELECTED SLOT BANNER */
        .selected-banner {
          background: linear-gradient(135deg, rgba(13,64,252,0.06), rgba(85,215,255,0.06));
          border: 1.5px solid rgba(13,64,252,0.15);
          border-radius: 14px; padding: 14px 18px;
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px;
        }
        .selected-banner-info { display: flex; align-items: center; gap: 10px; }
        .selected-banner-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(13,64,252,0.1);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .selected-banner-date { font-size: 14px; font-weight: 700; color: #001442; }
        .selected-banner-time { font-size: 12px; color: #0D40FC; font-weight: 600; margin-top: 1px; }
        .selected-banner-duration {
          font-size: 11px; font-weight: 700; color: #10B981;
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2);
          padding: 3px 10px; border-radius: 20px;
        }
        .change-btn {
          background: none; border: 1px solid #D1D9E6; color: #64748B;
          font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px;
          cursor: pointer; font-family: 'IBM Plex Sans Arabic', sans-serif;
          transition: all 0.15s;
        }
        .change-btn:hover { border-color: #0D40FC; color: #0D40FC; }

        /* FORM */
        .bk-field { margin-bottom: 16px; }
        .bk-input {
          width: 100%; padding: 12px 16px;
          border: 1.5px solid #D1D9E6; border-radius: 12px;
          font-size: 14px; color: #001442;
          background: #fff; outline: none;
          transition: all 0.18s;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
        }
        .bk-input::placeholder { color: #CBD5E1; }
        .bk-input:focus { border-color: #0D40FC; box-shadow: 0 0 0 3px rgba(13,64,252,0.08); }

        .bk-error {
          display: flex; align-items: center; gap: 8px;
          background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px; padding: 12px 16px;
          color: #DC2626; font-size: 13px; font-weight: 500;
          margin-bottom: 16px;
        }

        .bk-submit {
          width: 100%; padding: 14px;
          background: #0D40FC; color: #fff;
          border: none; border-radius: 14px;
          font-size: 15px; font-weight: 800;
          cursor: pointer; transition: all 0.2s;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          box-shadow: 0 4px 14px rgba(13,64,252,0.3);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .bk-submit:hover:not(:disabled) {
          background: #0929b4;
          box-shadow: 0 6px 20px rgba(13,64,252,0.4);
          transform: translateY(-1px);
        }
        .bk-submit:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; transform: none; }

        .bk-note {
          text-align: center; font-size: 11px; color: #94A3B8;
          margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 4px;
        }

        /* NO DATES */
        .no-dates {
          text-align: center; padding: 40px 24px;
          background: #F8FAFC; border-radius: 16px;
          border: 1px dashed #D1D9E6;
        }
        .no-dates-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.4; }
        .no-dates-text { color: #94A3B8; font-size: 14px; line-height: 1.6; }
      `}</style>

      <div className="bk-root">
        <div
          style={{
            background: bookingType === "consultation" ? "#F0FDF4" : "#EEF4FF",
            color: bookingType === "consultation" ? "#047857" : "#0D40FC",
            borderRadius: 11,
            padding: "10px 13px",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          {bookingType === "consultation"
            ? "استشارة مهنية فردية عن بُعد"
            : "مقابلة أولية لبدء برنامج الإشراف"}
        </div>

        {/* No dates at all */}
        {dates.length === 0 ? (
          <div className="no-dates">
            <div className="no-dates-icon">📅</div>
            <div className="no-dates-text">
              لا توجد مواعيد متاحة حالياً
              <br />
              يرجى التواصل مع المشرف مباشرة
            </div>
          </div>
        ) : (
          <>
            {/* STEPS */}
            <div className="bk-steps">
              <div
                className={`bk-step ${step === 1 ? "active" : "done"}`}
                onClick={() => setStep(1)}
              >
                <div className="bk-step-num">{step > 1 ? "✓" : "١"}</div>
                اختر الموعد
              </div>
              <div className="bk-step-divider" />
              <div className={`bk-step ${step === 2 ? "active" : ""}`}>
                <div className="bk-step-num">٢</div>
                بيانات الحجز
              </div>
            </div>

            {/* STEP 1: DATE & TIME */}
            {step === 1 && (
              <div>
                <label className="bk-label">📅 اختر التاريخ</label>
                <select
                  className="bk-select"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                >
                  <option value="">— اختر تاريخاً —</option>
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {formatDate(d)}
                    </option>
                  ))}
                </select>

                {loadingSlots && (
                  <div className="slots-loading">
                    ⏳ جارٍ تحميل الأوقات المتاحة...
                  </div>
                )}

                {!loadingSlots && selectedDate && slots.length === 0 && (
                  <div className="slots-empty">
                    🕐 لا توجد أوقات متاحة في هذا اليوم، اختر تاريخاً آخر
                  </div>
                )}

                {!loadingSlots && slots.length > 0 && (
                  <>
                    <label className="bk-label" style={{ marginTop: 20 }}>
                      🕐 اختر الوقت
                    </label>
                    <div className="slots-grid">
                      {slots.map((slot) => (
                        <button
                          key={slot.id}
                          className={`slot-btn ${selectedSlot?.id === slot.id ? "selected" : ""}`}
                          onClick={() => handleSlotSelect(slot)}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STEP 2: FORM */}
            {step === 2 && (
              <div>
                {/* Selected slot banner */}
                {selectedSlot && (
                  <div className="selected-banner">
                    <div className="selected-banner-info">
                      <div className="selected-banner-icon">🗓</div>
                      <div>
                        <div className="selected-banner-date">
                          {formatDate(selectedSlot.date)}
                        </div>
                        <div className="selected-banner-time">
                          الساعة {selectedSlot.time}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span className="selected-banner-duration">٣٠ دقيقة</span>
                      <button className="change-btn" onClick={() => setStep(1)}>
                        تغيير
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="bk-field">
                    <label className="bk-label">👤 الاسم الكامل</label>
                    <input
                      className="bk-input"
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="أدخل اسمك الكامل"
                      required
                    />
                  </div>
                  <div className="bk-field">
                    <label className="bk-label">✉️ البريد الإلكتروني</label>
                    <input
                      className="bk-input"
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="example@email.com"
                      required
                    />
                  </div>
                  <div className="bk-field">
                    <label className="bk-label">📱 رقم الجوال</label>
                    <input
                      className="bk-input"
                      type="tel"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      placeholder="+966 5X XXX XXXX"
                      required
                    />
                  </div>

                  <div className="bk-field">
                    <label className="bk-label">كلمة مرور حسابك</label>
                    <input
                      className="bk-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="8 أحرف على الأقل"
                      required
                    />
                    <div className="bk-note">
                      ستستخدم البريد وكلمة المرور للدخول ومتابعة جميع مواعيدك.
                    </div>
                  </div>

                  {error && <div className="bk-error">⚠️ {error}</div>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="bk-submit"
                  >
                    {submitting ? (
                      <>⏳ جارٍ تأكيد الحجز...</>
                    ) : (
                      <>
                        ✅ تأكيد حجز{" "}
                        {bookingType === "consultation"
                          ? "الاستشارة"
                          : "المقابلة"}
                      </>
                    )}
                  </button>
                  <div className="bk-note">🔒 بياناتك محمية وآمنة تماماً</div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
