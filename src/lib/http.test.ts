import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { apiUrl, fetchJson, type HttpError } from '@/lib/http';
import { server } from '@/mocks/server';

const ItemSchema = z.object({ id: z.string(), name: z.string() });

describe('fetchJson', () => {
  it('returns parsed data for a valid response', async () => {
    server.use(http.get(apiUrl('/items/1'), () => HttpResponse.json({ id: '1', name: 'A' })));

    await expect(fetchJson(apiUrl('/items/1'), ItemSchema)).resolves.toEqual({
      id: '1',
      name: 'A',
    });
  });

  it('throws HttpError with the status for non-2xx responses', async () => {
    server.use(
      http.get(apiUrl('/items/1'), () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );

    await expect(fetchJson(apiUrl('/items/1'), ItemSchema)).rejects.toMatchObject({
      name: 'HttpError',
      status: 404,
    } satisfies Partial<HttpError>);
  });

  it('rejects when the response does not match the schema', async () => {
    server.use(http.get(apiUrl('/items/1'), () => HttpResponse.json({ id: 1 })));

    await expect(fetchJson(apiUrl('/items/1'), ItemSchema)).rejects.toThrow();
  });

  it('sends JSON content type when a body is provided', async () => {
    let contentType: string | null = null;
    server.use(
      http.post(apiUrl('/items'), ({ request }) => {
        contentType = request.headers.get('Content-Type');
        return HttpResponse.json({ id: '2', name: 'B' });
      }),
    );

    await fetchJson(apiUrl('/items'), ItemSchema, {
      method: 'POST',
      body: JSON.stringify({ name: 'B' }),
    });

    expect(contentType).toBe('application/json');
  });
});
