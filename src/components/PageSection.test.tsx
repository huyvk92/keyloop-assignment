import { render, screen } from '@testing-library/react';
import { PageSection } from '@/components/PageSection';

describe('PageSection', () => {
  it('labels the section with a focused h1 and renders actions and content', () => {
    render(
      <PageSection title="Leeds" actions={<button type="button">Refresh</button>}>
        <p>Content</p>
      </PageSection>,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Leeds' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Leeds' })).toContainElement(heading);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
    expect(screen.getByText('Content')).toBeVisible();
    expect(document.title).toBe('Leeds · Inventory dashboard');
  });
});
