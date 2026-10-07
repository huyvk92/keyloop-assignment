import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type UiState = {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
};

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      isSidebarOpen: false,
      toggleSidebar: () =>
        set((s) => ({ isSidebarOpen: !s.isSidebarOpen }), undefined, 'ui/toggleSidebar'),
      closeSidebar: () => set({ isSidebarOpen: false }, undefined, 'ui/closeSidebar'),
    }),
    { name: 'ui-store', enabled: import.meta.env.DEV },
  ),
);
