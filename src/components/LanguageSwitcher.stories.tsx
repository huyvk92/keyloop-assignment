import preview from '#.storybook/preview';
import { expect } from 'storybook/test';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { i18n } from '@/i18n';

const meta = preview.meta({
  title: 'Components/LanguageSwitcher',
  component: LanguageSwitcher,
});

export const English = meta.story({
  globals: { locale: 'en' },
});

export const Vietnamese = meta.story({
  globals: { locale: 'vi' },
});

export const SwitchToVietnamese = meta.story({
  globals: { locale: 'en' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Language' }), 'vi');
    await expect(canvas.getByRole('combobox', { name: 'Ngôn ngữ' })).toHaveValue('vi');
    await expect(document.documentElement).toHaveAttribute('lang', 'vi');
    // Leave Storybook in English for the next story.
    await i18n.changeLanguage('en');
  },
});
