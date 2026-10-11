/** Static catalogue and dealership list for the demo seeder (TRD 4.5). UK market, GBP. */

export type DemoDealership = {
  name: string;
  currency: string;
  timeZone: string;
  vehicleCount: number;
  /** Share of (randomly aged) aging vehicles that get a 1-3 entry action history. */
  actionShare: number;
};

/** In A-Z order, so the first one is the default dealership (AC-008.1). */
export const DEMO_DEALERSHIPS: readonly DemoDealership[] = [
  {
    name: 'Birmingham Central Motors',
    currency: 'GBP',
    timeZone: 'Europe/London',
    vehicleCount: 360,
    actionShare: 0.55,
  },
  {
    name: 'Leeds Northside Cars',
    currency: 'GBP',
    timeZone: 'Europe/London',
    vehicleCount: 220,
    actionShare: 0.5,
  },
  {
    name: 'Manchester Quays Autos',
    currency: 'GBP',
    timeZone: 'Europe/London',
    vehicleCount: 150,
    actionShare: 0,
  },
  {
    name: 'York Pop-up Showroom',
    currency: 'GBP',
    timeZone: 'Europe/London',
    vehicleCount: 0,
    actionShare: 0,
  },
];

/** Ages every stocked dealership has exactly once (bucket boundaries, NFR-09). */
export const BOUNDARY_AGES = [0, 30, 31, 60, 61, 90, 91, 120, 200, 365] as const;
export const MAX_SEED_AGE = 400;
/** Share of the remaining vehicles per bucket: 0-30, 31-60, 61-90, 91-400. */
export const BUCKET_WEIGHTS = [
  { min: 0, max: 30, share: 0.3 },
  { min: 31, max: 60, share: 0.25 },
  { min: 61, max: 90, share: 0.2 },
  { min: 91, max: MAX_SEED_AGE, share: 0.25 },
] as const;

export const MODEL_YEARS = { min: 2018, max: 2026 } as const;
export const PRICE_POUNDS = { min: 7_990, max: 54_990 } as const;

type CatalogueModel = { model: string; trims: readonly string[]; newPricePounds: number };
type CatalogueMake = { make: string; models: readonly CatalogueModel[] };

export const CATALOGUE: readonly CatalogueMake[] = [
  {
    make: 'Ford',
    models: [
      { model: 'Fiesta', trims: ['Trend', 'Titanium', 'ST-Line'], newPricePounds: 19_000 },
      { model: 'Focus', trims: ['Titanium', 'ST-Line', 'Active'], newPricePounds: 26_000 },
      { model: 'Puma', trims: ['Titanium', 'ST-Line X', 'ST'], newPricePounds: 27_000 },
      { model: 'Kuga', trims: ['Titanium', 'ST-Line', 'Vignale'], newPricePounds: 33_000 },
    ],
  },
  {
    make: 'Vauxhall',
    models: [
      { model: 'Corsa', trims: ['Design', 'SE', 'GS'], newPricePounds: 19_500 },
      { model: 'Astra', trims: ['Design', 'GS', 'Ultimate'], newPricePounds: 26_500 },
      { model: 'Mokka', trims: ['Design', 'GS', 'Ultimate'], newPricePounds: 25_500 },
    ],
  },
  {
    make: 'Volkswagen',
    models: [
      { model: 'Polo', trims: ['Life', 'Match', 'R-Line'], newPricePounds: 21_500 },
      { model: 'Golf', trims: ['Life', 'Style', 'R-Line', 'GTI'], newPricePounds: 29_000 },
      { model: 'T-Roc', trims: ['Life', 'Style', 'R-Line'], newPricePounds: 29_500 },
      { model: 'Tiguan', trims: ['Life', 'Elegance', 'R-Line'], newPricePounds: 37_000 },
    ],
  },
  {
    make: 'BMW',
    models: [
      { model: '1 Series', trims: ['Sport', 'M Sport'], newPricePounds: 31_000 },
      { model: '3 Series', trims: ['Sport', 'M Sport'], newPricePounds: 42_000 },
      { model: 'X1', trims: ['Sport', 'xLine', 'M Sport'], newPricePounds: 39_000 },
    ],
  },
  {
    make: 'Audi',
    models: [
      { model: 'A1', trims: ['Sport', 'S line'], newPricePounds: 23_500 },
      { model: 'A3', trims: ['Sport', 'S line', 'Black Edition'], newPricePounds: 30_500 },
      { model: 'Q3', trims: ['Sport', 'S line', 'Black Edition'], newPricePounds: 38_500 },
    ],
  },
  {
    make: 'Mercedes-Benz',
    models: [
      { model: 'A-Class', trims: ['Sport', 'AMG Line'], newPricePounds: 32_000 },
      { model: 'C-Class', trims: ['Sport', 'AMG Line', 'Premium'], newPricePounds: 45_000 },
      { model: 'GLA', trims: ['Sport', 'AMG Line'], newPricePounds: 40_000 },
    ],
  },
  {
    make: 'Toyota',
    models: [
      { model: 'Yaris', trims: ['Icon', 'Design', 'Excel'], newPricePounds: 21_000 },
      { model: 'Corolla', trims: ['Icon', 'Design', 'GR Sport'], newPricePounds: 29_500 },
      { model: 'C-HR', trims: ['Icon', 'Design', 'GR Sport'], newPricePounds: 32_000 },
      { model: 'RAV4', trims: ['Icon', 'Design', 'Excel'], newPricePounds: 38_000 },
    ],
  },
  {
    make: 'Nissan',
    models: [
      { model: 'Juke', trims: ['Acenta', 'N-Connecta', 'Tekna'], newPricePounds: 22_500 },
      { model: 'Qashqai', trims: ['Acenta', 'N-Connecta', 'Tekna'], newPricePounds: 29_500 },
    ],
  },
  {
    make: 'Kia',
    models: [
      { model: 'Picanto', trims: ['1', '2', 'GT-Line'], newPricePounds: 14_000 },
      { model: 'Sportage', trims: ['2', '3', 'GT-Line'], newPricePounds: 31_500 },
      { model: 'Niro', trims: ['2', '3', '4'], newPricePounds: 30_000 },
    ],
  },
  {
    make: 'Hyundai',
    models: [
      { model: 'i10', trims: ['SE Connect', 'Premium'], newPricePounds: 14_500 },
      { model: 'Tucson', trims: ['SE Connect', 'Premium', 'Ultimate'], newPricePounds: 33_500 },
    ],
  },
  {
    make: 'Skoda',
    models: [
      {
        model: 'Fabia',
        trims: ['SE Comfort', 'Colour Edition', 'Monte Carlo'],
        newPricePounds: 18_500,
      },
      { model: 'Octavia', trims: ['SE', 'SE L', 'vRS'], newPricePounds: 27_500 },
      { model: 'Kodiaq', trims: ['SE', 'SE L', 'Sportline'], newPricePounds: 37_500 },
    ],
  },
  {
    make: 'MINI',
    models: [
      { model: 'Hatch', trims: ['Classic', 'Sport', 'Exclusive'], newPricePounds: 22_500 },
      { model: 'Countryman', trims: ['Classic', 'Sport', 'Exclusive'], newPricePounds: 32_500 },
    ],
  },
  {
    make: 'Land Rover',
    models: [
      { model: 'Discovery Sport', trims: ['S', 'SE', 'Dynamic SE'], newPricePounds: 45_000 },
      { model: 'Range Rover Evoque', trims: ['S', 'SE', 'Dynamic HSE'], newPricePounds: 47_000 },
    ],
  },
];

export const COLOURS = [
  'Black',
  'White',
  'Silver',
  'Grey',
  'Blue',
  'Red',
  'Green',
  'Orange',
  'Bronze',
] as const;

export const LOGGED_BY_NAMES = [
  'Jane Smith',
  'Tom Hughes',
  'Priya Patel',
  'Mark Davies',
  'Sophie Clarke',
] as const;

export const ACTION_NOTES = [
  'Reduce by 5% to match local market.',
  "Feature in this weekend's social media campaign.",
  'Check demand at the Leeds site before transfer.',
  'Trade buyer interested; awaiting offer.',
  'Valet and new photos booked.',
  'Service history being verified.',
  'Price matched against three comparable listings.',
] as const;

/** Characters allowed in a VIN (ISO 3779: no I, O or Q). */
export const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

/**
 * AC-002.6 search demo: this vehicle is STK-1042 in the default dealership. Every descriptive
 * attribute is pinned so it reads as one consistent car (VIN year code J = 2018; a Focus trim
 * from the catalogue; price and mileage typical for an eight-year-old Focus).
 */
export const SEARCH_DEMO_VEHICLE = {
  stockNumber: 'STK-1042',
  vin: '1FADP3F2XJL123456',
  make: 'Ford',
  model: 'Focus',
  modelYear: 2018,
  trim: 'Titanium',
  mileage: 58_240,
  listPriceMinor: 1_099_000,
} as const;

export const FIRST_STOCK_NUMBER = 1000;
export const PRNG_SEED = 0x1d_2026;
