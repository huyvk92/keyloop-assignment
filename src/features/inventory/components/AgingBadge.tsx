import { Badge } from '@/components/Badge';

const clockIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** "Aging" flag: visible text plus a decorative icon, never colour alone (AC-003.4). */
export function AgingBadge() {
  return (
    <Badge tone="aging" icon={clockIcon}>
      Aging
    </Badge>
  );
}
