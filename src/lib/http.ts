import { ApiErrorSchema } from '@shared/api/common';
import type { ZodType } from 'zod';
import { env } from '@/lib/env';

export class HttpError extends Error {
  readonly status: number;
  /** Machine-readable code from the API error body (e.g. VALIDATION_ERROR), if present. */
  readonly code: string | undefined;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.code = ApiErrorSchema.safeParse(body).data?.error.code;
  }
}

/** Absolute API URL. Empty VITE_API_BASE_URL = same origin + /api (works in browser and jsdom). */
export function apiUrl(path: string): string {
  const base = env.VITE_API_BASE_URL || `${window.location.origin}/api`;
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Fetch JSON and validate it with a Zod schema. Throws HttpError on non-2xx responses. */
export async function fetchJson<T>(
  url: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...init, headers });
  const body: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new HttpError(response.status, `Request failed with status ${response.status}`, body);
  }
  return schema.parse(body);
}
