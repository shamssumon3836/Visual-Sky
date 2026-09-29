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
const prebuiltAppJs = path.join(prebuiltDir, 'app.js');
const prebuiltAppCss = path.join(prebuiltDir, 'app.css');

// Auto-heal cPanel Git repository locks, HTTP/1.1 config, and dirty build artifacts so "Update from Remote" in cPanel never fails
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
          // Remove lock file if older than 15 seconds
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

    // 3. Reset any locally modified build artifacts in dist/, prebuilt/, or assets/ so git pull never conflicts
    const { execSync } = require('child_process');
    execSync('git checkout -- dist prebuilt assets 2>/dev/null || true', {
      cwd: __dirname,
      stdio: 'ignore',
      timeout: 5000
    });
  } catch (_err) {}
}

function buildWithEsbuild() {
  const esbuild = require('esbuild');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(prebuiltDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Only rebuild frontend into tracked files if dist/index.html is missing
  const hasDistIndex = fs.existsSync(path.join(distDir, 'index.html'));
  if (!hasDistIndex) {
    const hasFullCss =
      fs.existsSync(prebuiltAppCss) && fs.statSync(prebuiltAppCss).size > 50000;
    if (!hasFullCss) {
      const tailwindBackup = path.join(prebuiltDir, 'tailwind-bundle.css');
      const rootAssetsDir = path.join(__dirname, 'assets');
      if (fs.existsSync(tailwindBackup) && fs.statSync(tailwindBackup).size > 50000) {
        fs.copyFileSync(tailwindBackup, prebuiltAppCss);
      } else if (fs.existsSync(rootAssetsDir)) {
        const cssCandidate = fs
          .readdirSync(rootAssetsDir)
          .find((f) => f.endsWith('.css') && fs.statSync(path.join(rootAssetsDir, f)).size > 50000);
        if (cssCandidate) {
          fs.copyFileSync(path.join(rootAssetsDir, cssCandidate), prebuiltAppCss);
        }
      }
    }

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
    }
  }

  // Compile latest server.ts -> untracked .data/server.runtime.cjs so tracked Git files stay 100% clean
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

// Heal git locks/dirty build files and compile runtime server on startup
try {
  healCpanelGitRepo();
  console.log('[Bootstrap] Preparing runtime server...');
  buildWithEsbuild();
  console.log('[Bootstrap] Runtime compilation complete.');
} catch (buildErr) {
  console.error('[Bootstrap] Build error:', buildErr);
  process.env.BOOTSTRAP_BUILD_ERROR = String(
    buildErr && buildErr.stack ? buildErr.stack : buildErr
  );
}

try {
  if (fs.existsSync(runtimeServer)) {
    require(runtimeServer);
  } else if (fs.existsSync(distServer)) {
    require(distServer);
  } else if (fs.existsSync(prebuiltServer)) {
    require(prebuiltServer);
  } else {
    throw new Error('Neither runtimeServer, dist/server.cjs, nor prebuilt/server.cjs exists.');
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
