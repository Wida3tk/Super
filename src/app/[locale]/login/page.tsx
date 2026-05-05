'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage({ params }: { params: { locale: string } }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();

      // حفظ التوكن في cookie
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const sessionData = await res.json().catch(() => ({}));
      const isAdmin = sessionData.isAdmin || false;

      if (isAdmin) {
        router.push('/ar/admin');
      } else {
        router.push('/ar/supervisor-dashboard');
      }
    } catch (err: any) {
      setError('البريد أو كلمة المرور غير صحيحة');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-white font-bold text-2xl mb-2 text-center">تسجيل دخول المشرف</h1>
        <p className="text-slate-400 text-sm text-center mb-8">منصة الإشراف الأكاديمي</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
