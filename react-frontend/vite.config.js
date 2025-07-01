import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 10001,
        proxy: {
            '/api': {
                target: 'http://10.0.30.251:10000',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://10.0.30.251:10000',
                ws: true,
            }
        }
    }
});
