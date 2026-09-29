const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distAssets = path.join(distDir, 'assets');
const prebuiltDir = path.join(__dirname, '..', 'prebuilt');
const prebuiltAssetsDir = path.join(prebuiltDir, 'assets');
const rootAssetsDir = path.join(__dirname, '..', 'assets');

fs.mkdirSync(prebuiltDir, { recursive: true });

// Clean up stale hashed .js and .css files in prebuilt/, prebuilt/assets/, and assets/ so random-hash files never cause git conflicts or serve old chunks
for (const dir of [prebuiltDir, prebuiltAssetsDir, rootAssetsDir]) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, f);
      try {
        if (fs.statSync(fullPath).isFile()) {
          const isPrebuiltCore =
            dir === prebuiltDir &&
            (f === 'app.js' ||
              f === 'app.css' ||
              f === 'tailwind-bundle.css' ||
              f === 'server.cjs' ||
              f === 'index.html' ||
              f === 'favicon.svg' ||
              f === 'logo.svg' ||
              f === 'manifest.json' ||
              f === 'sw.js');
          if (!isPrebuiltCore && (f.endsWith('.js') || f.endsWith('.css'))) {
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
  const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
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

// 3. Always compile self-contained single-file bundle from src/main.tsx -> prebuilt/app.js (even if dist/ does not exist)
try {
  const esbuild = require('esbuild');
  const mainEntry = path.join(__dirname, '..', 'src', 'main.tsx');
  const prebuiltAppJs = path.join(prebuiltDir, 'app.js');
  const prebuiltAppCss = path.join(prebuiltDir, 'app.css');
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
    if (fs.existsSync(prebuiltAppCss) && fs.existsSync(prebuiltAppJs)) {
      const extraPopupCss =
        '\n.vs-auth-popup-window{width:100%!important;max-width:420px!important;max-height:88vh!important;overflow-y:auto!important;margin:auto!important;border-radius:16px!important;}.vs-legal-popup-window{width:100%!important;max-width:460px!important;max-height:82vh!important;margin:auto!important;border-radius:16px!important;}\n';
      const cssContent = fs.readFileSync(prebuiltAppCss, 'utf8') + extraPopupCss;
      const jsContent = fs.readFileSync(prebuiltAppJs, 'utf8');
      if (!jsContent.includes('vs-tailwind-inline')) {
        const styleInjector = `(function(){if(typeof document!=='undefined'&&!document.getElementById('vs-tailwind-inline')){var s=document.createElement('style');s.id='vs-tailwind-inline';s.textContent=${JSON.stringify(
          cssContent
        )};document.head.appendChild(s);}})();\n`;
        fs.writeFileSync(prebuiltAppJs, styleInjector + jsContent, 'utf8');
      }
    }
    console.log('[sync-prebuilt] Built self-contained prebuilt/app.js');
  }
} catch (err) {
  console.warn('[sync-prebuilt] app esbuild warning:', err && err.message);
}

// 4. Write clean prebuilt/index.html that references fixed /prebuilt/app.css and /prebuilt/app.js
const rootIndexHtml = path.join(__dirname, '..', 'index.html');
const prebuiltIndexHtml = path.join(prebuiltDir, 'index.html');
if (fs.existsSync(rootIndexHtml)) {
  const rawHtml = fs.readFileSync(rootIndexHtml, 'utf8');
  const prodHtml = rawHtml
    .replace(
      '</head>',
      '    <link rel="stylesheet" href="/prebuilt/app.css" />\n  </head>'
    )
    .replace(
      /<script type="module" src="\/src\/main\.tsx"[^>]*><\/script>/,
      '<script type="module" src="/prebuilt/app.js"></script>'
    );
  fs.writeFileSync(prebuiltIndexHtml, prodHtml, 'utf8');
  console.log('[sync-prebuilt] Wrote clean prebuilt/index.html');
}
