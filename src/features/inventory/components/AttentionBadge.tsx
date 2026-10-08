import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/Badge';

type Props = { className?: string };

const alertIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 4.75v3.75" strokeLinecap="round" />
    <circle cx="8" cy="11" r="0.5" fill="currentColor" />
  </svg>
);

/**
 * "Needs attention" flag for an aging vehicle without an action (BR-16): visible text plus a
 * decorative icon, never colour alone (AC-010.1).
 */
export function AttentionBadge({ className }: Props) {
  const { t } = useTranslation();
  return (
    <Badge tone="attention" icon={alertIcon} className={className}>
      {t('inventory.attentionBadge')}
    </Badge>
  );
}
