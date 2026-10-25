import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function pdfjsStaticAssets(): Plugin {
  const cmaps = path.resolve(__dirname, 'node_modules/pdfjs-dist/cmaps');
  const fonts = path.resolve(__dirname, 'node_modules/pdfjs-dist/standard_fonts');
  const serve = (root: string) => (req: any, res: any, next: () => void) => {
    try {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
      const file = path.resolve(root, rel);
      const base = path.resolve(root);
      if (file !== base && !file.startsWith(base + path.sep)) return next();
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
      res.setHeader('Content-Type', 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    } catch {
      next();
    }
  };
  return {
    name: 'floatgpt-pdfjs-assets',
    configureServer(server) {
      if (!fs.existsSync(cmaps)) return;
      server.middlewares.use('/pdfjs/cmaps', serve(cmaps));
      server.middlewares.use('/pdfjs/standard_fonts', serve(fonts));
    },
    closeBundle() {
      if (!fs.existsSync(cmaps)) return;
      const out = path.resolve(__dirname, 'dist/pdfjs');
      fs.cpSync(cmaps, path.join(out, 'cmaps'), { recursive: true });
      fs.cpSync(fonts, path.join(out, 'standard_fonts'), { recursive: true });
    },
  };
}

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'GROQ_', 'GEMINI_', 'OPENAI_', 'ANTHROPIC_'],
    plugins: [react(), tailwindcss(), pdfjsStaticAssets()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/docs/**', '**/playground/**', '**/.git/**', '**/release/**']
      },
    },
  };
});
