const fs = require('fs');
const path = require('path');

// Restrict thread pools so cPanel CloudLinux LVE NPROC limits are never exceeded
process.env.GOMAXPROCS = '1';
process.env.UV_THREADPOOL_SIZE = '1';
process.env.RAYON_NUM_THREADS = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Ensure working directory is always the project root
try {
  process.chdir(__dirname);
} catch (_e) {}

const distDir = path.join(__dirname, 'dist');
const prebuiltDir = path.join(__dirname, 'prebuilt');
const distServer = path.join(distDir, 'server.cjs');
const prebuiltServer = path.join(prebuiltDir, 'server.cjs');
const prebuiltAppJs = path.join(prebuiltDir, 'app.js');
const prebuiltAppCss = path.join(prebuiltDir, 'app.css');

function buildWithEsbuild() {
  const esbuild = require('esbuild');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(prebuiltDir, { recursive: true });

  // 1. Ensure prebuilt/app.css has the full compiled Tailwind stylesheet (>50KB)
  const hasFullCss =
    fs.existsSync(prebuiltAppCss) && fs.statSync(prebuiltAppCss).size > 50000;
  if (!hasFullCss) {
    const tailwindBackup = path.join(prebuiltDir, 'tailwind-bundle.css');
    const rootAssetsDir = path.join(__dirname, 'assets');
    let restored = false;
    if (fs.existsSync(tailwindBackup) && fs.statSync(tailwindBackup).size > 50000) {
      fs.copyFileSync(tailwindBackup, prebuiltAppCss);
      restored = true;
    } else if (fs.existsSync(rootAssetsDir)) {
      const cssCandidate = fs
        .readdirSync(rootAssetsDir)
        .find((f) => f.endsWith('.css') && fs.statSync(path.join(rootAssetsDir, f)).size > 50000);
      if (cssCandidate) {
        fs.copyFileSync(path.join(rootAssetsDir, cssCandidate), prebuiltAppCss);
        restored = true;
      }
    }
    if (!restored && !fs.existsSync(prebuiltAppCss)) {
      const rawCssPath = path.join(__dirname, 'src', 'index.css');
      if (fs.existsSync(rawCssPath)) {
        const rawCss = fs
          .readFileSync(rawCssPath, 'utf8')
          .replace(/@import\s+["']tailwindcss["'];?/g, '');
        fs.writeFileSync(prebuiltAppCss, rawCss, 'utf8');
      }
    }
  }

  // 2. Always compile latest src/main.tsx -> prebuilt/app.js (~0.75s) so git pulls always take effect immediately
  const mainEntry = path.join(__dirname, 'src', 'main.tsx');
  if (fs.existsSync(mainEntry)) {
    esbuild.buildSync({
      entryPoints: [mainEntry],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: prebuiltAppJs,
      loader: {
        '.css': 'empty',
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.jpeg': 'dataurl',
        '.gif': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl'
      },
      define: {
        'process.env.NODE_ENV': '"production"',
        'import.meta.env': JSON.stringify({
          MODE: 'production',
          PROD: true,
          DEV: false,
          SSR: false,
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || ''
        })
      }
    });

    // Inject compiled Tailwind CSS inline into prebuilt/app.js so styles never break
    if (fs.existsSync(prebuiltAppCss) && fs.existsSync(prebuiltAppJs)) {
      const cssContent = fs.readFileSync(prebuiltAppCss, 'utf8');
      const jsContent = fs.readFileSync(prebuiltAppJs, 'utf8');
      if (!jsContent.includes('vs-tailwind-inline')) {
        const styleInjector = `(function(){if(typeof document!=='undefined'&&!document.getElementById('vs-tailwind-inline')){var s=document.createElement('style');s.id='vs-tailwind-inline';s.textContent=${JSON.stringify(
          cssContent
        )};document.head.appendChild(s);}})();\n`;
        fs.writeFileSync(prebuiltAppJs, styleInjector + jsContent, 'utf8');
      }
    }

    // Also sync any existing index-*.js in assets/ or dist/assets/ so no stale bundle can be served
    for (const assetsDir of [path.join(__dirname, 'assets'), path.join(distDir, 'assets')]) {
      if (fs.existsSync(assetsDir)) {
        for (const file of fs.readdirSync(assetsDir)) {
          if (file.startsWith('index-') && file.endsWith('.js')) {
            try {
              fs.copyFileSync(prebuiltAppJs, path.join(assetsDir, file));
            } catch (_e) {}
          }
        }
      }
    }
  }

  // 3. Always compile latest server.ts -> dist/server.cjs & prebuilt/server.cjs (~0.04s)
  const serverEntry = path.join(__dirname, 'server.ts');
  if (fs.existsSync(serverEntry)) {
    esbuild.buildSync({
      entryPoints: [serverEntry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      outfile: distServer
    });
    try {
      fs.copyFileSync(distServer, prebuiltServer);
    } catch (_e) {}
  }
}

// Always compile latest source files on startup so any git pull on cPanel takes effect immediately
try {
  console.log('[Bootstrap] Compiling latest source files (src/main.tsx & server.ts)...');
  buildWithEsbuild();
  console.log('[Bootstrap] Compilation complete.');
} catch (buildErr) {
  console.error('[Bootstrap] Build error:', buildErr);
  process.env.BOOTSTRAP_BUILD_ERROR = String(
    buildErr && buildErr.stack ? buildErr.stack : buildErr
  );
}

try {
  if (fs.existsSync(distServer)) {
    require(distServer);
  } else if (fs.existsSync(prebuiltServer)) {
    require(prebuiltServer);
  } else {
    throw new Error('Neither dist/server.cjs nor prebuilt/server.cjs exists.');
  }
} catch (startErr) {
  console.error('[Bootstrap] Server startup error:', startErr);
  const http = require('http');
  const port = Number(process.env.PORT) || 3000;
  http
    .createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'diagnostic',
          bootstrapBuildError: process.env.BOOTSTRAP_BUILD_ERROR || null,
          startupError: String(startErr && startErr.stack ? startErr.stack : startErr)
        })
      );
    })
    .listen(port);
}
