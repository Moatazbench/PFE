// frontend/vite.config.js
import dns from 'node:dns';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Keep local API traffic on localhost while avoiding flaky IPv6 loopback resolution on Windows.
dns.setDefaultResultOrder('ipv4first');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:5009';

  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      proxy: {
        // Any request starting with /api from the frontend
        // will be proxied to your local Node backend on port 5000 by default.
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
