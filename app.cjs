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
const dataDir = path.join(__dirname, '.data');
const distServer = path.join(distDir, 'server.cjs');
const prebuiltServer = path.join(prebuiltDir, 'server.cjs');
const runtimeServer = path.join(dataDir, 'server.runtime.cjs');
const runtimeAppJs = path.join(dataDir, 'runtime-app.js');
const prebuiltAppCss = path.join(prebuiltDir, 'app.css');

// Auto-heal cPanel Git repository locks and HTTP/1.1 config so "Update from Remote" in cPanel never fails
function healCpanelGitRepo() {
  try {
    const gitDir = path.join(__dirname, '.git');
    if (!fs.existsSync(gitDir)) return;

    // 1. Remove stale .git lock files that block cPanel Git Version Control
    const lockFiles = [
      path.join(gitDir, 'index.lock'),
      path.join(gitDir, 'HEAD.lock'),
      path.join(gitDir, 'config.lock'),
      path.join(gitDir, 'packed-refs.lock'),
      path.join(gitDir, 'refs', 'remotes', 'origin', 'main.lock'),
      path.join(gitDir, 'refs', 'heads', 'main.lock')
    ];
    for (const lockFile of lockFiles) {
      if (fs.existsSync(lockFile)) {
        try {
          const stat = fs.statSync(lockFile);
          if (Date.now() - stat.mtimeMs > 15000) {
            fs.unlinkSync(lockFile);
            console.log('[Git Auto-Heal] Removed stale lock file:', lockFile);
          }
        } catch (_e) {}
      }
    }

    // 2. Ensure .git/config has cPanel/CloudLinux safe HTTP settings so GitHub remote connection does not fail
    const gitConfigPath = path.join(gitDir, 'config');
    if (fs.existsSync(gitConfigPath)) {
      let cfg = fs.readFileSync(gitConfigPath, 'utf8');
      if (!cfg.includes('[http]')) {
        cfg +=
          '\n[http]\n\tversion = HTTP/1.1\n\tpostBuffer = 524288000\n\tlowSpeedLimit = 0\n\tlowSpeedTime = 999999\n';
        fs.writeFileSync(gitConfigPath, cfg, 'utf8');
        console.log('[Git Auto-Heal] Configured HTTP/1.1 and buffer settings in .git/config');
      }
    }
  } catch (_err) {}
}

function buildWithEsbuild() {
  try {
    if (fs.existsSync(runtimeAppJs)) fs.unlinkSync(runtimeAppJs);
  } catch (_e) {}
  try {
    if (fs.existsSync(runtimeServer)) fs.unlinkSync(runtimeServer);
  } catch (_e) {}

  const esbuild = require('esbuild');
  fs.mkdirSync(dataDir, { recursive: true });

  // 1. Always compile latest src/main.tsx -> untracked .data/runtime-app.js so git pulls take effect immediately without dirtying tracked Git files
  const mainEntry = path.join(__dirname, 'src', 'main.tsx');
  if (fs.existsSync(mainEntry)) {
    esbuild.buildSync({
      entryPoints: [mainEntry],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: runtimeAppJs,
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

    if (fs.existsSync(prebuiltAppCss) && fs.existsSync(runtimeAppJs)) {
      const extraPopupCss =
        '\n.vs-auth-popup-window{width:100%!important;max-width:420px!important;max-height:88vh!important;overflow-y:auto!important;margin:auto!important;border-radius:16px!important;}.vs-legal-popup-window{width:100%!important;max-width:460px!important;max-height:82vh!important;margin:auto!important;border-radius:16px!important;}\n';
      const cssContent = fs.readFileSync(prebuiltAppCss, 'utf8') + extraPopupCss;
      const jsContent = fs.readFileSync(runtimeAppJs, 'utf8');
      if (!jsContent.includes('vs-tailwind-inline')) {
        const styleInjector = `(function(){if(typeof document!=='undefined'&&!document.getElementById('vs-tailwind-inline')){var s=document.createElement('style');s.id='vs-tailwind-inline';s.textContent=${JSON.stringify(
          cssContent
        )};document.head.appendChild(s);}})();\n`;
        fs.writeFileSync(runtimeAppJs, styleInjector + jsContent, 'utf8');
      }
    }
  }

  // 2. Always compile latest server.ts -> untracked .data/server.runtime.cjs so tracked Git files stay 100% clean
  const serverEntry = path.join(__dirname, 'server.ts');
  if (fs.existsSync(serverEntry)) {
    esbuild.buildSync({
      entryPoints: [serverEntry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      outfile: runtimeServer
    });
  }
}

// Heal git locks/dirty build files and start prebuilt server immediately (only run esbuild if prebuilt is missing)
try {
  healCpanelGitRepo();
  const prebuiltAppJs = path.join(prebuiltDir, 'app.js');
  // Remove stale runtime overrides so prebuilt/app.js and prebuilt/server.cjs take effect immediately
  try {
    if (fs.existsSync(runtimeAppJs)) fs.unlinkSync(runtimeAppJs);
  } catch (_e) {}
  try {
    if (fs.existsSync(runtimeServer)) fs.unlinkSync(runtimeServer);
  } catch (_e) {}

  if (!fs.existsSync(prebuiltServer) || !fs.existsSync(prebuiltAppJs)) {
    console.log('[Bootstrap] Prebuilt bundle missing, compiling runtime server...');
    buildWithEsbuild();
    console.log('[Bootstrap] Runtime compilation complete.');
  }
} catch (buildErr) {
  console.error('[Bootstrap] Build error:', buildErr);
  process.env.BOOTSTRAP_BUILD_ERROR = String(
    buildErr && buildErr.stack ? buildErr.stack : buildErr
  );
}

try {
  const candidates = [prebuiltServer, runtimeServer, distServer].filter((p) => fs.existsSync(p));
  if (candidates.length === 0) {
    throw new Error('Neither prebuilt/server.cjs, runtimeServer, nor dist/server.cjs exists.');
  }
  candidates.sort((a, b) => {
    try {
      return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
    } catch (_e) {
      return 0;
    }
  });
  console.log('[Bootstrap] Starting newest server bundle:', candidates[0]);
  require(candidates[0]);
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
