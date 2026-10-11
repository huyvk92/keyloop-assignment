import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { startManualClock, stopManualClock } from '@/test/manual-clock';
import { SEARCH_DEBOUNCE_MS } from '../hooks/useSearchDraft';
import { SearchFilter } from './SearchFilter';

/**
 * The committed (URL) value is a prop here, so each test decides when a commit "arrives": the
 * same as a navigation that is held back (a transition under load) while the user keeps typing.
 */
function renderSearch(initial?: string) {
  const onCommit = vi.fn<(value: string | undefined) => void>();
  const view = render(<SearchFilter value={initial} onCommit={onCommit} />);
  return {
    onCommit,
    /** The URL now holds `value` (an own commit landing late, Clear filters, Back...). */
    arrive: (value: string | undefined) =>
      view.rerender(<SearchFilter value={value} onCommit={onCommit} />),
    user: userEvent.setup({ delay: null }),
    searchbox: screen.getByRole('searchbox', { name: 'Search' }),
  };
}

/** Typing pauses long enough for the debounced commit (TA-08). */
const pause = () => act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS));

describe('SearchFilter draft (TA-08)', () => {
  beforeEach(startManualClock);
  afterEach(stopManualClock);

  it('keeps what was typed while its own commit is still on the way', async () => {
    const { onCommit, arrive, user, searchbox } = renderSearch();
    await user.type(searchbox, 'stk');
    await pause();
    expect(onCommit).toHaveBeenLastCalledWith('stk');

    await user.type(searchbox, '-1');
    // The "stk" commit only now reaches the URL.
    arrive('stk');
    expect(searchbox).toHaveValue('stk-1');

    await user.type(searchbox, '0');
    await pause();
    expect(onCommit).toHaveBeenLastCalledWith('stk-10');
    arrive('stk-10');
    expect(searchbox).toHaveValue('stk-10');
  });

  it('keeps what was typed when two of its commits land late, one after the other', async () => {
    const { onCommit, arrive, user, searchbox } = renderSearch();
    await user.type(searchbox, 'stk');
    await pause();
    await user.type(searchbox, '-1');
    await pause();
    expect(onCommit.mock.calls).toEqual([['stk'], ['stk-1']]);
    await user.type(searchbox, '0');

    arrive('stk');
    expect(searchbox).toHaveValue('stk-10');
    arrive('stk-1');
    expect(searchbox).toHaveValue('stk-10');

    await pause();
    expect(onCommit).toHaveBeenLastCalledWith('stk-10');
  });

  it('nothing is committed before the pause', async () => {
    const { onCommit, user, searchbox } = renderSearch();
    await user.type(searchbox, 'stk');
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('follows Clear filters: the box empties, also after its own commit landed', async () => {
    const { arrive, user, searchbox } = renderSearch();
    await user.type(searchbox, 'stk');
    await pause();
    arrive('stk');

    arrive(undefined);

    expect(searchbox).toHaveValue('');
  });

  it('follows Back and Forward to its own earlier searches', async () => {
    const { arrive, user, searchbox } = renderSearch();
    await user.type(searchbox, 'stk');
    await pause();
    arrive('stk');
    await user.type(searchbox, '-1');
    await pause();
    arrive('stk-1');

    // Back
    arrive('stk');
    expect(searchbox).toHaveValue('stk');
    // Back to before the search, then Forward twice
    arrive(undefined);
    expect(searchbox).toHaveValue('');
    arrive('stk');
    expect(searchbox).toHaveValue('stk');
    arrive('stk-1');
    expect(searchbox).toHaveValue('stk-1');
  });

  it('follows an external search (e.g. a shared link) that replaces the typed text', () => {
    const { arrive, searchbox } = renderSearch('stk');
    expect(searchbox).toHaveValue('stk');

    arrive('ford');

    expect(searchbox).toHaveValue('ford');
  });
});
