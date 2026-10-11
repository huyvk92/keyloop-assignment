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
    /** Accessible name of the dialog's close button (T-029). */
    close: 'Close',
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
      vehicleNotAging:
        'Actions can only be logged for vehicles in stock for more than {{days}} days.',
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
    /** Aging and no current action (BR-16); a text label, never colour alone (AC-010.1). */
    attentionBadge: 'Needs attention',
    /** KPI cards (US-005): whole-stock summary of the dealership, never the filtered list. */
    kpis: {
      /** Accessible name of the KPI region (visually hidden heading). */
      title: 'Inventory summary',
      loadError: "Couldn't load the inventory summary",
      total: 'Total vehicles',
      aging: 'Aging',
      agingPercent: '% aging',
      averageDays: 'Average days in stock',
      /** Aging vehicles with "No action" (BR-16, AC-010.1). */
      needsAttention: 'Needs attention',
      /** Read instead of the visual "-" when there is no average (no vehicles, BR-15). */
      noValue: 'Not available',
      /** Quiet hint (not a live region) when a background refresh fails; last values stay. */
      refreshFailed: "Couldn't refresh the summary. Showing the last loaded figures.",
    },
    /** Aging section (US-004, TA-11): the 10 oldest vehicles over 90 days. */
    aging: {
      title: 'Aging stock',
      listLabel: 'Aging vehicles, oldest first',
      loading: 'Loading aging stock…',
      loadError: "Couldn't load aging stock",
      empty: {
        title: 'No aging stock',
        description: 'No vehicle has been in stock for more than 90 days.',
      },
      /** `total` is the formatted count of all aging vehicles, not only the 10 shown. */
      viewAll_one: 'View {{total}} aging vehicle',
      viewAll_other: 'View all {{total}} aging vehicles',
      /** `days` is the formatted day count. */
      days_one: '{{days}} day',
      days_other: '{{days}} days',
      /** Quiet hint (not a live region) when a background refresh fails; last vehicles stay. */
      refreshFailed: "Couldn't refresh aging stock. Showing the last loaded vehicles.",
    },
    list: {
      /** Visible h2 naming the list region; focus target of "View all aging vehicles". */
      label: 'Vehicle list',
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
      /** Visually hidden h2 naming the search landmark. */
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
      /** Aging vehicles without an action (BR-16); combines with the other filters. */
      needsAttentionOnly: 'Needs attention only',
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
      /** Visible text of the per-row button that opens the vehicle (AC-004.4, T-030). */
      view: 'View',
      /** Its accessible name; starts with the visible text (WCAG 2.5.3). */
      viewLabel: 'View {{stockNumber}}',
      header: {
        /** Only shown when rows can be opened (the "View" column). */
        details: 'Details',
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
    /** Sortable column headers (US-011). */
    sort: {
      /** Polite announcement after the user changes the sort (AC-011.3). */
      announcement: 'Sorted by {{column}}, {{order}}',
      /** The sort key as said in the announcement (TA-06). */
      keys: {
        age: 'days in stock',
        price: 'price',
        makeModel: 'make and model',
      },
      orders: {
        asc: 'ascending',
        desc: 'descending',
      },
      /** Accessible description of a header button whose key isn't its label alone. */
      hints: {
        makeModel: 'Sorts by make, then model',
      },
    },
    /** "Last updated" and manual Refresh (US-009). */
    refresh: {
      /** `time` is HH:mm in the dealership time zone. */
      lastUpdated: 'Last updated {{time}}',
      button: 'Refresh',
      refreshing: 'Refreshing…',
    },
    /** CSV export of the filtered list (US-013, ADR-010). Data in the file is never translated. */
    export: {
      button: 'Export CSV',
      exporting: 'Exporting…',
      /** Shown with the mapped error message; no file is downloaded (AC-013.2). */
      error: "Couldn't export the vehicles.",
      /** Accessible description of the unavailable button when nothing matches. */
      empty: 'There are no vehicles to export.',
      yes: 'Yes',
      no: 'No',
      /** CSV column headings (TA-34), in the file's column order. */
      columns: {
        stockNumber: 'Stock no.',
        vin: 'VIN',
        make: 'Make',
        model: 'Model',
        year: 'Year',
        trim: 'Trim',
        colour: 'Colour',
        mileage: 'Mileage (mi)',
        listPrice: 'List price',
        currency: 'Currency',
        stockInDate: 'Stock-in date',
        daysInStock: 'Days in stock',
        aging: 'Aging',
        needsAttention: 'Needs attention',
        currentAction: 'Current action',
        loggedBy: 'Logged by',
        loggedAt: 'Logged at (UTC)',
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
  /** Vehicle detail drawer, action history and the "Log action" form (US-006, US-007). */
  vehicleActions: {
    dialog: {
      /** Dialog title until the vehicle has loaded. */
      fallbackTitle: 'Vehicle details',
      /** "STK-1042 · Ford Focus"; vehicle data is shown as stored. */
      title: '{{stockNumber}} · {{make}} {{model}}',
      loading: 'Loading vehicle details…',
      loadError: "Couldn't load this vehicle",
      /** Quiet hint (not a live region) when a background refresh fails; last details stay. */
      refreshFailed: "Couldn't refresh this vehicle. Showing the last loaded details.",
    },
    facts: {
      /** `days` is the formatted day count. */
      days_one: '{{days}} day',
      days_other: '{{days}} days',
    },
    history: {
      title: 'Action history',
      label: 'Action history, newest first',
      empty: 'No actions have been logged for this vehicle yet.',
      /** "Logged by Jane Smith"; the name is data, never translated. */
      loggedBy: 'Logged by {{name}}',
    },
    form: {
      title: 'Log action',
      status: 'Action status',
      note: {
        label: 'Note (optional)',
        hint: 'Up to {{max}} characters.',
        /** Live character count of the trimmed note: "12 / 500". */
        counter: '{{length}} / {{max}}',
      },
      loggedBy: 'Logged by',
      submit: 'Save action',
      submitting: 'Saving…',
      saved: 'Action saved',
      saveError: "Couldn't save the action",
      /**
       * Shown instead of the form for a vehicle that isn't aging (AC-006.2, BR-09). `days` is the
       * formatted AGING_THRESHOLD_DAYS.
       */
      notAging:
        'Actions can only be logged for vehicles in stock for more than {{days}} days. The history below stays available.',
      /** Mapped from the field and the Zod issue code; the contract's English message is never shown. */
      errors: {
        statusRequired: 'Select an action status.',
        noteTooLong: 'Note must be {{max}} characters or fewer.',
        loggedByRequired: 'Enter your name.',
        loggedByTooLong: 'Name must be {{max}} characters or fewer.',
        invalid: 'Check this field.',
      },
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
