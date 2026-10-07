import { SEARCH_MAX_LENGTH } from '@shared/api/vehicles';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/Field';
import { TextInput } from '@/components/TextInput';
import { useSearchDraft } from '../hooks/useSearchDraft';

type Props = {
  /** Committed search from the URL (already trimmed). */
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
  className?: string;
};

/**
 * Free-text search on VIN, stock number or model (BR-08). Typing edits a local draft; the URL
 * (and so the request) changes once typing pauses for 300 ms (TA-08).
 */
export function SearchFilter({ value, onCommit, className }: Props) {
  const { t } = useTranslation();
  const { draft, setDraft } = useSearchDraft(value, onCommit);

  return (
    <Field
      label={t('inventory.filters.search.label')}
      hint={t('inventory.filters.search.hint')}
      className={className}
    >
      {(control) => (
        <TextInput
          {...control}
          type="search"
          value={draft}
          maxLength={SEARCH_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
    </Field>
  );
}
