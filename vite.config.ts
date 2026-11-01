import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function swAssetInjector() {
  return {
    name: 'sw-asset-injector',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const assetsDir = path.join(distDir, 'assets');
      const swFile = path.join(distDir, 'sw.js');

      if (!fs.existsSync(assetsDir) || !fs.existsSync(swFile)) return;

      const assetFiles = fs
        .readdirSync(assetsDir)
        .filter((file) => file.endsWith('.js') || file.endsWith('.css'))
        .map((file) => `./assets/${file}`);

      const publicSwFile = path.resolve(__dirname, 'public/sw.js');
      if (!fs.existsSync(publicSwFile)) return;

      let swContent = fs.readFileSync(publicSwFile, 'utf-8');
      const injectionTarget = 'const STATIC_ASSETS = [';
      if (swContent.includes(injectionTarget)) {
        const assetsListString = assetFiles.map((f) => `  '${f}',`).join('\n');
        swContent = swContent.replace(
          injectionTarget,
          `${injectionTarget}\n${assetsListString}`
        );
        fs.writeFileSync(swFile, swContent, 'utf-8');
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), swAssetInjector()],
  base: './', // Relative base path for GitHub Pages and PWA offline loading
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
          'vendor-motion': ['motion/react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
