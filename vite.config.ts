import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        // Fix for path aliases using process.cwd()
        '@': path.resolve('.'),
      },
    },
    // Removed the 'define' block that injected process.env.API_KEY
    // as we are now using server-side processing.
  };
});