import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Something went wrong while loading this page.';

  return (
    <div role="alert" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold">Oops</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Back to home
      </Link>
    </div>
  );
}
