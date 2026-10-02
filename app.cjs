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

// Auto-heal cPanel Git repository locks and clean .git/config across all project directories so "Update from Remote" in cPanel never fails
function healSingleGitDir(gitDir) {
  try {
    if (!fs.existsSync(gitDir)) return;

    // 0. Ensure required Git subdirectories and HEAD exist so cPanel never says "not a git repository"
    const requiredDirs = [
      path.join(gitDir, 'objects'),
      path.join(gitDir, 'refs', 'heads'),
      path.join(gitDir, 'refs', 'tags'),
      path.join(gitDir, 'refs', 'remotes', 'origin')
    ];
    for (const d of requiredDirs) {
      if (!fs.existsSync(d)) {
        try {
          fs.mkdirSync(d, { recursive: true });
        } catch (_e) {}
      }
    }
    const headFile = path.join(gitDir, 'HEAD');
    if (!fs.existsSync(headFile)) {
      try {
        fs.writeFileSync(headFile, 'ref: refs/heads/main\n', 'utf8');
      } catch (_e) {}
    }

    // 1. Remove stale .git lock files that block cPanel Git Version Control
    const lockFiles = [
      path.join(gitDir, 'index.lock'),
      path.join(gitDir, 'HEAD.lock'),
      path.join(gitDir, 'FETCH_HEAD.lock'),
      path.join(gitDir, 'ORIG_HEAD.lock'),
      path.join(gitDir, 'config.lock'),
      path.join(gitDir, 'packed-refs.lock'),
      path.join(gitDir, 'refs', 'remotes', 'origin', 'main.lock'),
      path.join(gitDir, 'refs', 'remotes', 'origin', 'HEAD.lock'),
      path.join(gitDir, 'refs', 'heads', 'main.lock')
    ];
    for (const lockFile of lockFiles) {
      if (fs.existsSync(lockFile)) {
        try {
          fs.unlinkSync(lockFile);
          console.log('[Git Auto-Heal] Removed lock file:', lockFile);
        } catch (_e) {}
      }
    }

    // 2. Clean or reconstruct .git/config (strip any [http] postBuffer/version overrides that trigger cPanel LVE OOM)
    const DEFAULT_REMOTE_URL = 'https://github.com/shamssumon3836/Visual-Sky.git';
    const gitConfigPath = path.join(gitDir, 'config');
    if (fs.existsSync(gitConfigPath)) {
      let cfg = fs.readFileSync(gitConfigPath, 'utf8');
      let cleanedCfg = cfg
        .replace(/\n?\[http\][^\[]*/g, '')
        .replace(/\n?\[pack\][^\[]*/g, '')
        .trimEnd() + '\n';
      if (!cleanedCfg.includes('[remote "origin"]')) {
        cleanedCfg += `[remote "origin"]\n\turl = ${DEFAULT_REMOTE_URL}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`;
      }
      if (!cleanedCfg.includes('[branch "main"]')) {
        cleanedCfg += `[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n`;
      }
      if (cleanedCfg !== cfg) {
        fs.writeFileSync(gitConfigPath, cleanedCfg, 'utf8');
        console.log('[Git Auto-Heal] Repaired .git/config in', gitDir);
      }
    } else {
      const restoredConfig = `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n[remote "origin"]\n\turl = ${DEFAULT_REMOTE_URL}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main\n`;
      fs.writeFileSync(gitConfigPath, restoredConfig, 'utf8');
      console.log('[Git Auto-Heal] Reconstructed missing .git/config in', gitDir);
    }
  } catch (_err) {}
}

function healCpanelGitRepo() {
  const candidateRoots = new Set([
    __dirname,
    process.cwd(),
    '/home/visualsk/cold.visualsky.pro',
    '/home/visualsk/git-coldmail'
  ]);
  for (const root of candidateRoots) {
    healSingleGitDir(path.join(root, '.git'));
    const pbDir = path.join(root, 'prebuilt');
    try {
      if (fs.existsSync(pbDir)) {
        for (const f of fs.readdirSync(pbDir)) {
          if (f.endsWith('.br') || f.endsWith('.gz')) {
            try {
              fs.unlinkSync(path.join(pbDir, f));
            } catch (_e) {}
          }
        }
      }
    } catch (_e) {}
  }
}

try {
  const timer = setInterval(healCpanelGitRepo, 30000);
  if (timer && typeof timer.unref === 'function') timer.unref();
} catch (_e) {}

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
  const primaryBundle = fs.existsSync(prebuiltServer) ? prebuiltServer : candidates[0];
  console.log('[Bootstrap] Starting server bundle:', primaryBundle);
  require(primaryBundle);
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
