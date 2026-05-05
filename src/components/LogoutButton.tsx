'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useState } from 'react';

export default function LogoutButton({ locale = 'ar' }: { locale?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push(`/${locale}/login`);
    } catch {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} disabled={loading} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.25)',
      padding: '7px 16px', borderRadius: 8,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.18s', fontFamily: 'inherit',
      opacity: loading ? 0.6 : 1,
    }}>
      {loading ? '⏳' : '⏻'} {loading ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
    </button>
  );
}
