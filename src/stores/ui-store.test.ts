import { useUiStore } from '@/stores/ui-store';

describe('useUiStore', () => {
  it('toggles the sidebar', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(true);

    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it('closes the sidebar', () => {
    useUiStore.setState({ isSidebarOpen: true });
    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });

  it('starts from the initial state in every test (reset in setup.ts)', () => {
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
  });
});
