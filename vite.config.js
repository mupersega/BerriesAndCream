import { defineConfig } from 'vite';

export default defineConfig({
  base: '/BerriesAndCream/', // Change this to your GitHub repository name
  build: {
    outDir: 'docs', // Ensure the output folder matches your GitHub Pages settings
  },
});
