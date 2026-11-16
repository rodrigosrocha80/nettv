import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');
const distWgtDir = resolve(rootDir, 'dist-wgt');
const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));

let hasError = false;
function fail(msg) {
  console.error(`[verify:pkg] FAIL: ${msg}`);
  hasError = true;
}

if (!existsSync(distDir)) {
  fail('dist/ directory not found. Run "npm run build" first.');
  process.exit(1);
}

const requiredFiles = ['index.html', 'config.xml', 'icon.png'];
for (const file of requiredFiles) {
  const fullPath = resolve(distDir, file);
  if (!existsSync(fullPath)) {
    fail(`Missing required file in dist/: ${file}`);
  }
}

const configXmlPath = resolve(distDir, 'config.xml');
if (existsSync(configXmlPath)) {
  const xml = readFileSync(configXmlPath, 'utf8');
  const versionMatch = /<widget\b[^>]*\bversion="([^"]+)"/.exec(xml);
  const xmlVersion = versionMatch?.[1];
  if (xmlVersion !== pkg.version) {
    fail(`Version mismatch: package.json=${pkg.version}, dist/config.xml=${xmlVersion}`);
  }

  const requiredPrivileges = [
    'http://tizen.org/privilege/internet',
    'http://tizen.org/privilege/tv.inputdevice',
    'http://developer.samsung.com/privilege/avplay',
  ];
  for (const priv of requiredPrivileges) {
    if (!xml.includes(priv)) {
      fail(`Missing required Tizen privilege in config.xml: ${priv}`);
    }
  }
}

let totalBytes = 0;
let sourceMapCount = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else {
      totalBytes += st.size;
      if (entry.endsWith('.map')) {
        sourceMapCount++;
      }
    }
  }
}

walk(distDir);

if (sourceMapCount > 0) {
  fail(`Found ${sourceMapCount} public .map sourcemap file(s) in dist/.`);
}

const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`[verify:pkg] dist/ size: ${totalMb} MB | version: ${pkg.version}`);

if (existsSync(distWgtDir)) {
  const wgtFiles = readdirSync(distWgtDir).filter((f) => f.endsWith('.wgt'));
  if (wgtFiles.length > 0) {
    for (const f of wgtFiles) {
      const sizeKb = (statSync(resolve(distWgtDir, f)).size / 1024).toFixed(1);
      console.log(`[verify:pkg] .wgt artifact: ${f} (${sizeKb} KB)`);
    }
  }
}

if (hasError) {
  process.exit(1);
}
console.log('[verify:pkg] PASS: Package verification succeeded.');
