const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distAssets = path.join(distDir, 'assets');
const prebuiltDir = path.join(__dirname, '..', 'prebuilt');
const rootAssetsDir = path.join(__dirname, '..', 'assets');

fs.mkdirSync(prebuiltDir, { recursive: true });
fs.mkdirSync(rootAssetsDir, { recursive: true });

// Clean up stale hashed index-* files in prebuilt/ and assets/ so old builds don't accumulate
for (const dir of [prebuiltDir, rootAssetsDir]) {
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('index-') && (f.endsWith('.js') || f.endsWith('.css'))) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {}
      }
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

  // Copy current hashed assets to root /assets/
  for (const file of files) {
    fs.copyFileSync(path.join(distAssets, file), path.join(rootAssetsDir, file));
  }
  console.log('[sync-prebuilt] Synced dist/assets/* -> assets/*');
}

