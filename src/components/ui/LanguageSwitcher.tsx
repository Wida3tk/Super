// src/components/ui/LanguageSwitcher.tsx
'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

interface Props {
  locale: string;
}

export default function LanguageSwitcher({ locale }: Props) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    // استبدال الـ locale في المسار
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <button
      onClick={switchLocale}
      className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
    >
      <span>{locale === 'ar' ? '🇬🇧' : '🇸🇦'}</span>
      <span>{t('language')}</span>
    </button>
  );
}
