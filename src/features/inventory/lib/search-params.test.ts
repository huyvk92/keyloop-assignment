import { VehicleListQuerySchema } from '@shared/api/vehicles';
import { fromSearchParams, hasActiveFilters, toSearchParams } from './search-params';

const parse = (search: string) => fromSearchParams(new URLSearchParams(search));

describe('fromSearchParams', () => {
  it('parses every supported param into the typed query (ADR-008)', () => {
    const { query, search } = parse(
      'make=Ford&model=Focus&ageBucket=over-90&minAge=45&maxAge=90&agingOnly=true&needsAttention=true&q=stk&sort=price&order=desc&page=2&pageSize=50',
    );

    expect(query).toEqual({
      make: 'Ford',
      model: 'Focus',
      ageBucket: 'over-90',
      minAge: 45,
      maxAge: 90,
      agingOnly: true,
      needsAttention: true,
      q: 'stk',
      sort: 'price',
      order: 'desc',
      page: 2,
      pageSize: 50,
    });
    expect(search).toBe(
      'make=Ford&model=Focus&ageBucket=over-90&minAge=45&maxAge=90&agingOnly=true&needsAttention=true&q=stk&sort=price&order=desc&page=2&pageSize=50',
    );
  });

  it('applies the contract defaults to an empty URL', () => {
    expect(parse('').query).toEqual(VehicleListQuerySchema.parse({}));
    expect(parse('').search).toBe('');
  });

  it.each([
    ['pageSize=999&make=Ford', 'make=Ford'],
    ['page=0&make=Ford', 'make=Ford'],
    ['ageBucket=91-120&page=2', 'page=2'],
    ['minAge=-1&page=2', 'page=2'],
    ['minAge=1e2&page=2', 'page=2'],
    ['agingOnly=maybe&page=2', 'page=2'],
    ['sort=colour&page=2', 'page=2'],
    ['q=%20%20&page=2', 'page=2'],
    ['make=&model=Focus', 'model=Focus'],
  ])('drops the invalid param in "%s" and keeps the rest (TA-09)', (input, expected) => {
    const { query, search } = parse(input);

    expect(search).toBe(expected);
    expect(query).toEqual(
      VehicleListQuerySchema.parse(Object.fromEntries(new URLSearchParams(expected))),
    );
  });

  it('drops unknown and repeated params (the API rejects repeated keys, TA-27)', () => {
    const { query, search } = parse('utm_source=mail&make=Ford&make=Toyota&page=2');

    expect(query.make).toBeUndefined();
    expect(query.page).toBe(2);
    expect(search).toBe('page=2');
  });

  it('drops a min > max range as a whole, so no half range is applied (AC-002.4)', () => {
    const { query, search } = parse('minAge=100&maxAge=50&make=Ford');

    expect(query).toMatchObject({ make: 'Ford' });
    expect(query.minAge).toBeUndefined();
    expect(query.maxAge).toBeUndefined();
    expect(search).toBe('make=Ford');
  });

  it('leaves defaults and "no restriction" values out of the canonical URL (TA-09, TA-27)', () => {
    const { query, search } = parse(
      'page=1&pageSize=25&sort=age&agingOnly=false&needsAttention=false&q=%20stk-104%20',
    );

    expect(search).toBe('q=stk-104');
    // Same query as the canonical URL, so the cache key doesn't change when the URL is replaced.
    expect(query).toEqual(parse(search).query);
    expect(query.agingOnly).toBeUndefined();
  });
});

describe('toSearchParams', () => {
  it('omits undefined values and defaults, writes booleans as "true"', () => {
    const query = VehicleListQuerySchema.parse({ agingOnly: 'true', page: 3, sort: 'age' });

    expect(toSearchParams(query).toString()).toBe('agingOnly=true&page=3');
  });
});

describe('hasActiveFilters', () => {
  it.each([
    ['', false],
    ['page=3&sort=price&order=asc', false],
    ['agingOnly=false', false],
    ['make=Ford', true],
    ['minAge=0', true],
    ['agingOnly=true', true],
    ['needsAttention=true', true],
    ['q=abc', true],
  ])('"%s" has active filters: %s', (search, expected) => {
    expect(hasActiveFilters(parse(search).query)).toBe(expected);
  });
});
