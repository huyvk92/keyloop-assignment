import { HealthResponseSchema } from '@shared/api/common';
import { createTestApp } from '../../test/helpers';

describe('GET /api/health', () => {
  it('reports ok, the database status and the pinned date', async () => {
    const { app, close } = await createTestApp({ today: '2026-10-07' });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      database: 'up',
      today: '2026-10-07',
    });
    await close();
  });

  it('is documented in the OpenAPI spec', async () => {
    const { app, close } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty(['paths', '/api/health', 'get']);
    await close();
  });
});
