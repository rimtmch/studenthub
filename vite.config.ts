import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Fix: Cast process to any to avoid TS error 'Property cwd does not exist on type Process'
  const env = loadEnv(mode, (process as any).cwd(), '')
  
  // Use the env var if it exists, otherwise fallback to the provided key (for immediate functionality)
  const apiKey = env.VITE_API_KEY || 'AIzaSyAchYinC_Q4fZgtkLAIsVNBvo9CzugBK1I';

  return {
    plugins: [react()],
    base: './', // CRITICAL: Sets base path to relative for GitHub Pages support
    define: {
      // Maps process.env.API_KEY in the code to the actual key
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  }
})