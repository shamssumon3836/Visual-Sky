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

  if (!fs.existsSync(prebuiltAppJs)) {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, 'src', 'main.tsx')],
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
  }

  if (!fs.existsSync(prebuiltAppCss)) {
    const rawCssPath = path.join(__dirname, 'src', 'index.css');
    if (fs.existsSync(rawCssPath)) {
      const rawCss = fs.readFileSync(rawCssPath, 'utf8').replace(/@import\s+["']tailwindcss["'];?/g, '');
      fs.writeFileSync(prebuiltAppCss, rawCss, 'utf8');
    }
  }

  if (!fs.existsSync(distServer) && !fs.existsSync(prebuiltServer)) {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, 'server.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      outfile: distServer
    });
  }
}

// Only run esbuild if prebuilt/dist artifacts are missing (avoids CPU/memory hang on cPanel startup)
try {
  const hasServerBundle = fs.existsSync(distServer) || fs.existsSync(prebuiltServer);
  const hasClientBundle = fs.existsSync(prebuiltAppJs);
  if (!hasServerBundle || !hasClientBundle) {
    console.log('[Bootstrap] Prebuilt bundle missing, compiling with esbuild...');
    buildWithEsbuild();
  }
} catch (buildErr) {
  console.error('[Bootstrap] Build error:', buildErr);
  process.env.BOOTSTRAP_BUILD_ERROR = String(buildErr && buildErr.stack ? buildErr.stack : buildErr);
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
