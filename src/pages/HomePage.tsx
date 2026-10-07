import { useEffect } from 'react';

export function HomePage() {
  useEffect(() => {
    document.title = 'Home';
  }, []);

  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="text-3xl font-bold tracking-tight">
        Welcome
      </h1>
      <p className="mt-2 text-slate-600">Start building features in src/features.</p>
    </section>
  );
}
