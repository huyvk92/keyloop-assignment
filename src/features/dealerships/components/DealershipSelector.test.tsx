import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { i18n } from '@/i18n';
import { apiUrl } from '@/lib/http';
import { shouldKeepFocus } from '@/lib/navigation-focus';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test/render';
import { DealershipSelector } from './DealershipSelector';

const options = { route: '/dealerships/1?make=Ford&page=2', path: '/dealerships/:dealershipId' };

describe('DealershipSelector', () => {
  it('lists every dealership A-Z with the current one selected (AC-008.1)', async () => {
    renderWithProviders(<DealershipSelector dealershipId={3} />, options);

    const select = await screen.findByRole('combobox', { name: 'Dealership' });
    await vi.waitFor(() => expect(select).toBeEnabled());
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Birmingham', 'Leeds', 'Manchester', 'York']);
    expect(select).toHaveDisplayValue('Manchester');
  });

  it('navigates to the chosen dealership with no search params, pushing history (AC-008.2, TA-10)', async () => {
    const { user, router } = renderWithProviders(<DealershipSelector dealershipId={1} />, options);
    const select = await screen.findByRole('combobox', { name: 'Dealership' });
    await vi.waitFor(() => expect(select).toBeEnabled());

    await user.selectOptions(select, 'Leeds');

    expect(router.state.location.pathname).toBe('/dealerships/2');
    expect(router.state.location.search).toBe('');
    expect(router.state.historyAction).toBe('PUSH');
    expect(shouldKeepFocus(router.state.location.state)).toBe(true);
    expect(select).toHaveFocus();
  });

  it('is disabled while the dealerships load', async () => {
    server.use(http.get(apiUrl('/dealerships'), () => delay('infinite')));
    renderWithProviders(<DealershipSelector dealershipId={1} />, options);

    const select = await screen.findByRole('combobox', { name: 'Dealership' });
    expect(select).toBeDisabled();
    expect(select).toHaveDisplayValue('Loading dealerships…');
  });

  it('renders nothing when the dealerships fail to load (the page shows the error)', async () => {
    let requests = 0;
    server.use(
      http.get(apiUrl('/dealerships'), () => {
        requests += 1;
        return HttpResponse.json(null, { status: 503 });
      }),
    );
    renderWithProviders(<DealershipSelector dealershipId={1} />, options);

    await vi.waitFor(() => expect(requests).toBe(1));
    await vi.waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'Dealership' })).not.toBeInTheDocument(),
    );
  });

  it('labels the control in Vietnamese and keeps dealership names as stored (BR-19)', async () => {
    await i18n.changeLanguage('vi');
    renderWithProviders(<DealershipSelector dealershipId={2} />, options);

    const select = await screen.findByRole('combobox', { name: 'Đại lý' });
    await vi.waitFor(() => expect(select).toHaveDisplayValue('Leeds'));
  });
});
