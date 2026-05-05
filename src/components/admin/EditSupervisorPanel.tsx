'use client';

import { useState } from 'react';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  bio?: string;
  specialization?: string;
  photo?: string;
  isActive: boolean;
  totalSessions?: number;
}

interface Props {
  supervisors: Supervisor[];
}

export default function EditSupervisorPanel({ supervisors }: Props) {
  const [selected, setSelected] = useState<Supervisor | null>(null);
  const [form, setForm] = useState({ name: '', bio: '', specialization: '', photo: '', isActive: true });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const openEdit = (s: Supervisor) => {
    setSelected(s);
    setForm({
      name: s.name || '',
      bio: s.bio || '',
      specialization: s.specialization || '',
      photo: s.photo || '',
      isActive: s.isActive ?? true,
    });
    setMsg(''); setIsError(false); setPreviewError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true); setMsg(''); setIsError(false);

    try {
      const res = await fetch('/api/admin/update-supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg('✅ تم حفظ التغييرات بنجاح');
        setTimeout(() => window.location.reload(), 1400);
      } else {
        setIsError(true);
        setMsg('❌ حدث خطأ، حاولي مرة أخرى');
      }
    } catch {
      setIsError(true);
      setMsg('❌ خطأ في الاتصال');
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        .ep-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          padding: 24px;
        }
        .ep-card {
          border: 1.5px solid #EEF2F7;
          border-radius: 16px;
          padding: 20px;
          display: flex; align-items: center; gap: 16px;
          cursor: pointer; transition: all 0.18s;
          background: #FAFBFF;
        }
        .ep-card:hover {
          border-color: #0D40FC;
          background: #fff;
          box-shadow: 0 4px 16px rgba(13,64,252,0.1);
          transform: translateY(-2px);
        }
        .ep-avatar {
          width: 52px; height: 52px; border-radius: 14px;
          background: linear-gradient(135deg, #0D40FC, #55D7FF);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800; color: #fff;
          flex-shrink: 0; overflow: hidden;
          box-shadow: 0 3px 10px rgba(13,64,252,0.2);
        }
        .ep-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ep-info { flex: 1; min-width: 0; }
        .ep-name { font-size: 14px; font-weight: 700; color: #001442; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ep-email { font-size: 12px; color: #8898AA; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ep-status { margin-top: 6px; }
        .ep-badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 20px; }
        .ep-badge.on { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .ep-badge.off { background: rgba(100,116,139,0.08); color: #64748b; border: 1px solid rgba(100,116,139,0.15); }
        .ep-arrow { color: #CBD5E1; font-size: 18px; }

        /* MODAL */
        .ep-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,20,66,0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: epFade 0.18s ease;
        }
        @keyframes epFade { from{opacity:0} to{opacity:1} }

        .ep-modal {
          background: #fff; border-radius: 24px;
          width: 100%; max-width: 560px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 24px 64px rgba(1,20,66,0.22);
          animation: epSlide 0.22s ease;
        }
        @keyframes epSlide { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

        .ep-modal-head {
          background: linear-gradient(135deg, #001442, #002080);
          padding: 22px 28px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0;
        }
        .ep-modal-title { color: #fff; font-size: 16px; font-weight: 700; }
        .ep-modal-sub { color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 2px; }
        .ep-close {
          background: rgba(255,255,255,0.1); border: none;
          width: 32px; height: 32px; border-radius: 8px;
          color: rgba(255,255,255,0.7); font-size: 16px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; flex-shrink: 0;
        }
        .ep-close:hover { background: rgba(255,255,255,0.2); color: #fff; }

        .ep-photo-preview {
          margin: 24px 28px 0;
          display: flex; align-items: center; gap: 16px;
          padding: 16px;
          background: #F8FAFC; border-radius: 14px;
          border: 1px solid #EEF2F7;
        }
        .ep-preview-img {
          width: 64px; height: 64px; border-radius: 14px;
          background: linear-gradient(135deg, #0D40FC, #55D7FF);
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; font-weight: 800; color: #fff;
          flex-shrink: 0; overflow: hidden;
        }
        .ep-preview-img img { width: 100%; height: 100%; object-fit: cover; }
        .ep-preview-info { flex: 1; }
        .ep-preview-name { font-size: 14px; font-weight: 700; color: #001442; margin-bottom: 3px; }
        .ep-preview-hint { font-size: 12px; color: #8898AA; }

        .ep-body { padding: 20px 28px 8px; }
        .ep-field { margin-bottom: 18px; }
        .ep-label {
          display: block; font-size: 12px; font-weight: 700;
          color: #8898AA; margin-bottom: 7px; letter-spacing: 0.04em;
        }
        .ep-input, .ep-textarea {
          width: 100%; background: #F8FAFC;
          border: 1.5px solid #D1D9E6; color: #001442;
          border-radius: 10px; padding: 11px 14px;
          font-size: 14px; transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit; direction: rtl; resize: none;
        }
        .ep-input:focus, .ep-textarea:focus {
          outline: none; border-color: #0D40FC;
          box-shadow: 0 0 0 3px rgba(13,64,252,0.08);
          background: #fff;
        }
        .ep-input::placeholder, .ep-textarea::placeholder { color: #B0BEC5; }
        .ep-textarea { min-height: 100px; line-height: 1.7; }

        .ep-photo-hint {
          font-size: 11px; color: #94A3B8; margin-top: 5px;
          display: flex; align-items: center; gap: 4px;
        }

        .ep-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: #F8FAFC; border: 1.5px solid #EEF2F7;
          border-radius: 10px;
        }
        .ep-toggle-label { font-size: 14px; font-weight: 600; color: #001442; }
        .ep-toggle-sub { font-size: 12px; color: #8898AA; margin-top: 2px; }
        .ep-switch {
          position: relative; width: 44px; height: 24px;
          flex-shrink: 0;
        }
        .ep-switch input { opacity: 0; width: 0; height: 0; }
        .ep-slider {
          position: absolute; inset: 0; border-radius: 24px;
          background: #CBD5E1; transition: background 0.25s; cursor: pointer;
        }
        .ep-slider:before {
          content: '';
          position: absolute; width: 18px; height: 18px;
          left: 3px; top: 3px; border-radius: 50%;
          background: #fff; transition: transform 0.25s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        input:checked + .ep-slider { background: #10B981; }
        input:checked + .ep-slider:before { transform: translateX(20px); }

        .ep-msg {
          padding: 11px 14px; border-radius: 10px;
          font-size: 13px; font-weight: 500;
          margin: 0 28px 16px;
        }
        .ep-msg.ok { background: rgba(16,185,129,0.08); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .ep-msg.err { background: rgba(239,68,68,0.08); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }

        .ep-footer {
          display: flex; gap: 10px;
          padding: 12px 28px 28px;
          position: sticky; bottom: 0; background: #fff;
          border-top: 1px solid #EEF2F7; margin-top: 8px;
        }
        .ep-btn-cancel {
          flex: 1; background: #F1F5F9; color: #4A5568;
          border: none; border-radius: 12px; padding: 13px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          transition: background 0.15s; font-family: inherit;
        }
        .ep-btn-cancel:hover { background: #E2E8F0; }
        .ep-btn-save {
          flex: 2; background: #0D40FC; color: #fff;
          border: none; border-radius: 12px; padding: 13px;
          font-size: 14px; font-weight: 700; cursor: pointer;
          transition: all 0.18s; font-family: inherit;
          box-shadow: 0 2px 8px rgba(13,64,252,0.25);
        }
        .ep-btn-save:hover:not(:disabled) { background: #0929b4; box-shadow: 0 5px 16px rgba(13,64,252,0.35); }
        .ep-btn-save:disabled { background: #CBD5E1; box-shadow: none; cursor: not-allowed; }

        .ep-profile-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: #0D40FC; text-decoration: none;
          background: rgba(13,64,252,0.06); padding: 4px 10px;
          border-radius: 8px; border: 1px solid rgba(13,64,252,0.15);
          transition: all 0.15s; margin-top: 6px;
        }
        .ep-profile-link:hover { background: rgba(13,64,252,0.12); }
      `}</style>

      {/* SUPERVISOR CARDS */}
      {supervisors.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#8898AA', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.3 }}>👤</div>
          لا يوجد مشرفون — أضف أول مشرف الآن
        </div>
      ) : (
        <div className="ep-grid">
          {supervisors.map(s => (
            <div key={s.id} className="ep-card" onClick={() => openEdit(s)}>
              <div className="ep-avatar">
                {s.photo
                  ? <img src={s.photo} alt={s.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : (s.name || 'م')[0]
                }
              </div>
              <div className="ep-info">
                <div className="ep-name">{s.name}</div>
                <div className="ep-email">{s.email}</div>
                <div className="ep-status">
                  <span className={`ep-badge ${s.isActive ? 'on' : 'off'}`}>
                    {s.isActive ? '● نشط' : '○ موقوف'}
                  </span>
                </div>
              </div>
              <span className="ep-arrow">←</span>
            </div>
          ))}
        </div>
      )}

      {/* EDIT MODAL */}
      {selected && (
        <div className="ep-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="ep-modal" dir="rtl">

            <div className="ep-modal-head">
              <div>
                <div className="ep-modal-title">تعديل بيانات المشرف</div>
                <div className="ep-modal-sub">{selected.email}</div>
              </div>
              <button className="ep-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* PHOTO PREVIEW */}
            <div className="ep-photo-preview">
              <div className="ep-preview-img">
                {form.photo && !previewError
                  ? <img src={form.photo} alt="preview" onError={() => setPreviewError(true)} />
                  : (form.name || selected.name || 'م')[0]
                }
              </div>
              <div className="ep-preview-info">
                <div className="ep-preview-name">{form.name || selected.name}</div>
                <div className="ep-preview-hint">معاينة الصورة الشخصية</div>
                <a
                  href={`/ar/supervisor/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ep-profile-link"
                >
                  🔗 فتح صفحة المشرف العامة ↗
                </a>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="ep-body">

                <div className="ep-field">
                  <label className="ep-label">الاسم الكامل</label>
                  <input
                    className="ep-input"
                    type="text"
                    placeholder="د. أحمد المنصوري"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="ep-field">
                  <label className="ep-label">التخصص</label>
                  <input
                    className="ep-input"
                    type="text"
                    placeholder="تحليل السلوك التطبيقي · ABA"
                    value={form.specialization}
                    onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
                  />
                </div>

                <div className="ep-field">
                  <label className="ep-label">رابط الصورة الشخصية</label>
                  <input
                    className="ep-input"
                    type="url"
                    placeholder="https://..."
                    value={form.photo}
                    onChange={e => { setPreviewError(false); setForm(p => ({ ...p, photo: e.target.value })); }}
                  />
                  <div className="ep-photo-hint">
                    💡 يمكن استخدام رابط من Google Drive أو LinkedIn أو أي موقع
                  </div>
                </div>

                <div className="ep-field">
                  <label className="ep-label">النبذة التعريفية</label>
                  <textarea
                    className="ep-textarea"
                    placeholder="اكتب نبذة مفصلة عن المشرف — خبراته، شهاداته، مجالات تخصصه..."
                    value={form.bio}
                    onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="ep-field">
                  <div className="ep-toggle-row">
                    <div>
                      <div className="ep-toggle-label">حالة الحساب</div>
                      <div className="ep-toggle-sub">
                        {form.isActive ? 'المشرف نشط ويظهر للطلاب' : 'الحساب موقوف ولا يظهر للطلاب'}
                      </div>
                    </div>
                    <label className="ep-switch">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                      />
                      <span className="ep-slider" />
                    </label>
                  </div>
                </div>

              </div>

              {msg && <div className={`ep-msg ${isError ? 'err' : 'ok'}`}>{msg}</div>}

              <div className="ep-footer">
                <button type="button" className="ep-btn-cancel" onClick={() => setSelected(null)}>إلغاء</button>
                <button type="submit" className="ep-btn-save" disabled={loading}>
                  {loading ? '⏳ جارٍ الحفظ...' : '💾 حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
