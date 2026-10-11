import { i18n } from '@/i18n';
import { buildCurrentAction, buildVehicle } from '@/mocks/fixtures';
import { CSV_BOM } from './csv';
import { exportFileName, slugify, todayIn, vehiclesToCsv } from './vehicle-csv';

const lines = (csv: string) => csv.slice(CSV_BOM.length).split('\r\n').slice(0, -1);

const actioned = buildVehicle({
  id: 7,
  daysInStock: 120,
  listPriceMinor: 2_599_050,
  mileage: 12_345,
  currentAction: buildCurrentAction({
    status: 'Price Reduction Planned',
    loggedBy: '@x',
    loggedAt: '2026-10-07T13:32:00.000Z',
  }),
});
const unactioned = buildVehicle({ id: 8, daysInStock: 30, listPriceMinor: 1_000_000 });

describe('vehiclesToCsv (TA-34)', () => {
  it('writes the English header and one row per vehicle with untranslated data', () => {
    const csv = vehiclesToCsv([actioned, unactioned], { t: i18n.t, currency: 'GBP' });
    const [header, first, second] = lines(csv);
    expect(header).toBe(
      'Stock no.,VIN,Make,Model,Year,Trim,Colour,Mileage (mi),List price,Currency,Stock-in date,Days in stock,Aging,Needs attention,Current action,Logged by,Logged at (UTC)',
    );
    expect(first).toBe(
      [
        actioned.stockNumber,
        actioned.vin,
        actioned.make,
        actioned.model,
        actioned.modelYear,
        actioned.trim,
        actioned.colour,
        '12345',
        '25990.50',
        'GBP',
        actioned.stockInDate,
        '120',
        'Yes',
        'No',
        'Price Reduction Planned',
        // The name starts with "@": guarded against formula injection (AC-013.4).
        "'@x",
        '2026-10-07T13:32:00.000Z',
      ].join(','),
    );
    expect(second).toMatch(/,10000\.00,GBP,.*,30,No,No,No action,,$/);
  });

  it('writes Vietnamese headings and labels, data as stored (AC-013.3, BR-19)', async () => {
    await i18n.changeLanguage('vi');
    const csv = vehiclesToCsv([actioned], { t: i18n.t, currency: 'GBP' });
    const [header, row] = lines(csv);
    expect(header).toMatch(/^Mã tồn kho,Số VIN,Hãng xe,Mẫu xe,Đời xe,/);
    expect(header).toMatch(/,Hành động hiện tại,Người ghi nhận,Thời điểm ghi nhận \(UTC\)$/);
    expect(row).toContain(`,${actioned.make},${actioned.model},`);
    expect(row).toContain(',Có,Không,Dự kiến giảm giá,');
    // Numbers keep the "." decimal and no grouping in every language.
    expect(row).toContain(',25990.50,GBP,');
  });
});

describe('export file name', () => {
  it.each([
    ['Birmingham Central Motors', 'birmingham-central-motors'],
    ['  Leeds & Co. (North) ', 'leeds-co-north'],
    ['Đại lý Hà Nội', 'dai-ly-ha-noi'],
    ['Crème Brûlée Cars', 'creme-brulee-cars'],
  ])('slugifies %j as %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('is inventory-<slug>-<date>.csv, with an id fallback for an empty slug', () => {
    expect(exportFileName({ id: 1, name: 'Birmingham Central Motors' }, '2026-10-07')).toBe(
      'inventory-birmingham-central-motors-2026-10-07.csv',
    );
    expect(exportFileName({ id: 9, name: '東京' }, '2026-10-07')).toBe(
      'inventory-dealership-9-2026-10-07.csv',
    );
  });

  it('takes "today" in the dealership time zone', () => {
    const instant = new Date('2026-10-07T23:30:00.000Z');
    expect(todayIn('Europe/London', instant)).toBe('2026-10-08');
    expect(todayIn('America/New_York', instant)).toBe('2026-10-07');
  });
});
