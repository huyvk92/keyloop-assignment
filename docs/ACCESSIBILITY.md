# Accessibility: decisions, evidence and manual checklist

Target: **WCAG 2.1 AA** (PRD NFR-01). This page records what was decided, what is checked
automatically, and what still needs a human with a real screen reader.

## 1. Structure

| Element   | Decision                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landmarks | banner, navigation "Main", main, region "Inventory summary", region "Aging stock", search "Filter vehicles", region "Vehicle list", navigation "Pagination", contentinfo. No nested regions   |
| Headings  | One `h1` (dealership name). `h2`: Inventory summary (visually hidden), Aging stock, Filter vehicles (visually hidden), Vehicle list. The drawer title is `h2`, its sections `h3`              |
| Table     | `<table>` with `<caption>`, `scope="col"`; sortable headers are buttons inside `<th>` with `aria-sort` on the active column. The scroll container is a focusable `group` named by the caption |
| Drawer    | Native `<dialog>` + `showModal()` (inert background, Escape). Focus to the title on open; back to the trigger on close, or to the "Vehicle list" heading if the trigger is gone               |
| Skip link | First Tab stop; moves focus to `<main>` without adding a history entry                                                                                                                        |

## 2. Announcements (one announcer rule)

Screen-reader users hear **one** polite message per user action, and nothing for background
activity.

| Event                         | Announced by                                 | Text (EN)                             |
| ----------------------------- | -------------------------------------------- | ------------------------------------- |
| Filter / search result change | `MatchCount` (`role="status"`)               | "6 vehicles match your filters"       |
| Page change only              | `MatchCount`                                 | "Showing 26-50 of 360"                |
| Sort change                   | Sort status in the list section              | "Sorted by price, ascending"          |
| Action saved                  | Form status                                  | "Action saved"                        |
| Save failed                   | Form alert (`role="alert"`, receives focus)  | Mapped message, never raw server text |
| 60 s poll, Refresh, language  | Nothing (Refresh only changes its own label) | -                                     |

Silent polls rely on remounting the live region when the same query's text changes. Most screen
readers do not announce a region that is inserted together with its text, but this is **not yet
verified with VoiceOver or NVDA** (see §5).

## 3. Colour contrast

Computed from the actual Tailwind oklch tokens; `src/lib/contrast.test.ts` fails if a pair drops
below its threshold (4.5:1 text, 3:1 UI/focus).

| Pair                                                    | Ratio              | Result                              |
| ------------------------------------------------------- | ------------------ | ----------------------------------- |
| "Aging" badge: aging-800 on aging-50                    | 6.88               | pass                                |
| "Needs attention" badge: attention-800 on attention-50  | 7.67               | pass                                |
| Muted text: slate-600 on white / slate-50               | 7.56 / 7.23        | pass                                |
| Primary button: white on brand-600                      | 6.39               | pass                                |
| Error text: red-700 on white                            | 6.42               | pass                                |
| Focus ring brand-500 on white / slate-50 / attention-50 | 4.79 / 4.57 / 4.38 | pass (UI ≥ 3)                       |
| Invalid border red-600 on white                         | 4.76               | pass                                |
| "Not aging" dash, unsorted sort icon (was slate-400)    | 2.63 / 2.51        | **fixed** → slate-500 (4.77 / 4.55) |
| Input and select borders (was slate-300)                | 1.48               | **fixed** → slate-500 (4.77)        |
| Footer text (was slate-500 on slate-50)                 | 4.55               | raised to slate-600 (7.23)          |

Status is never conveyed by colour alone: "Aging" and "Needs attention" are text labels, and the
"Not aging" dash has screen-reader text.

## 4. Automated evidence

| Check                                                                  | Where                                                       | Result                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| axe-core (WCAG 2.0/2.1 A + AA) on the dashboard EN and VI, drawer open | `e2e/a11y.spec.ts` (real API, Chrome)                       | 0 violations           |
| Keyboard: Tab to "View", Enter opens drawer, Escape returns focus      | `e2e/keyboard.spec.ts`                                      | pass                   |
| KPI region visible without scrolling at 1280x800, EN and VI (AC-005.4) | `e2e/viewport.spec.ts`                                      | pass (bottom at y=239) |
| Storybook a11y addon on every story (109) in a real browser            | Phase 6 run (see collaboration log)                         | 0 violations           |
| Landmarks, heading outline, Tab order, one announcement per action     | `src/pages/DashboardPage.a11y.test.tsx` and component tests | pass                   |
| Contrast pairs                                                         | `src/lib/contrast.test.ts`                                  | pass                   |
| Reduced motion: the drawer slide uses `motion-safe:` only              | `src/components/Dialog.test.tsx`                            | pass                   |
| Lint                                                                   | `eslint-plugin-jsx-a11y`, 0 warnings                        | pass                   |

## 5. Manual screen-reader checklist (not yet performed)

Run with `APP_TODAY=2026-10-07`, dealership Birmingham, in English and Vietnamese, with
VoiceOver + Safari (macOS) and NVDA + Firefox or Chrome (Windows).

1. **Load `/dealerships/1`.** Focus is on the h1 ("Birmingham…, heading level 1"); the title is
   "Birmingham… · Inventory dashboard". Nothing else is announced.
2. **Landmarks** (VO rotor / NVDA `D`): as in §1, with no region named after the dealership and no
   landmark nested inside "Vehicle list".
3. **Headings** (VO rotor / NVDA `H`): h1, then four h2s, with no skipped levels.
4. **Skip link:** the first Tab shows "Skip to content" with a visible ring; Enter moves to main,
   and the next Tab reaches Refresh.
5. **Tab order:** skip link → brand → Language → Refresh → Dealership → View all + aging items →
   Search → Make → Model → Days in stock → the two checkboxes → Min, Max, Apply → Export CSV → table group →
   sort buttons → row "View" buttons → Previous, Next. Every stop has a visible focus ring.
6. **KPIs:** each value is read with its term. For York, the average reads "Not available", not
   "dash".
7. **Badges:** "Aging" and "Needs attention" are read as text; the "—" reads "Not aging".
8. **Filters:** changing Make reads the match count once. Typing in Search reads nothing per
   keystroke, then one count after the pause. Two quick changes keep both filters.
9. **Sort:** "List price" reads "Sorted by price, ascending" once, and the header's sort state is
   read. Back, Forward and Refresh read nothing.
10. **Paging:** Next reads "Showing 26-50 of 360" once; focus stays on Next, which reads as
    unavailable on the last page.
11. **Silence (the key check):** wait more than 60 s for a poll, press Refresh, and switch
    language. No count or range is announced; Refresh only changes its label.
12. **View all aging vehicles:** focus lands on "Vehicle list, heading level 2"; the count is read
    once.
13. **Drawer:**
    - "View STK-…" opens "dialog, STK-… · make model" with focus on the title.
    - Tab goes to Close, then the scrollable body (arrow keys scroll), then the form.
    - Escape closes the drawer and returns focus to the View button.
    - With reduced motion turned on, there is no slide.
14. **Form:**
    - Saving empty reads the errors linked to their fields and focuses the first radio.
    - A successful save reads "Action saved".
    - Offline, the alert is read and focused, and the inputs are kept.
15. **Errors:** with the API stopped, each region reads its alert and offers Retry, with no raw
    error text.
16. **Language switcher:** "Language, English". The options are read in their own language. After
    switching, `html lang="vi"`, and focus and the URL are unchanged.
17. **Zoom and size:** at 200% zoom and at 768 px width nothing is clipped, and the table scrolls
    horizontally from its focus stop with the arrow keys.

Record results (pass/fail per step, screen reader and browser versions) in the AI collaboration
log when the pass is done.
