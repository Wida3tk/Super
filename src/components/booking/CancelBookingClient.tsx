'use client';

import { useState } from 'react';
import { cancelBookingByToken } from '@/lib/actions/bookingActions';
import { useRouter } from 'next/navigation';

interface Props { token: string; locale: string; }

export default function CancelBookingClient({ token, locale }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setCancelling(true); setError('');
    const result = await cancelBookingByToken(token, locale as 'ar' | 'en');
    if (result.success) {
      router.refresh();
    } else {
      const errMap: Record<string,string> = {
        SESSION_ALREADY_PASSED: 'انتهى وقت الجلسة، لا يمكن الإلغاء',
        BOOKING_NOT_FOUND: 'الحجز غير موجود',
      };
      setError(errMap[result.error||''] || 'حدث خطأ، حاول مرة أخرى');
      setCancelling(false);
    }
  };

  if (!showConfirm) {
    return (
      <button onClick={() => setShowConfirm(true)} style={{
        width:'100%', padding:'12px', borderRadius:12,
        border:'1.5px solid rgba(239,68,68,0.3)',
        background:'rgba(239,68,68,0.05)', color:'#dc2626',
        fontSize:13, fontWeight:600, cursor:'pointer',
        transition:'all .18s', fontFamily:'inherit',
      }}>
        ✕ إلغاء الحجز
      </button>
    );
  }

  return (
    <div style={{background:'rgba(239,68,68,0.06)',border:'1.5px solid rgba(239,68,68,0.2)',borderRadius:14,padding:'16px 20px'}}>
      <p style={{fontSize:13,color:'#dc2626',marginBottom:12,fontWeight:600}}>
        ⚠️ هل أنت متأكد من إلغاء الحجز؟ لا يمكن التراجع عن هذا الإجراء.
      </p>
      {error && <p style={{fontSize:12,color:'#dc2626',marginBottom:10,background:'rgba(239,68,68,0.08)',padding:'8px 12px',borderRadius:8}}>{error}</p>}
      <div style={{display:'flex',gap:8}}>
        <button onClick={handleCancel} disabled={cancelling} style={{
          flex:1, background:'#dc2626', color:'#fff', border:'none',
          borderRadius:10, padding:'11px', fontSize:13, fontWeight:700,
          cursor:'pointer', fontFamily:'inherit', opacity: cancelling ? 0.7 : 1,
        }}>
          {cancelling ? '⏳ جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
        </button>
        <button onClick={() => setShowConfirm(false)} disabled={cancelling} style={{
          flex:1, background:'#F1F5F9', color:'#4A5568', border:'none',
          borderRadius:10, padding:'11px', fontSize:13, fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
        }}>
          تراجع
        </button>
      </div>
    </div>
  );
}
