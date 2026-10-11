const LIVE_REGION =
  '[role="status"], [role="alert"], [role="log"], [aria-live]:not([aria-live="off"])';

const liveRegionOf = (node: Node | null): Element | null => {
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return element?.closest(LIVE_REGION) ?? null;
};

/**
 * Records what screen readers would announce, following ARIA live-region semantics: a text
 * change inside a live region that is already in the document. Inserting a region together with
 * its content is not a change to that region, so it is not recorded (except `role="alert"`,
 * which screen readers announce on insertion). Empty text (a cleared region) is not recorded.
 *
 * Call `stop()` (or let the test end) to disconnect; read `announcements` at any time.
 */
export function recordAnnouncements(root: Node = document.body) {
  const announcements: string[] = [];
  const observer = new MutationObserver((records) => {
    const changed = new Set<Element>();
    for (const record of records) {
      const region = liveRegionOf(record.target);
      if (region) changed.add(region);
      for (const added of record.addedNodes) {
        if (added instanceof Element && added.matches('[role="alert"]')) changed.add(added);
      }
    }
    for (const region of changed) {
      const text = region.textContent.trim();
      if (region.isConnected && text) announcements.push(text);
    }
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });
  return { announcements, stop: () => observer.disconnect() };
}
