import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist/raw', assetsInlineLimit: 1000000, sourcemap: false, cssCodeSplit: false,
    rolldownOptions: { output: { codeSplitting: false } } }
});
