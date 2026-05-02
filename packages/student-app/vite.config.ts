import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist-renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, 'renderer/login.html'),
        lock: path.resolve(__dirname, 'renderer/lock.html'),
        exam: path.resolve(__dirname, 'renderer/exam.html'),
        dashboard: path.resolve(__dirname, 'renderer/dashboard.html'),
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    host: "localhost",
  },
});
