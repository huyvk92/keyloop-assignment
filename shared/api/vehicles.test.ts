import { CurrentActionSchema } from './actions';
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  VehicleListItemSchema,
  VehicleListQuerySchema,
  VehicleListResponseSchema,
  VehicleParamsSchema,
} from './vehicles';

const item = {
  id: 1,
  dealershipId: 1,
  vin: '1FADP3F2XJL123456',
  stockNumber: 'STK-1042',
  make: 'Ford',
  model: 'Focus',
  modelYear: 2022,
  trim: 'Titanium',
  colour: 'Blue',
  mileage: 12345,
  listPriceMinor: 2599000,
  stockInDate: '2026-06-01',
  daysInStock: 128,
  isAging: true,
  needsAttention: true,
  currentAction: null,
};

describe('VehicleListQuerySchema', () => {
  it('applies defaults: sort age, page 1, page size 25, no order', () => {
    expect(VehicleListQuerySchema.parse({})).toEqual({
      sort: 'age',
      page: 1,
      pageSize: PAGE_SIZE_DEFAULT,
    });
  });

  it('coerces numeric strings from the query string', () => {
    expect(VehicleListQuerySchema.parse({ page: '2', pageSize: '10' })).toMatchObject({
      page: 2,
      pageSize: 10,
    });
  });

  it(`accepts pageSize ${PAGE_SIZE_MAX} and rejects ${PAGE_SIZE_MAX + 1}`, () => {
    expect(VehicleListQuerySchema.safeParse({ pageSize: '100' }).success).toBe(true);
    expect(VehicleListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });

  it('rejects page 0, pageSize 0 and non-integer pages', () => {
    expect(VehicleListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ pageSize: '0' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);
  });

  it.each(['0x1', '1e2', '1.5', '-1', ' 2', '+2', ''])(
    'rejects the non-canonical integer %j for page and pageSize',
    (value) => {
      expect(VehicleListQuerySchema.safeParse({ page: value }).success).toBe(false);
      expect(VehicleListQuerySchema.safeParse({ pageSize: value }).success).toBe(false);
    },
  );

  it.each([['2'], [2]])('accepts the canonical integer %j for page and pageSize', (value) => {
    expect(VehicleListQuerySchema.parse({ page: value, pageSize: value })).toMatchObject({
      page: 2,
      pageSize: 2,
    });
  });

  it('rejects numeric page values that are not positive integers', () => {
    expect(VehicleListQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ pageSize: PAGE_SIZE_MAX + 1 }).success).toBe(false);
  });

  it('accepts the whitelisted sort keys and orders only', () => {
    expect(VehicleListQuerySchema.parse({ sort: 'price', order: 'desc' })).toMatchObject({
      sort: 'price',
      order: 'desc',
    });
    expect(VehicleListQuerySchema.safeParse({ sort: 'vin' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ order: 'up' }).success).toBe(false);
  });
});

describe('VehicleListItemSchema', () => {
  it('accepts a vehicle with no current action (null = "No action")', () => {
    expect(VehicleListItemSchema.parse(item)).toEqual(item);
  });

  it('accepts a current action', () => {
    const currentAction = {
      status: 'Marketing Promotion',
      loggedBy: 'Jane Smith',
      loggedAt: '2026-10-07T11:00:00.000Z',
    };
    expect(VehicleListItemSchema.parse({ ...item, currentAction }).currentAction).toEqual(
      currentAction,
    );
    expect(CurrentActionSchema.safeParse(currentAction).success).toBe(true);
  });

  it('rejects a bad VIN length, a negative age and a non-ISO stock-in date', () => {
    expect(VehicleListItemSchema.safeParse({ ...item, vin: 'SHORT' }).success).toBe(false);
    expect(VehicleListItemSchema.safeParse({ ...item, daysInStock: -1 }).success).toBe(false);
    expect(VehicleListItemSchema.safeParse({ ...item, stockInDate: '01/06/2026' }).success).toBe(
      false,
    );
  });

  it('wraps items in a paged response', () => {
    const page = { items: [item], total: 1, page: 1, pageSize: 25 };
    expect(VehicleListResponseSchema.parse(page)).toEqual(page);
  });
});

describe('VehicleParamsSchema', () => {
  it('coerces a positive integer id and rejects anything else', () => {
    expect(VehicleParamsSchema.parse({ vehicleId: '42' })).toEqual({ vehicleId: 42 });
    expect(VehicleParamsSchema.safeParse({ vehicleId: 'abc' }).success).toBe(false);
    expect(VehicleParamsSchema.safeParse({ vehicleId: '0' }).success).toBe(false);
  });

  it.each(['0x1', '1e2', '1.5', '-1', ' 2', ''])('rejects the non-canonical id %j', (vehicleId) => {
    expect(VehicleParamsSchema.safeParse({ vehicleId }).success).toBe(false);
  });

  it.each([['2'], [2]])('accepts the canonical id %j', (vehicleId) => {
    expect(VehicleParamsSchema.parse({ vehicleId })).toEqual({ vehicleId: 2 });
  });
});
