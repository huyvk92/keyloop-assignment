import { act, screen, within } from '@testing-library/react';
import { routes } from '@/app/router';
import { preloadRouteModules, renderRoutes } from '@/test/render';

/**
 * Page-level accessibility structure of the dashboard (T-038, NFR-01): landmarks, the heading
 * outline, the skip link and the keyboard Tab order. Component-level behaviour (focus on open and
 * close, announcements) is tested with each component. What jsdom cannot show (visible focus,
 * contrast in the browser, screen reader output) is in the manual checklist (SYSTEM_DESIGN §8.4).
 */

/** Leeds: 4 vehicles on one page, some of them aging, so every section is in its success state. */
async function renderLeeds() {
  const view = renderRoutes(routes, { route: '/dealerships/2' });
  await screen.findByRole('heading', { level: 1, name: 'Leeds' });
  await within(await screen.findByRole('navigation', { name: 'Pagination' })).findByText(
    'Showing 1-4 of 4',
  );
  await screen.findByRole('list', { name: 'Aging vehicles, oldest first' });
  await screen.findByRole('definition', { name: 'Total vehicles' });
  // Facets loaded: the make select offers more than "All makes".
  await within(screen.getByRole('combobox', { name: 'Make' })).findAllByRole('option', {
    name: /^(?!All makes)/,
  });
  // The dealership list loaded: the selector is enabled (it is disabled while loading).
  await within(screen.getByRole('combobox', { name: 'Dealership' })).findByRole('option', {
    name: 'York',
  });
  return view;
}

const headingOutline = () =>
  screen
    .getAllByRole('heading')
    .map((heading) => [Number(heading.tagName.slice(1)), heading.textContent] as const);

describe('Dashboard accessibility structure (T-038)', () => {
  beforeAll(preloadRouteModules);

  it('has one h1, then one h2 per section, without skipped levels', async () => {
    await renderLeeds();

    expect(headingOutline()).toEqual([
      [1, 'Leeds'],
      [2, 'Inventory summary'],
      [2, 'Aging stock'],
      [2, 'Filter vehicles'],
      [2, 'Vehicle list'],
    ]);
  });

  it('keeps one h1 and adds the drawer as h2 with h3 sections when a vehicle is open', async () => {
    const { user } = await renderLeeds();
    const [view] = screen.getAllByRole('button', { name: /^View STK-/ });
    if (!view) throw new Error('no View button');

    await user.click(view);
    const dialog = await screen.findByRole('dialog', { name: /STK-/ });
    await within(dialog).findByRole('heading', { level: 3, name: 'Action history' });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const levels = within(dialog)
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(2);
    // No level is more than one below the one before it.
    levels.forEach((level, index) =>
      expect(level).toBeLessThanOrEqual((levels[index - 1] ?? 1) + 1),
    );
  });

  it('exposes the landmarks once each, with no region nested in another', async () => {
    await renderLeeds();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Filter vehicles' })).toBeInTheDocument();
    // Exactly the three section regions, each named by its own h2, none inside another.
    const regions = screen.getAllByRole('region');
    expect(regions).toHaveLength(3);
    ['Inventory summary', 'Aging stock', 'Vehicle list'].forEach((name, index) => {
      const region = regions[index];
      if (!region) throw new Error(`missing region ${name}`);
      expect(region).toHaveAccessibleName(name);
      expect(region).toHaveAttribute(
        'aria-labelledby',
        within(region).getByRole('heading', { level: 2, name }).id,
      );
      expect(within(region).queryAllByRole('region')).toEqual([]);
    });
    // The table's keyboard-scrollable container is a named group inside the list region.
    expect(
      within(screen.getByRole('region', { name: 'Vehicle list' })).getByRole('group', {
        name: 'Vehicles in stock at Leeds',
      }),
    ).toHaveAttribute('tabindex', '0');
  });

  it('skip link moves focus to <main>, so the next Tab is the first control of the page', async () => {
    const { user } = await renderLeeds();
    // Start from the top of the document: the h1 has focus after the navigation.
    act(() => screen.getByRole('heading', { level: 1 }).blur());

    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('main')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveFocus();
  });

  it('walks the controls in a logical Tab order: header, page actions, aging, filters, table, paging', async () => {
    const { user } = await renderLeeds();
    // Start from the top of the document: the h1 has focus after the navigation.
    act(() => screen.getByRole('heading', { level: 1 }).blur());

    const aging = screen.getByRole('region', { name: 'Aging stock' });
    const agingButtons = within(aging).getAllByRole('button');
    const list = screen.getByRole('region', { name: 'Vehicle list' });
    const expected: HTMLElement[] = [
      screen.getByRole('link', { name: 'Skip to content' }),
      screen.getByRole('link', { name: 'Inventory Dashboard' }),
      screen.getByRole('combobox', { name: 'Language' }),
      // The h1 is a focus target on navigation only, not a Tab stop; the KPIs have none.
      screen.getByRole('button', { name: 'Refresh' }),
      screen.getByRole('combobox', { name: 'Dealership' }),
      // "View all N aging vehicles", then each aging vehicle, oldest first.
      ...agingButtons,
      screen.getByRole('searchbox', { name: 'Search' }),
      screen.getByRole('combobox', { name: 'Make' }),
      screen.getByRole('combobox', { name: 'Model' }),
      screen.getByRole('combobox', { name: 'Days in stock' }),
      screen.getByRole('checkbox', { name: 'Aging only (over 90 days)' }),
      screen.getByRole('checkbox', { name: 'Needs attention only' }),
      screen.getByRole('textbox', { name: 'Minimum days' }),
      screen.getByRole('textbox', { name: 'Maximum days' }),
      screen.getByRole('button', { name: 'Apply range' }),
      // After the match count it acts on (T-044).
      screen.getByRole('button', { name: 'Export CSV' }),
      // The scroll container (keyboard scrolling at 768 px), then the sortable headers.
      within(list).getByRole('group', { name: 'Vehicles in stock at Leeds' }),
      within(list).getByRole('button', { name: 'Make' }),
      within(list).getByRole('button', { name: 'Days in stock' }),
      within(list).getByRole('button', { name: 'List price' }),
      ...within(list).getAllByRole('button', { name: /^View STK-/ }),
      screen.getByRole('button', { name: 'Previous page' }),
      screen.getByRole('button', { name: 'Next page' }),
    ];
    expect(agingButtons[0]).toHaveAccessibleName(/aging vehicle/);
    expect(agingButtons.length).toBeGreaterThan(1);

    for (const element of expected) {
      await user.tab();
      expect(element).toHaveFocus();
    }
    // Past the last control: nothing else on the page (the footer has no links).
    await user.tab();
    expect(document.body).toHaveFocus();
  });
});
