import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import type { Plugin } from 'vite';
import { buildLightThemeCss, extractTokens } from './src/lib/theme/lightThemeRules';

// Light theme: one override per hard-coded dark-navy class found in src/
// (see src/lib/theme/lightThemeRules.ts). Served as a virtual stylesheet so
// it can never go stale against the components.
const LIGHT_THEME_ID = 'virtual:firmicore-light-theme.css';
function lightThemePlugin(): Plugin {
  const srcDir = path.resolve(__dirname, 'src');
  const resolved = path.join(srcDir, '__light-theme.generated.css');
  const collect = (dir: string, out: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'locales') collect(full, out);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        out.push(...extractTokens(fs.readFileSync(full, 'utf8')));
      }
    }
    return out;
  };
  return {
    name: 'firmicore-light-theme',
    enforce: 'pre',
    resolveId(id) {
      return id === LIGHT_THEME_ID ? resolved : null;
    },
    load(id) {
      return id === resolved ? buildLightThemeCss(collect(srcDir, [])) : null;
    },
  };
}

export default defineConfig({
  plugins: [lightThemePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
});
