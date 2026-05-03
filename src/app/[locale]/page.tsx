// src/app/[locale]/page.tsx
import { getTranslations } from 'next-intl/server';
import { getActiveSupervisors } from '@/lib/actions/supervisorActions';
import SupervisorCard from '@/components/supervisor/SupervisorCard';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { Supervisor } from '@/types';

interface HomePageProps {
  params: { locale: string };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const navT = await getTranslations('nav');

  const supervisors = await getActiveSupervisors() as Supervisor[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Navbar */}
      <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-white font-bold text-xl tracking-tight">
            <span className="text-sky-400">◆</span> {navT('home')}
          </h1>
          <LanguageSwitcher locale={locale} />
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          {t('title')}
        </h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          {t('subtitle')}
        </p>
      </div>

      {/* Supervisors Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-20">
        {supervisors.length === 0 ? (
          <div className="text-center py-20 text-slate-400">{t('noSupervisors')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supervisors.map((supervisor) => (
              <SupervisorCard
                key={supervisor.id}
                supervisor={supervisor}
                locale={locale}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
