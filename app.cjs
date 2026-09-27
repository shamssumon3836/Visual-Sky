const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const prebuiltAppJs = path.join(prebuiltDir, 'app.js');
const prebuiltAppCss = path.join(prebuiltDir, 'app.css');
const hashFile = path.join(distDir, '.build-hash');

function computeSourceHash() {
  const hash = crypto.createHash('md5');
  const targets = ['package.json', 'server.ts', 'src', 'firebase-applet-config.json'];

  function walk(itemPath) {
    if (!fs.existsSync(itemPath)) return;
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(itemPath).sort();
      for (const entry of entries) {
        walk(path.join(itemPath, entry));
      }
    } else if (stat.isFile()) {
      hash.update(itemPath.replace(__dirname, ''));
      hash.update(fs.readFileSync(itemPath));
    }
  }

  for (const t of targets) {
    walk(path.join(__dirname, t));
  }
  return hash.digest('hex');
}

function buildWithEsbuild() {
  const esbuild = require('esbuild');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(prebuiltDir, { recursive: true });

  // 1. Bundle Frontend React App (src/main.tsx -> prebuilt/app.js)
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

  // 2. Write custom CSS rules (src/index.css without @import "tailwindcss") -> prebuilt/app.css
  if (!fs.existsSync(prebuiltAppCss)) {
    const rawCssPath = path.join(__dirname, 'src', 'index.css');
    if (fs.existsSync(rawCssPath)) {
      const rawCss = fs.readFileSync(rawCssPath, 'utf8').replace(/@import\s+["']tailwindcss["'];?/g, '');
      fs.writeFileSync(prebuiltAppCss, rawCss, 'utf8');
    }
  }

  // 3. Bundle Backend Express Server (server.ts -> dist/server.cjs)
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, 'server.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    outfile: distServer
  });
}

try {
  const currentHash = computeSourceHash();
  const previousHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : '';

  if (!fs.existsSync(distServer) || !fs.existsSync(prebuiltAppJs) || currentHash !== previousHash) {
    console.log('[Bootstrap] Compiling frontend and backend with esbuild...');
    buildWithEsbuild();
    fs.writeFileSync(hashFile, currentHash, 'utf8');
    console.log('[Bootstrap] Compilation finished successfully.');
  }
} catch (buildErr) {
  console.error('[Bootstrap] Build error:', buildErr);
  process.env.BOOTSTRAP_BUILD_ERROR = String(buildErr && buildErr.stack ? buildErr.stack : buildErr);
}

try {
  if (fs.existsSync(distServer)) {
    require(distServer);
  } else if (fs.existsSync(path.join(prebuiltDir, 'server.cjs'))) {
    require(path.join(prebuiltDir, 'server.cjs'));
  } else {
    throw new Error('Neither dist/server.cjs nor prebuilt/server.cjs exists after build.');
  }
} catch (startErr) {
  console.error('[Bootstrap] Server startup error:', startErr);
  // Fallback diagnostic server so Passenger never returns an opaque 503 Service Unavailable
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
