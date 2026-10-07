import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from '@/app/Layout';
import { RouteError } from '@/app/RouteError';

/** TRD section 3.2: "/" redirects, the dashboard lives at /dealerships/:dealershipId (ADR-008). */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/pages/IndexRedirectPage')).IndexRedirectPage,
        }),
      },
      {
        path: 'dealerships/:dealershipId',
        lazy: async () => ({ Component: (await import('@/pages/DashboardPage')).DashboardPage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
