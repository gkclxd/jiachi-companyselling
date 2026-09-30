import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// mode "demo"：前端內嵌計算引擎、輸出單一 HTML（用於離線預覽），正式版一律呼叫後端 API
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
    fs: { allow: ['..'] },
  },
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', target: 'es2020' },
}));
