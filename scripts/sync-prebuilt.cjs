const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distAssets = path.join(distDir, 'assets');
const prebuiltDir = path.join(__dirname, '..', 'prebuilt');
const rootAssetsDir = path.join(__dirname, '..', 'assets');

fs.mkdirSync(prebuiltDir, { recursive: true });
fs.mkdirSync(rootAssetsDir, { recursive: true });

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

  let compiledCssContent = '';

  if (cssFile) {
    const cssPath = path.join(distAssets, cssFile);
    compiledCssContent = fs.readFileSync(cssPath, 'utf8');
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
    let jsContent = fs.readFileSync(jsPath, 'utf8');

    // Inject self-healing inline Tailwind CSS into the JS bundle so styles never break
    if (compiledCssContent && !jsContent.includes('vs-tailwind-inline')) {
      const styleInjector = `(function(){if(typeof document!=='undefined'&&!document.getElementById('vs-tailwind-inline')){var s=document.createElement('style');s.id='vs-tailwind-inline';s.textContent=${JSON.stringify(
        compiledCssContent
      )};document.head.appendChild(s);}})();\n`;
      jsContent = styleInjector + jsContent;
      fs.writeFileSync(jsPath, jsContent, 'utf8');
    }

    fs.writeFileSync(path.join(prebuiltDir, 'app.js'), jsContent, 'utf8');
    console.log(
      '[sync-prebuilt] Synced',
      jsFile,
      '-> prebuilt/app.js (with inline Tailwind CSS fallback)'
    );
  }

  // Copy all hashed assets to root /assets/
  for (const file of files) {
    fs.copyFileSync(path.join(distAssets, file), path.join(rootAssetsDir, file));
  }
  console.log('[sync-prebuilt] Synced dist/assets/* -> assets/*');
}

const distIndex = path.join(distDir, 'index.html');
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, path.join(prebuiltDir, 'index.html'));
  console.log('[sync-prebuilt] Copied dist/index.html -> prebuilt/index.html');
}
