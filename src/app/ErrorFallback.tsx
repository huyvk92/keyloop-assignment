import type { FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';

export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">{t('errors.boundary.title')}</h1>
      <p className="mt-2 text-slate-600">{t('errors.boundary.message')}</p>
      <Button className="mt-4" onClick={resetErrorBoundary}>
        {t('errors.boundary.retry')}
      </Button>
    </div>
  );
}
