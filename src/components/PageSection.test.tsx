import { render, screen } from '@testing-library/react';
import { PageSection } from '@/components/PageSection';

describe('PageSection', () => {
  it('renders a focused h1, actions and content without adding a landmark', () => {
    render(
      <PageSection title="Leeds" actions={<button type="button">Refresh</button>}>
        <p>Content</p>
      </PageSection>,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Leeds' });
    expect(heading).toHaveFocus();
    // <main> is the landmark; a page-level region would duplicate it (T-038).
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
    expect(screen.getByText('Content')).toBeVisible();
    expect(document.title).toBe('Leeds · Inventory dashboard');
  });
});
