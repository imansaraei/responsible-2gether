import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

const cream = '#fbf3e8';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.12, resizeOptions: { background: cream } },
    apple: { ...preset.apple, padding: 0.12, resizeOptions: { background: cream } },
  },
  images: ['public/icon.svg'],
});
