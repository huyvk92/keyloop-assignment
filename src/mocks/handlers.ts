import type { RequestHandler } from 'msw';

/**
 * Default API mocks shared by dev (VITE_USE_MOCKS), tests and Storybook.
 * Build URLs with apiUrl() from '@/lib/http'. Override per test with server.use(...).
 */
export const handlers: RequestHandler[] = [];
