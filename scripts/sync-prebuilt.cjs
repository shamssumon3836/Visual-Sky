const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distAssets = path.join(distDir, 'assets');
const prebuiltDir = path.join(__dirname, '..', 'prebuilt');
const prebuiltAssetsDir = path.join(prebuiltDir, 'assets');
const rootAssetsDir = path.join(__dirname, '..', 'assets');

fs.mkdirSync(prebuiltDir, { recursive: true });

// Clean up stale hashed .js, .css, .gz, .br, and .htaccess files in prebuilt/, prebuilt/assets/, and assets/
for (const dir of [prebuiltDir, prebuiltAssetsDir, rootAssetsDir]) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, f);
      try {
        if (fs.statSync(fullPath).isFile()) {
          const isPrebuiltCore =
            dir === prebuiltDir &&
            (f === 'app.js' ||
              f === 'bundle.js' ||
              f === 'firebase-runtime.js' ||
              f === 'app.css' ||
              f === 'bundle.css' ||
              f === 'tailwind-bundle.css' ||
              f === 'server.cjs' ||
              f === 'index.html' ||
              f === 'favicon.svg' ||
              f === 'logo.svg' ||
              f === 'manifest.json' ||
              f === 'sw.js');
          if (
            !isPrebuiltCore &&
            (f.endsWith('.js') ||
              f.endsWith('.css') ||
              f.endsWith('.gz') ||
              f.endsWith('.br') ||
              f === '.htaccess')
          ) {
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
    fs.copyFileSync(cssPath, path.join(prebuiltDir, 'bundle.css'));
    fs.copyFileSync(cssPath, path.join(prebuiltDir, 'tailwind-bundle.css'));
    console.log('[sync-prebuilt] Copied', cssFile, '-> prebuilt/bundle.css & prebuilt/app.css');
  }
}

// 2. Compile deferred Firebase runtime bundle -> prebuilt/firebase-runtime.js
try {
  const esbuild = require('esbuild');
  const fbEntry = path.join(__dirname, '..', 'src', 'lib', 'firebaseRuntimeEntry.ts');
  const prebuiltFbJs = path.join(prebuiltDir, 'firebase-runtime.js');
  if (fs.existsSync(fbEntry)) {
    esbuild.buildSync({
      entryPoints: [fbEntry],
      bundle: true,
      minify: true,
      treeShaking: true,
      legalComments: 'none',
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: prebuiltFbJs,
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
    console.log('[sync-prebuilt] Built deferred prebuilt/firebase-runtime.js');
  }
} catch (err) {
  console.warn('[sync-prebuilt] firebase-runtime esbuild warning:', err && err.message);
}

// 3. Always compile fast, tree-shaken single-file bundle from src/main.tsx -> prebuilt/app.js
try {
  const esbuild = require('esbuild');
  const mainEntry = path.join(__dirname, '..', 'src', 'main.tsx');
  const prebuiltAppJs = path.join(prebuiltDir, 'app.js');

  if (fs.existsSync(mainEntry)) {
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
        'import.meta.env.VITE_SUPABASE_URL': '""',
        'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
        'import.meta.env': JSON.stringify({
          MODE: 'production',
          PROD: true,
          DEV: false,
          SSR: false,
          VITE_SUPABASE_URL: '',
          VITE_SUPABASE_ANON_KEY: ''
        })
      }
    });
    fs.copyFileSync(prebuiltAppJs, path.join(prebuiltDir, 'bundle.js'));
    console.log('[sync-prebuilt] Built self-contained prebuilt/bundle.js & prebuilt/app.js');
  }
} catch (err) {
  console.warn('[sync-prebuilt] app esbuild warning:', err && err.message);
}

// 4. Write clean index.html, prebuilt/index.html, and dist/index.html with instant zero-blank-screen UI shell
const rootIndexHtml = path.join(__dirname, '..', 'index.html');
const prebuiltIndexHtml = path.join(prebuiltDir, 'index.html');
const distIndexHtml = path.join(distDir, 'index.html');
const prebuiltAppJsPath = path.join(prebuiltDir, 'app.js');
const versionTag = fs.existsSync(prebuiltAppJsPath)
  ? Math.floor(fs.statSync(prebuiltAppJsPath).mtimeMs).toString(36)
  : 'v' + Math.floor(Date.now() / 1000).toString(36);

const cleanHtml = `<!doctype html>
<html lang="en" style="background-color: #080c14; color: #f1f5f9;">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preload" href="/prebuilt/bundle.css?v=${versionTag}" as="style" />
    <link rel="modulepreload" href="/prebuilt/bundle.js?v=${versionTag}" />
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
      @keyframes vsPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
      @keyframes vsSpin { to { transform: rotate(360deg); } }
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
    <link rel="stylesheet" href="/prebuilt/bundle.css?v=${versionTag}" />
  </head>
  <body style="background-color: #080c14; color: #f1f5f9; margin: 0; min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div id="root">
      <div style="min-height: 100vh; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.12), transparent 55%), #080c14;">
        <header style="height: 64px; border-bottom: 1px solid rgba(30, 41, 59, 0.85); background: rgba(11, 17, 30, 0.9); display: flex; align-items: center; justify-content: space-between; padding: 0 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #06b6d4, #3b82f6); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: #ffffff; box-shadow: 0 0 20px rgba(6, 182, 212, 0.35);">VS</div>
            <div>
              <div style="font-weight: 800; font-size: 15px; letter-spacing: -0.02em; color: #f8fafc;">VisualSky</div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">Cold Outreach &amp; Lead Engine</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; padding: 6px 14px; border-radius: 999px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.25);">
            <span style="width: 12px; height: 12px; border: 2px solid #38bdf8; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: vsSpin 0.7s linear infinite;"></span>
            <span style="font-size: 12px; font-weight: 600; color: #bae6fd;">Workspace Ready...</span>
          </div>
        </header>
        <main style="flex: 1; max-width: 1240px; width: 100%; margin: 0 auto; padding: 32px 24px; box-sizing: border-box;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="height: 108px; border-radius: 16px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(30, 41, 59, 0.8); padding: 20px; box-sizing: border-box; animation: vsPulse 1.6s ease-in-out infinite;">
              <div style="width: 42%; height: 10px; border-radius: 6px; background: rgba(56, 189, 248, 0.25); margin-bottom: 14px;"></div>
              <div style="width: 65%; height: 24px; border-radius: 8px; background: rgba(148, 163, 184, 0.2);"></div>
            </div>
            <div style="height: 108px; border-radius: 16px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(30, 41, 59, 0.8); padding: 20px; box-sizing: border-box; animation: vsPulse 1.6s ease-in-out 0.15s infinite;">
              <div style="width: 48%; height: 10px; border-radius: 6px; background: rgba(168, 85, 247, 0.25); margin-bottom: 14px;"></div>
              <div style="width: 58%; height: 24px; border-radius: 8px; background: rgba(148, 163, 184, 0.2);"></div>
            </div>
            <div style="height: 108px; border-radius: 16px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(30, 41, 59, 0.8); padding: 20px; box-sizing: border-box; animation: vsPulse 1.6s ease-in-out 0.3s infinite;">
              <div style="width: 40%; height: 10px; border-radius: 6px; background: rgba(16, 185, 129, 0.25); margin-bottom: 14px;"></div>
              <div style="width: 60%; height: 24px; border-radius: 8px; background: rgba(148, 163, 184, 0.2);"></div>
            </div>
          </div>
          <div style="height: 320px; border-radius: 20px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(30, 41, 59, 0.75); padding: 28px; box-sizing: border-box; animation: vsPulse 1.8s ease-in-out infinite;">
            <div style="width: 30%; height: 16px; border-radius: 8px; background: rgba(148, 163, 184, 0.22); margin-bottom: 20px;"></div>
            <div style="width: 100%; height: 180px; border-radius: 12px; background: rgba(30, 41, 59, 0.4);"></div>
          </div>
        </main>
      </div>
    </div>
    <script type="module" src="/prebuilt/bundle.js?v=${versionTag}"></script>
  </body>
</html>
`;

fs.writeFileSync(rootIndexHtml, cleanHtml, 'utf8');
fs.writeFileSync(prebuiltIndexHtml, cleanHtml, 'utf8');
try {
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(distIndexHtml, cleanHtml, 'utf8');
    const distPrebuiltDir = path.join(distDir, 'prebuilt');
    fs.mkdirSync(distPrebuiltDir, { recursive: true });
    if (fs.existsSync(path.join(prebuiltDir, 'app.js'))) {
      fs.copyFileSync(path.join(prebuiltDir, 'app.js'), path.join(distPrebuiltDir, 'app.js'));
      fs.copyFileSync(path.join(prebuiltDir, 'app.js'), path.join(distPrebuiltDir, 'bundle.js'));
    }
    if (fs.existsSync(path.join(prebuiltDir, 'firebase-runtime.js'))) {
      fs.copyFileSync(
        path.join(prebuiltDir, 'firebase-runtime.js'),
        path.join(distPrebuiltDir, 'firebase-runtime.js')
      );
    }
    if (fs.existsSync(path.join(prebuiltDir, 'app.css'))) {
      fs.copyFileSync(path.join(prebuiltDir, 'app.css'), path.join(distPrebuiltDir, 'app.css'));
      fs.copyFileSync(path.join(prebuiltDir, 'app.css'), path.join(distPrebuiltDir, 'bundle.css'));
    }
  }
  const publicSwPath = path.join(__dirname, '..', 'public', 'sw.js');
  if (fs.existsSync(publicSwPath)) {
    fs.copyFileSync(publicSwPath, path.join(prebuiltDir, 'sw.js'));
    if (fs.existsSync(distDir)) {
      fs.copyFileSync(publicSwPath, path.join(distDir, 'sw.js'));
    }
  }
} catch {}
console.log('[sync-prebuilt] Wrote clean index.html, prebuilt/index.html & dist/index.html with instant UI shell');

// 5. Always compile latest server.ts -> prebuilt/server.cjs using esbuild
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
