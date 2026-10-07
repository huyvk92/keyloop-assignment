---
name: create-component
description: Generate a React component with its test and Storybook story (CSF Next) following react-best-practices - typed props, Tailwind + cn(), accessible markup, RTL test, and one story per visual state. Use when adding a new shared UI component or a feature component.
argument-hint: <ComponentName> [feature-name]
---

# Create Component

Arguments: `$ARGUMENTS` → `<ComponentName> [feature]`.

- No feature: shared UI in `src/components/<Name>.tsx` (presentational, no data fetching).
- With a feature: `src/features/<feature>/components/<Name>.tsx`, exported from
  `src/features/<feature>/index.ts` if other features or pages use it.

## Steps

1. Read [react-best-practices](../react-best-practices/SKILL.md) sections 3, 9, 10, 15 and 16.
   Check that a component with the same responsibility doesn't already exist (`Glob src/**/<Name>*`).
2. Ask the user (or read the TRD task) for: purpose, props, variants/states, and interactions.
   Don't invent props beyond the TRD.
3. Create the three files from the templates below. Replace `Name`, the props, and the states.
4. Run `npx vitest run <path>`, `npm run lint`, and `npm run typecheck`, then fix until green.
5. Report the files created and the states covered.

## Templates

`Name.tsx`:

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Props = ComponentProps<'div'> & {
  title: string;
};

export function Name({ title, className, children, ...props }: Props) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4', className)} {...props}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
```

`Name.test.tsx` (use `renderWithProviders` from `@/test/render` if the component needs the router
or Query):

```tsx
import { render, screen } from '@testing-library/react';
import { Name } from '@/components/Name';

describe('Name', () => {
  it('renders the title as a heading', () => {
    render(<Name title="Summary" />);

    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
  });
});
```

`Name.stories.tsx`:

```tsx
import preview from '#.storybook/preview';
import { Name } from '@/components/Name';

const meta = preview.meta({
  title: 'Components/Name', // features: 'Features/<feature>/Name'
  component: Name,
  args: { title: 'Summary' },
});

export const Default = meta.story({});

// One story per meaningful state, e.g.:
// export const Empty = meta.story({ args: { ... } });
// export const Error = meta.story({ beforeEach({ msw }) { msw.use(...) } });
```

## Rules

- Interactive elements are native (`button`, `a`, `input`) with accessible names.
- Use variants as a typed map with `satisfies Record<Variant, string>` (see `src/components/Button.tsx`).
- Data-driven components show all four states: loading, error, empty, and success. Each one gets
  a test and a story.
