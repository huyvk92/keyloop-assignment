import { render, screen } from '@testing-library/react';
import { usePageHeading } from '@/lib/use-page-heading';

function Page({ title }: { title: string }) {
  const ref = usePageHeading(title);
  return (
    <h1 ref={ref} tabIndex={-1}>
      {title}
    </h1>
  );
}

describe('usePageHeading', () => {
  it('sets the document title and focuses the heading, again when the title changes', () => {
    const { rerender } = render(<Page title="Leeds" />);

    expect(document.title).toBe('Leeds · Inventory dashboard');
    expect(screen.getByRole('heading', { name: 'Leeds' })).toHaveFocus();

    rerender(<Page title="Inventory dashboard" />);
    expect(document.title).toBe('Inventory dashboard');
    expect(screen.getByRole('heading', { name: 'Inventory dashboard' })).toHaveFocus();
  });
});
