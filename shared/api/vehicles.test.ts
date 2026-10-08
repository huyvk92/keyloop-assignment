import { CurrentActionSchema } from './actions';
import {
  AGE_BUCKETS,
  AGE_RANGE_ERROR_MESSAGE,
  AgeRangeFormSchema,
  FacetsResponseSchema,
  InventorySummarySchema,
  MAX_AGE_DAYS,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  VehicleFilterBaseSchema,
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

describe('VehicleListQuerySchema filters (T-013)', () => {
  it('parses every filter field together', () => {
    expect(
      VehicleListQuerySchema.parse({
        make: 'Ford',
        model: 'Focus',
        ageBucket: 'over-90',
        minAge: '45',
        maxAge: '120',
        agingOnly: 'true',
        needsAttention: 'false',
        q: 'stk',
      }),
    ).toEqual({
      make: 'Ford',
      model: 'Focus',
      ageBucket: 'over-90',
      minAge: 45,
      maxAge: 120,
      agingOnly: true,
      needsAttention: false,
      q: 'stk',
      sort: 'age',
      page: 1,
      pageSize: PAGE_SIZE_DEFAULT,
    });
  });

  it('parses agingOnly=false as false (stringbool, not coerce)', () => {
    expect(VehicleListQuerySchema.parse({ agingOnly: 'false' }).agingOnly).toBe(false);
    expect(VehicleListQuerySchema.parse({ agingOnly: 'true' }).agingOnly).toBe(true);
    expect(VehicleListQuerySchema.parse({ needsAttention: 'false' }).needsAttention).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ agingOnly: 'maybe' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ agingOnly: '' }).success).toBe(false);
  });

  it('rejects min 100 / max 50 on maxAge (AC-002.4, BR-07)', () => {
    const result = VehicleListQuerySchema.safeParse({ minAge: '100', maxAge: '50' });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['maxAge'], message: AGE_RANGE_ERROR_MESSAGE }),
    ]);
  });

  it('accepts min = max, 0 and an open-ended range', () => {
    expect(VehicleListQuerySchema.parse({ minAge: '60', maxAge: '60' })).toMatchObject({
      minAge: 60,
      maxAge: 60,
    });
    expect(VehicleListQuerySchema.parse({ minAge: '0' }).minAge).toBe(0);
    expect(VehicleListQuerySchema.parse({ maxAge: '0' }).maxAge).toBe(0);
    expect(VehicleListQuerySchema.parse({ minAge: '91' }).maxAge).toBeUndefined();
  });

  it.each(['-1', '1.5', '1e2', '0x1', ' 2', '', String(MAX_AGE_DAYS + 1)])(
    'rejects the age %j',
    (value) => {
      expect(VehicleListQuerySchema.safeParse({ minAge: value }).success).toBe(false);
      expect(VehicleListQuerySchema.safeParse({ maxAge: value }).success).toBe(false);
    },
  );

  it('trims q and rejects an empty or over-long q (BR-08)', () => {
    expect(VehicleListQuerySchema.parse({ q: ' stk ' }).q).toBe('stk');
    expect(VehicleListQuerySchema.safeParse({ q: '' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(VehicleListQuerySchema.parse({ q: 'x'.repeat(100) }).q).toHaveLength(100);
    expect(VehicleListQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
  });

  it('trims make and model and bounds their length', () => {
    expect(VehicleListQuerySchema.parse({ make: ' Ford ', model: ' Focus ' })).toMatchObject({
      make: 'Ford',
      model: 'Focus',
    });
    expect(VehicleListQuerySchema.safeParse({ make: ' ' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ model: 'x'.repeat(51) }).success).toBe(false);
  });

  it('accepts the four buckets and rejects an unknown ageBucket (BR-07, TA-07)', () => {
    expect(AGE_BUCKETS).toEqual(['0-30', '31-60', '61-90', 'over-90']);
    for (const ageBucket of AGE_BUCKETS) {
      expect(VehicleListQuerySchema.parse({ ageBucket }).ageBucket).toBe(ageBucket);
    }
    expect(VehicleListQuerySchema.safeParse({ ageBucket: '>90' }).success).toBe(false);
    expect(VehicleListQuerySchema.safeParse({ ageBucket: '91-120' }).success).toBe(false);
  });

  it('keeps the base filter schema extendable (no refine on the base)', () => {
    expect(() => VehicleFilterBaseSchema.extend({})).not.toThrow();
    expect(VehicleFilterBaseSchema.parse({ minAge: '100', maxAge: '50' })).toMatchObject({
      minAge: 100,
      maxAge: 50,
    });
  });
});

describe('AgeRangeFormSchema (web inline range form)', () => {
  it('applies the same min <= max rule on maxAge', () => {
    const result = AgeRangeFormSchema.safeParse({ minAge: '100', maxAge: '50' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['maxAge']);
    expect(AgeRangeFormSchema.parse({ minAge: '45', maxAge: '90' })).toEqual({
      minAge: 45,
      maxAge: 90,
    });
  });

  it('treats an empty input as "no bound" instead of 0', () => {
    expect(AgeRangeFormSchema.parse({ minAge: '', maxAge: '30' })).toEqual({ maxAge: 30 });
    expect(AgeRangeFormSchema.parse({ minAge: '91', maxAge: '' })).toEqual({ minAge: 91 });
    expect(AgeRangeFormSchema.parse({})).toEqual({});
  });

  it('rejects negative, decimal and non-numeric input', () => {
    expect(AgeRangeFormSchema.safeParse({ minAge: '-1' }).success).toBe(false);
    expect(AgeRangeFormSchema.safeParse({ maxAge: '2.5' }).success).toBe(false);
    expect(AgeRangeFormSchema.safeParse({ maxAge: 'ten' }).success).toBe(false);
  });
});

describe('FacetsResponseSchema', () => {
  it('parses makes with their models', () => {
    const body = { makes: [{ make: 'Ford', models: ['Fiesta', 'Focus'] }] };
    expect(FacetsResponseSchema.parse(body)).toEqual(body);
    expect(FacetsResponseSchema.parse({ makes: [] })).toEqual({ makes: [] });
    expect(FacetsResponseSchema.safeParse({ makes: [{ make: 'Ford' }] }).success).toBe(false);
  });
});

describe('InventorySummarySchema (T-021)', () => {
  const summary = {
    asOfDate: '2026-10-07',
    totalVehicles: 8,
    agingCount: 3,
    agingPercent: 37.5,
    averageDaysInStock: 75,
    needsAttentionCount: 2,
  };

  it('parses the AC-005.1 summary', () => {
    expect(InventorySummarySchema.parse(summary)).toEqual(summary);
  });

  it('allows averageDaysInStock null for an empty stock (AC-005.3)', () => {
    const empty = {
      ...summary,
      totalVehicles: 0,
      agingCount: 0,
      agingPercent: 0,
      averageDaysInStock: null,
      needsAttentionCount: 0,
    };

    expect(InventorySummarySchema.parse(empty)).toEqual(empty);
  });

  it('accepts agingPercent 0 and 100 and rejects values outside 0-100', () => {
    for (const agingPercent of [0, 66.7, 100]) {
      expect(InventorySummarySchema.safeParse({ ...summary, agingPercent }).success).toBe(true);
    }
    for (const agingPercent of [100.1, -0.1]) {
      expect(InventorySummarySchema.safeParse({ ...summary, agingPercent }).success).toBe(false);
    }
  });

  it('rejects a fractional or negative average, negative counts and a non-ISO date', () => {
    const invalid = [
      { averageDaysInStock: 75.1 },
      { averageDaysInStock: -1 },
      { totalVehicles: -1 },
      { agingCount: 1.5 },
      { needsAttentionCount: -1 },
      { asOfDate: '07/10/2026' },
    ];
    for (const override of invalid) {
      expect(InventorySummarySchema.safeParse({ ...summary, ...override }).success).toBe(false);
    }
  });
});
