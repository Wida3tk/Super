import SetupPasswordForm from '@/components/trainee/SetupPasswordForm';

export default async function SetupPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ oobCode?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return <SetupPasswordForm code={query.oobCode || ''} locale={locale}/>;
}
