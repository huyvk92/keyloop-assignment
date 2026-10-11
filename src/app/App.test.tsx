import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';
import { routes } from '@/app/router';
import { preloadRouteModules, renderRoutes } from '@/test/render';

describe('App', () => {
  beforeAll(preloadRouteModules);

  it('boots with providers and opens the first dealership dashboard', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Birmingham' })).toBeVisible();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inventory Dashboard' })).toHaveAttribute('href', '/');
  });

  it('renders the not-found page for unknown routes', async () => {
    renderRoutes(routes, { route: '/does-not-exist' });

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
