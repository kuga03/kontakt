import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 3000,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'assets', dest: '' },
        { src: 'vendor', dest: '' },
        { src: 'maps', dest: '' },
        { src: 'favicon.ico', dest: '' },
        { src: 'version.json', dest: '' },
        { src: 'ota.json', dest: '' },
      ],
    }),
  ],
});
