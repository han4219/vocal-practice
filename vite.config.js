import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Relative assets work on both /repository/ and a custom domain.
    base: env.VITE_BASE_PATH || './',
    plugins: [react(), tailwindcss()],
    build: { target: 'es2020' },
  };
});
