import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` replica el proxy de nginx: /api → API publicada por Compose en el host.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
