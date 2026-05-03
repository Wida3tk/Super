// src/components/admin/AdminDashboardClient.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface Props {
  stats: any;
  bookings: any[];
  supervisors: any[];
  reviews: any[];
  locale: string;
}

export default function AdminDashboardClient({ stats, bookings, supervisors, reviews, locale }: Props) {
  const t = useTranslations('admin');
  const [activeTab, setActiveTab] = useState<'supervisors' | 'bookings' | 'reviews'>('supervisors');

  const exportCSV = () => {
    const headers = ['ID', 'Student Name', 'Student Email', 'Supervisor ID', 'Date', 'Time', 'Status', 'Meet Link', 'Created At'];
    const rows = bookings.map((b: any) => [
      b.id, b.studentName, b.studentEmail, b.supervisorId, b.date, b.time, b.status, b.meetLink, b.createdAt
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSupervisor = async (supervisorId: string, currentStatus: boolean) => {
    // Server Action call via API
    await fetch('/api/admin/supervisor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supervisorId, isActive: !currentStatus }),
    });
    window.location.reload();
  };

  return (
    <div>
      {/* Tabs + Export */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          {(['supervisors', 'bookings', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {t(tab)}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          📥 {t('exportCSV')}
        </button>
      </div>

      {/* Supervisors Tab */}
      {activeTab === 'supervisors' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="text-slate-300 font-medium px-6 py-3 text-start">Name</th>
                <th className="text-slate-300 font-medium px-6 py-3 text-center">{t('sessions')}</th>
                <th className="text-slate-300 font-medium px-6 py-3 text-center">Rating</th>
                <th className="text-slate-300 font-medium px-6 py-3 text-center">Status</th>
                <th className="text-slate-300 font-medium px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.sessionsBySupervisor.map((sup: any) => (
                <tr key={sup.supervisorId} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-6 py-4 text-white font-medium">{sup.name}</td>
                  <td className="px-6 py-4 text-center text-sky-400 font-bold">{sup.count}</td>
                  <td className="px-6 py-4 text-center text-amber-400">
                    {supervisors.find(s => s.id === sup.supervisorId)?.ratingAverage?.toFixed(1) || '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${
                      sup.isActive
                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
                        : 'text-red-400 bg-red-400/10 border-red-400/30'
                    }`}>
                      {sup.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleSupervisor(sup.supervisorId, sup.isActive)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        sup.isActive
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      }`}
                    >
                      {sup.isActive ? t('disable') : t('enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="text-slate-300 font-medium px-4 py-3 text-start">Student</th>
                <th className="text-slate-300 font-medium px-4 py-3 text-start">Email</th>
                <th className="text-slate-300 font-medium px-4 py-3 text-center">Date</th>
                <th className="text-slate-300 font-medium px-4 py-3 text-center">Time</th>
                <th className="text-slate-300 font-medium px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.slice(0, 50).map((b: any) => (
                <tr key={b.id} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3 text-white">{b.studentName}</td>
                  <td className="px-4 py-3 text-slate-400">{b.studentEmail}</td>
                  <td className="px-4 py-3 text-center text-slate-300">{b.date}</td>
                  <td className="px-4 py-3 text-center text-slate-300">{b.time}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      b.status === 'confirmed' ? 'text-emerald-400 bg-emerald-400/10'
                      : b.status === 'cancelled' ? 'text-red-400 bg-red-400/10'
                      : 'text-blue-400 bg-blue-400/10'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="grid gap-4">
          {reviews.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No reviews yet</p>
          ) : (
            reviews.map((r: any) => (
              <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-amber-400">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  <span className="text-slate-500 text-xs">{r.createdAt?.split('T')[0]}</span>
                </div>
                <p className="text-slate-300 text-sm">{r.comment}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
