const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const distDir = path.join(__dirname, '..', 'dist');
const distAssets = path.join(distDir, 'assets');
const prebuiltDir = path.join(__dirname, '..', 'prebuilt');
const prebuiltAssetsDir = path.join(prebuiltDir, 'assets');
const rootAssetsDir = path.join(__dirname, '..', 'assets');

fs.mkdirSync(prebuiltDir, { recursive: true });

// Clean up stale hashed .js, .css, .gz, and .br files in prebuilt/, prebuilt/assets/, and assets/
for (const dir of [prebuiltDir, prebuiltAssetsDir, rootAssetsDir]) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, f);
      try {
        if (fs.statSync(fullPath).isFile()) {
          const isPrebuiltCore =
            dir === prebuiltDir &&
            (f === 'app.js' ||
              f === 'app.js.gz' ||
              f === 'app.js.br' ||
              f === 'firebase-runtime.js' ||
              f === 'firebase-runtime.js.gz' ||
              f === 'firebase-runtime.js.br' ||
              f === 'app.css' ||
              f === 'app.css.gz' ||
              f === 'app.css.br' ||
              f === 'tailwind-bundle.css' ||
              f === 'server.cjs' ||
              f === 'index.html' ||
              f === 'favicon.svg' ||
              f === 'logo.svg' ||
              f === 'manifest.json' ||
              f === 'sw.js' ||
              f === '.htaccess');
          if (!isPrebuiltCore && (f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.gz') || f.endsWith('.br'))) {
            fs.unlinkSync(fullPath);
          }
        }
      } catch {}
    }
  }
}

// 1. Copy CSS from dist/assets if present
if (fs.existsSync(distAssets)) {
  const files = fs.readdirSync(distAssets);
  const cssFile = files.find((f) => f.endsWith('.css'));
  if (cssFile) {
    const cssPath = path.join(distAssets, cssFile);
    fs.copyFileSync(cssPath, path.join(prebuiltDir, 'app.css'));
    fs.copyFileSync(cssPath, path.join(prebuiltDir, 'tailwind-bundle.css'));
    console.log('[sync-prebuilt] Copied', cssFile, '-> prebuilt/app.css');
  }
}

// 2. Always compile latest server.ts -> prebuilt/server.cjs using esbuild
try {
  const esbuild = require('esbuild');
  const serverEntry = path.join(__dirname, '..', 'server.ts');
  const prebuiltServer = path.join(prebuiltDir, 'server.cjs');
  if (fs.existsSync(serverEntry)) {
    esbuild.buildSync({
      entryPoints: [serverEntry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      outfile: prebuiltServer
    });
    console.log('[sync-prebuilt] Compiled server.ts -> prebuilt/server.cjs');
  }
} catch (err) {
  console.warn('[sync-prebuilt] server esbuild warning:', err && err.message);
}

// 3. Always compile fast, tree-shaken single-file bundle from src/main.tsx -> prebuilt/app.js
//    and separate background Firebase SDK chunk -> prebuilt/firebase-runtime.js
try {
  const esbuild = require('esbuild');
  const mainEntry = path.join(__dirname, '..', 'src', 'main.tsx');
  const firebaseRuntimeEntry = path.join(__dirname, '..', 'src', 'lib', 'firebaseRuntime.ts');
  const prebuiltAppJs = path.join(prebuiltDir, 'app.js');
  const prebuiltFirebaseJs = path.join(prebuiltDir, 'firebase-runtime.js');

  if (fs.existsSync(firebaseRuntimeEntry)) {
    esbuild.buildSync({
      entryPoints: [firebaseRuntimeEntry],
      bundle: true,
      minify: true,
      treeShaking: true,
      legalComments: 'none',
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: prebuiltFirebaseJs,
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
    console.log('[sync-prebuilt] Built background prebuilt/firebase-runtime.js');
  }

  if (fs.existsSync(mainEntry)) {
    const supaUrl = process.env.VITE_SUPABASE_URL || '';
    const supaKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const fbVer = fs.existsSync(prebuiltFirebaseJs)
      ? Math.floor(fs.statSync(prebuiltFirebaseJs).mtimeMs).toString(36)
      : 'v1';
    esbuild.buildSync({
      entryPoints: [mainEntry],
      bundle: true,
      minify: true,
      treeShaking: true,
      legalComments: 'none',
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: prebuiltAppJs,
      external: ['/prebuilt/firebase-runtime.js'],
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
        'import.meta.env.MODE': '"production"',
        'import.meta.env.PROD': 'true',
        'import.meta.env.DEV': 'false',
        'import.meta.env.SSR': 'false',
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supaUrl),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supaKey),
        'import.meta.env': JSON.stringify({
          MODE: 'production',
          PROD: true,
          DEV: false,
          SSR: false,
          VITE_SUPABASE_URL: supaUrl,
          VITE_SUPABASE_ANON_KEY: supaKey
        })
      }
    });
    console.log('[sync-prebuilt] Built self-contained prebuilt/app.js');
  }
} catch (err) {
  console.warn('[sync-prebuilt] app esbuild warning:', err && err.message);
}

// 3b. Pre-compress app.js, firebase-runtime.js, and app.css with Gzip (level 9) and Brotli (quality 9) for instant 0ms RAM/disk serving
for (const fileName of ['app.js', 'firebase-runtime.js', 'app.css']) {
  const targetPath = path.join(prebuiltDir, fileName);
  if (fs.existsSync(targetPath)) {
    try {
      const rawBuf = fs.readFileSync(targetPath);
      const gzBuf = zlib.gzipSync(rawBuf, { level: 9 });
      const brBuf = zlib.brotliCompressSync(rawBuf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 }
      });
      fs.writeFileSync(`${targetPath}.gz`, gzBuf);
      fs.writeFileSync(`${targetPath}.br`, brBuf);
    } catch (e) {
      console.warn('[sync-prebuilt] pre-compress warning for', fileName, e && e.message);
    }
  }
}

// 3c. Write prebuilt/.htaccess so Apache / LiteSpeed on cPanel automatically serves Brotli/Gzip and caches static bundles
try {
  const htaccessContent = `<IfModule mod_headers.c>
  Header append Vary Accept-Encoding
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE application/javascript text/javascript text/css text/html application/json image/svg+xml
</IfModule>
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTP:Accept-Encoding} br
  RewriteCond %{REQUEST_FILENAME}.br -f
  RewriteRule ^(.+\\.(js|css))$ $1.br [QSA,L]
  RewriteCond %{HTTP:Accept-Encoding} gzip
  RewriteCond %{REQUEST_FILENAME}.gz -f
  RewriteRule ^(.+\\.(js|css))$ $1.gz [QSA,L]
</IfModule>
<FilesMatch "\\.js\\.br$">
  ForceType application/javascript
  Header set Content-Encoding br
</FilesMatch>
<FilesMatch "\\.js\\.gz$">
  ForceType application/javascript
  Header set Content-Encoding gzip
</FilesMatch>
<FilesMatch "\\.css\\.br$">
  ForceType text/css
  Header set Content-Encoding br
</FilesMatch>
<FilesMatch "\\.css\\.gz$">
  ForceType text/css
  Header set Content-Encoding gzip
</FilesMatch>
`;
  fs.writeFileSync(path.join(prebuiltDir, '.htaccess'), htaccessContent, 'utf8');
} catch {}

// 4. Write clean index.html and prebuilt/index.html with parallel modulepreload + style preload
const rootIndexHtml = path.join(__dirname, '..', 'index.html');
const prebuiltIndexHtml = path.join(prebuiltDir, 'index.html');
const prebuiltAppJsPath = path.join(prebuiltDir, 'app.js');
const versionTag = fs.existsSync(prebuiltAppJsPath)
  ? Math.floor(fs.statSync(prebuiltAppJsPath).mtimeMs).toString(36)
  : 'v' + Math.floor(Date.now() / 1000).toString(36);

const cleanHtml = `<!doctype html>
<html lang="en" style="background-color: #080c14; color: #f1f5f9;">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preload" href="/prebuilt/app.css?v=${versionTag}" as="style" />
    <link rel="modulepreload" href="/prebuilt/app.js?v=${versionTag}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#080c14" />
    <title>VisualSky - Cold Outreach &amp; Lead Engine</title>
    <meta name="description" content="Enterprise-grade AI lead intelligence, outbound SMTP relays, cold email sequences, multi-platform lead miner, unified inbox, and client CRM." />
    <meta property="og:title" content="VisualSky - Cold Outreach &amp; Lead Engine" />
    <meta property="og:description" content="Enterprise-grade AI lead intelligence, outbound SMTP relays, cold email sequences, multi-platform lead miner, unified inbox, and client CRM." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>
      .vs-auth-popup-window {
        width: 100% !important;
        max-width: 420px !important;
        max-height: 88vh !important;
        overflow-y: auto !important;
        margin: auto !important;
        border-radius: 16px !important;
      }
      .vs-legal-popup-window {
        width: 100% !important;
        max-width: 460px !important;
        max-height: 82vh !important;
        margin: auto !important;
        border-radius: 16px !important;
      }
    </style>
    <link rel="stylesheet" href="/prebuilt/app.css?v=${versionTag}" />
  </head>
  <body style="background-color: #080c14; color: #f1f5f9; margin: 0; min-height: 100vh;">
    <div id="root"></div>
    <script type="module" src="/prebuilt/app.js?v=${versionTag}"></script>
  </body>
</html>
`;

fs.writeFileSync(rootIndexHtml, cleanHtml, 'utf8');
fs.writeFileSync(prebuiltIndexHtml, cleanHtml, 'utf8');
console.log('[sync-prebuilt] Wrote clean index.html & prebuilt/index.html with preload hints & pre-compressed assets');
