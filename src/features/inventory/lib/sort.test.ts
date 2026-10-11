import { DEFAULT_SORT_ORDER, effectiveOrder, nextSort, urlOrder } from './sort';

describe('sort helpers (US-011, TA-06)', () => {
  it('uses the per-key default order: age desc, price and make/model asc (TA-06)', () => {
    expect(DEFAULT_SORT_ORDER).toEqual({ age: 'desc', price: 'asc', makeModel: 'asc' });
    expect(effectiveOrder('age', undefined)).toBe('desc');
    expect(effectiveOrder('price', undefined)).toBe('asc');
    expect(effectiveOrder('price', 'desc')).toBe('desc');
  });

  it('starts another key with its default order and toggles the active key', () => {
    const current = { sort: 'age', order: 'desc' } as const;

    expect(nextSort(current, 'price')).toEqual({ sort: 'price', order: 'asc' });
    expect(nextSort(current, 'makeModel')).toEqual({ sort: 'makeModel', order: 'asc' });
    expect(nextSort(current, 'age')).toEqual({ sort: 'age', order: 'asc' });
    expect(nextSort({ sort: 'price', order: 'asc' }, 'price')).toEqual({
      sort: 'price',
      order: 'desc',
    });
    expect(nextSort({ sort: 'price', order: 'desc' }, 'age')).toEqual({
      sort: 'age',
      order: 'desc',
    });
  });

  it("leaves each key's default order out of the URL, and writes the other order (TA-06)", () => {
    expect(urlOrder({ sort: 'age', order: 'desc' })).toBeUndefined();
    expect(urlOrder({ sort: 'price', order: 'asc' })).toBeUndefined();
    expect(urlOrder({ sort: 'makeModel', order: 'asc' })).toBeUndefined();
    expect(urlOrder({ sort: 'age', order: 'asc' })).toBe('asc');
    expect(urlOrder({ sort: 'price', order: 'desc' })).toBe('desc');
    expect(urlOrder({ sort: 'makeModel', order: 'desc' })).toBe('desc');
  });
});
