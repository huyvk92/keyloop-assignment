import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="text-center">
      <h1 id="not-found-title" className="text-2xl font-semibold">
        Page not found
      </h1>
      <Link to="/" className="mt-4 inline-block text-brand-600 underline">
        Back to home
      </Link>
    </section>
  );
}
