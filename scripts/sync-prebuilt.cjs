const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distAssets = path.join(distDir, 'assets');
const prebuiltDir = path.join(__dirname, '..', 'prebuilt');
const prebuiltAssetsDir = path.join(prebuiltDir, 'assets');
const rootAssetsDir = path.join(__dirname, '..', 'assets');

fs.mkdirSync(prebuiltDir, { recursive: true });
fs.mkdirSync(rootAssetsDir, { recursive: true });

// Clean up stale hashed files in prebuilt/, prebuilt/assets/, and assets/ so old builds never accumulate or cause git conflicts
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

// 1. Sync dist/server.cjs -> prebuilt/server.cjs so prebuilt server bundle is never stale
const distServer = path.join(distDir, 'server.cjs');
const prebuiltServer = path.join(prebuiltDir, 'server.cjs');
if (fs.existsSync(distServer)) {
  fs.copyFileSync(distServer, prebuiltServer);
  console.log('[sync-prebuilt] Synced dist/server.cjs -> prebuilt/server.cjs');
}

if (fs.existsSync(distAssets)) {
  const files = fs.readdirSync(distAssets);
  const jsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
  const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));

  if (cssFile) {
    const cssPath = path.join(distAssets, cssFile);
    fs.copyFileSync(cssPath, path.join(prebuiltDir, 'app.css'));
    fs.copyFileSync(cssPath, path.join(prebuiltDir, 'tailwind-bundle.css'));
    console.log(
      '[sync-prebuilt] Copied',
      cssFile,
      '-> prebuilt/app.css & prebuilt/tailwind-bundle.css'
    );
  }

  if (jsFile) {
    const jsPath = path.join(distAssets, jsFile);
    fs.copyFileSync(jsPath, path.join(prebuiltDir, 'app.js'));
    console.log('[sync-prebuilt] Synced', jsFile, '-> prebuilt/app.js');
  }

  // Also compile a self-contained single-file bundle into prebuilt/app.js so /prebuilt/app.js fallback works without needing relative chunks
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
      console.log('[sync-prebuilt] Built self-contained prebuilt/app.js bundle');
    }
  } catch (err) {
    console.warn('[sync-prebuilt] Fallback esbuild warning:', err && err.message);
  }

  // Copy current hashed assets to root /assets/
  for (const file of files) {
    fs.copyFileSync(path.join(distAssets, file), path.join(rootAssetsDir, file));
  }
  console.log('[sync-prebuilt] Synced dist/assets/* -> assets/*');
}

