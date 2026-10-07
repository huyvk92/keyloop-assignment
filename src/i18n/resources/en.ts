/**
 * English UI text: the source of truth for translation keys (ADR-009). `vi.ts` must have the same
 * shape; `i18next.d.ts` types `t()` from this object, so an unknown key fails `tsc`.
 * Keys are grouped by area. Interpolate with `{{name}}`; never concatenate translated strings.
 */
export const en = {
  app: {
    title: 'Inventory dashboard',
    /** `document.title` for a page other than the app title, e.g. "Leeds · Inventory dashboard". */
    documentTitle: '{{page}} · Inventory dashboard',
  },
  layout: {
    brand: 'Inventory Dashboard',
    skipToContent: 'Skip to content',
    mainNav: 'Main',
    copyright: '© {{year}}',
  },
  language: {
    label: 'Language',
  },
  common: {
    loading: 'Loading…',
    retry: 'Retry',
    backHome: 'Back to home',
  },
  errors: {
    boundary: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      retry: 'Try again',
    },
    route: {
      title: 'Oops',
      status: '{{status}} {{statusText}}',
      generic: 'Something went wrong while loading this page.',
    },
    notFound: {
      title: 'Page not found',
    },
    state: {
      defaultTitle: "Couldn't load data",
    },
    /** Mapped from HttpError codes and statuses; raw server text is never shown (TRD section 6). */
    messages: {
      vehicleNotAging: 'Actions can only be logged for vehicles in stock for more than 90 days.',
      validation: 'Some fields are invalid.',
      notFound: "We couldn't find what you were looking for. It may have been removed.",
      network: "Couldn't reach the server. Check your connection and try again.",
      server: 'The server ran into a problem. Try again in a moment.',
      unknown: 'Something went wrong. Try again.',
    },
  },
  dealerships: {
    selector: {
      label: 'Dealership',
    },
    loadingOne: 'Loading dealership…',
    loadingList: 'Loading dealerships…',
    loadErrorOne: "Couldn't load dealership",
    loadErrorList: "Couldn't load dealerships",
    notFound: {
      title: 'Dealership not found',
      description: "This dealership doesn't exist or is no longer available.",
      link: 'Go to the dashboard',
    },
    empty: {
      title: 'No dealerships found',
      description: 'Add a dealership to start tracking inventory.',
    },
  },
  inventory: {
    agingBadge: 'Aging',
    list: {
      loading: 'Loading vehicles…',
      loadError: "Couldn't load vehicles",
      updating: 'Updating…',
      refreshFailed: "Couldn't refresh the list. Showing the last loaded data.",
      empty: {
        title: 'No vehicles in stock',
        description: '{{dealership}} has no vehicles in stock right now.',
      },
      /** Filters are active but nothing matches (AC-002.8); differs from "No vehicles in stock". */
      noMatch: {
        title: 'No vehicles match your filters',
        description: 'Try changing or clearing the filters.',
        clear: 'Clear filters',
      },
    },
    /** FilterBar and AgeRangeFilter (US-002). Filter values (make, model) are data, never translated. */
    filters: {
      label: 'Filter vehicles',
      search: {
        label: 'Search',
        hint: 'VIN, stock number or model',
      },
      make: { label: 'Make', all: 'All makes' },
      model: { label: 'Model', all: 'All models' },
      facets: {
        error: "Couldn't load the make and model options.",
      },
      ageBucket: {
        label: 'Days in stock',
        all: 'Any age',
        options: {
          '0-30': '0-30 days',
          '31-60': '31-60 days',
          '61-90': '61-90 days',
          'over-90': 'Over 90 days',
        },
      },
      agingOnly: 'Aging only (over 90 days)',
      ageRange: {
        legend: 'Custom age range (days)',
        min: 'Minimum days',
        max: 'Maximum days',
        apply: 'Apply range',
        errors: {
          /** Shown instead of the contract's English AGE_RANGE_ERROR_MESSAGE (BR-07). */
          order: 'Minimum days must be less than or equal to maximum days.',
          invalid: 'Enter a whole number of days from 0 to {{max}}.',
        },
      },
      /** Polite live count of the settled result (AC-002.1); `total` is the formatted count. */
      matchCount: {
        filtered_one: '{{total}} vehicle matches your filters',
        filtered_other: '{{total}} vehicles match your filters',
        all_one: '{{total}} vehicle in stock',
        all_other: '{{total}} vehicles in stock',
      },
    },
    table: {
      caption: 'Vehicles in stock at {{dealership}}',
      notAging: 'Not aging',
      noAction: 'No action',
      /** "Jane Smith · 07 Oct 2026, 14:32": logged-by name (data) and formatted timestamp. */
      actionMeta: '{{loggedBy}} · {{loggedAt}}',
      header: {
        stockNumber: 'Stock no.',
        make: 'Make',
        model: 'Model',
        year: 'Year',
        daysInStock: 'Days in stock',
        aging: 'Aging',
        currentAction: 'Current action',
        listPrice: 'List price',
        stockInDate: 'Stock-in date',
        mileage: 'Mileage',
        trim: 'Trim',
        colour: 'Colour',
        vin: 'VIN',
      },
    },
    pagination: {
      label: 'Pagination',
      summary: 'Showing {{from}}-{{to}} of {{total}}',
      page: 'Page {{page}} of {{lastPage}}',
      previous: 'Previous',
      previousLabel: 'Previous page',
      next: 'Next',
      nextLabel: 'Next page',
    },
  },
  /**
   * Display labels for the canonical action statuses (BR-10, BR-19). Keys are the values the API
   * stores and sends; only the label is translated. English labels equal the canonical value.
   */
  actionStatus: {
    'Price Reduction Planned': 'Price Reduction Planned',
    'Marketing Promotion': 'Marketing Promotion',
    'Transfer to Another Dealership': 'Transfer to Another Dealership',
    'Send to Auction/Wholesale': 'Send to Auction/Wholesale',
    'Under Review': 'Under Review',
  },
} as const;

type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** The key structure every language must provide, with any string as the value. */
export type TranslationShape = Shape<typeof en>;
