import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', 'msw-storybook-addon'],
  // Serves public/mockServiceWorker.js for msw-storybook-addon
  staticDirs: ['../public'],
});
