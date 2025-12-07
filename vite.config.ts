import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        // This maps "@" to the project root directory, allowing imports like "@/components/..."
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      // This injects the API key into the code at build time, preventing "process is not defined" errors.
      // It checks VITE_API_KEY first (standard), then API_KEY, then GEMINI_API_KEY.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || env.GEMINI_API_KEY),
    },
  };
});