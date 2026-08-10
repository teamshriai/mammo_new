import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/mammodemo/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/mammodemo/predict': {
        target: 'http://127.0.0.1:5009',
        rewrite: (path) => path.replace(/^\/mammodemo/, ''),
      },
      '/mammodemo/list-remote-folders': {
        target: 'http://127.0.0.1:5009',
        rewrite: (path) => path.replace(/^\/mammodemo/, ''),
      },
      '/mammodemo/preview-remote-folder': {
        target: 'http://127.0.0.1:5009',
        rewrite: (path) => path.replace(/^\/mammodemo/, ''),
      },
      '/mammodemo/predict-remote': {
        target: 'http://127.0.0.1:5009',
        rewrite: (path) => path.replace(/^\/mammodemo/, ''),
      },
      '/mammodemo/static': {
        target: 'http://127.0.0.1:5009',
        rewrite: (path) => path.replace(/^\/mammodemo/, ''),
      },
      '/predict': 'http://127.0.0.1:5009',
      '/health': 'http://127.0.0.1:5009',
      '/static': 'http://127.0.0.1:5009',
      '/list-remote-folders': 'http://127.0.0.1:5009',
      '/preview-remote-folder': 'http://127.0.0.1:5009',
      '/predict-remote': 'http://127.0.0.1:5009',
      '/predict-synthetic': 'http://127.0.0.1:5009',
    },
  },
});
