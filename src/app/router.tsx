import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from '@/app/Layout';
import { RouteError } from '@/app/RouteError';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/pages/HomePage')).HomePage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
