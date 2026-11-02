import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { cleanShoppingQuery, comparePrices } from './src/shopping/priceCompare';
import { cleanLiveQuery, collectLive } from './src/live/liveFeed';

function pdfjsStaticAssets(): Plugin {
  const cmaps = path.resolve(__dirname, 'node_modules/pdfjs-dist/cmaps');
  const fonts = path.resolve(__dirname, 'node_modules/pdfjs-dist/standard_fonts');
  const worker = path.resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs');
  const serveFile = (filePath: string, contentType: string) => (_req: any, res: any) => {
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  };
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
      if (fs.existsSync(worker)) {
        server.middlewares.use('/pdfjs/pdf.worker.min.mjs', serveFile(worker, 'text/javascript'));
      }
      if (!fs.existsSync(cmaps)) return;
      server.middlewares.use('/pdfjs/cmaps', serve(cmaps));
      server.middlewares.use('/pdfjs/standard_fonts', serve(fonts));
    },
    closeBundle() {
      if (!fs.existsSync(cmaps)) return;
      const out = path.resolve(__dirname, 'dist/pdfjs');
      fs.cpSync(cmaps, path.join(out, 'cmaps'), { recursive: true });
      fs.cpSync(fonts, path.join(out, 'standard_fonts'), { recursive: true });
      if (fs.existsSync(worker)) fs.copyFileSync(worker, path.join(out, 'pdf.worker.min.mjs'));
    },
  };
}

// Serves /api/prices inside the already-running dev server.
function priceCompareApi(): Plugin {
  return {
    name: 'floatgpt-price-compare',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url || '';
        if (raw.startsWith('/api/live')) {
          try {
            const query = cleanLiveQuery(new URL(raw, 'http://localhost').searchParams.get('q') || '');
            const brief = query ? await collectLive(query) : '';
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ query, brief }));
          } catch {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ query: '', brief: '' }));
          }
          return;
        }
        if (!raw.startsWith('/api/prices')) return next();
        try {
          const query = cleanShoppingQuery(new URL(raw, 'http://localhost').searchParams.get('q') || '');
          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Type the product you want to compare.' }));
            return;
          }
          const offers = await comparePrices(query);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ query, offers }));
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'The stores did not answer. Try the search again.' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'GROQ_', 'GEMINI_', 'OPENAI_', 'ANTHROPIC_'],
    plugins: [priceCompareApi(), react(), tailwindcss(), pdfjsStaticAssets()],
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
