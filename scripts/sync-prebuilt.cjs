const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const prebuiltDir = path.join(rootDir, 'prebuilt');
const rootAssetsDir = path.join(rootDir, 'assets');

if (!fs.existsSync(distDir)) {
  console.error('[sync-prebuilt] dist directory not found.');
  process.exit(1);
}

// 1. Copy full dist/ to prebuilt/
fs.cpSync(distDir, prebuiltDir, { recursive: true, force: true });

// Verify that esbuild frontend bundler (used by app.cjs on cPanel) compiles src/main.tsx cleanly
const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: [path.join(rootDir, 'src', 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  outfile: path.join(prebuiltDir, 'app.js'),
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

// 2. Copy dist/assets/ to root assets/ so LiteSpeed/Apache can serve /assets/* directly from DocumentRoot
if (fs.existsSync(distAssetsDir)) {
  fs.cpSync(distAssetsDir, rootAssetsDir, { recursive: true, force: true });

  const files = fs.readdirSync(distAssetsDir);
  const jsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
  const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));

  if (jsFile) {
    fs.copyFileSync(
      path.join(distAssetsDir, jsFile),
      path.join(prebuiltDir, 'app.js')
    );
  }
  if (cssFile) {
    fs.copyFileSync(
      path.join(distAssetsDir, cssFile),
      path.join(prebuiltDir, 'app.css')
    );
  }
}

console.log('[sync-prebuilt] Successfully synced production bundle to /prebuilt and /assets.');
