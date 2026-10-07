import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="not-found-title" className="text-center">
      <h1 id="not-found-title" className="text-2xl font-semibold">
        {t('errors.notFound.title')}
      </h1>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        {t('common.backHome')}
      </Link>
    </section>
  );
}
