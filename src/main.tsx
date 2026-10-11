import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Initialise i18n first so the first render is already in the stored language (TA-25).
import '@/i18n';
import { App } from '@/app/App';
import { env } from '@/lib/env';
import './index.css';

async function enableMocking() {
  if (!env.VITE_USE_MOCKS) return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
