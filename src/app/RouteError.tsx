import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  // The HTTP status text comes from the response and is shown as received.
  const message = isRouteErrorResponse(error)
    ? t('errors.route.status', { status: error.status, statusText: error.statusText })
    : t('errors.route.generic');

  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">{t('errors.route.title')}</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        {t('common.backHome')}
      </Link>
    </div>
  );
}
