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

// Read compiled Tailwind v4 CSS produced by Vite build
let compiledCss = '';
if (fs.existsSync(distAssetsDir)) {
  const assetFiles = fs.readdirSync(distAssetsDir);
  const cssAsset = assetFiles.find((f) => f.startsWith('index-') && f.endsWith('.css'));
  if (cssAsset) {
    compiledCss = fs.readFileSync(path.join(distAssetsDir, cssAsset), 'utf8');
  }
}

const cssInjectorBanner = compiledCss
  ? `(function(){if(typeof document!=='undefined'&&!document.getElementById('vs-inline-tw')){var s=document.createElement('style');s.id='vs-inline-tw';s.textContent=${JSON.stringify(compiledCss)};document.head.appendChild(s);}})();`
  : '';

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
  banner: cssInjectorBanner ? { js: cssInjectorBanner } : undefined,
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
  const files = fs.readdirSync(distAssetsDir);
  const jsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
  const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));

  if (jsFile && cssInjectorBanner) {
    const distJsPath = path.join(distAssetsDir, jsFile);
    const existingJs = fs.readFileSync(distJsPath, 'utf8');
    if (!existingJs.includes('vs-inline-tw')) {
      fs.writeFileSync(distJsPath, cssInjectorBanner + '\n' + existingJs, 'utf8');
    }
  }

  fs.cpSync(distAssetsDir, rootAssetsDir, { recursive: true, force: true });
  fs.cpSync(distAssetsDir, path.join(prebuiltDir, 'assets'), { recursive: true, force: true });

  if (jsFile) {
    fs.copyFileSync(
      path.join(distAssetsDir, jsFile),
      path.join(prebuiltDir, 'app.js')
    );
  }
  if (cssFile) {
    const compiledCssPath = path.join(distAssetsDir, cssFile);
    fs.copyFileSync(compiledCssPath, path.join(prebuiltDir, 'app.css'));
    fs.copyFileSync(compiledCssPath, path.join(prebuiltDir, 'tailwind-bundle.css'));
    fs.copyFileSync(compiledCssPath, path.join(rootAssetsDir, 'app.css'));
  }
}

console.log('[sync-prebuilt] Successfully synced production bundle to /prebuilt and /assets.');
