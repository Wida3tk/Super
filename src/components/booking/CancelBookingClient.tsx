// src/components/booking/CancelBookingClient.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cancelBookingByToken } from '@/lib/actions/bookingActions';
import { useRouter } from 'next/navigation';

interface Props {
  token: string;
  locale: string;
}

export default function CancelBookingClient({ token, locale }: Props) {
  const t = useTranslations('manageBooking');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setCancelling(true);
    setError('');

    const result = await cancelBookingByToken(token, locale as 'ar' | 'en');

    if (result.success) {
      router.refresh(); // يعيد تحميل الصفحة لإظهار الحالة الجديدة
    } else {
      setError(result.error || 'UNKNOWN_ERROR');
      setCancelling(false);
    }
  };

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full border border-red-500/50 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl transition-colors text-sm font-medium"
      >
        ✕ {t('cancelBooking')}
      </button>
    );
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
      <p className="text-red-300 text-sm mb-4">{t('cancelConfirm')}</p>

      {error && (
        <p className="text-red-400 text-xs mb-3">{tErrors(error as any)}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {cancelling ? t('cancelling') : t('cancelConfirmBtn')}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={cancelling}
          className="flex-1 border border-slate-600 text-slate-300 text-sm py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          {t('keepBooking')}
        </button>
      </div>
    </div>
  );
}
