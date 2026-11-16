import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const distDir = resolve(rootDir, 'dist');
const outDir = resolve(rootDir, 'dist-wgt');

console.log('[NetTV] Building web app for Tizen (chrome >= 56)...');
execSync('npm run build', { stdio: 'inherit' });

if (!existsSync(resolve(distDir, 'config.xml'))) {
  console.error('[NetTV] Error: dist/config.xml not found after build.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

function resolveTizenCli() {
  if (process.env.TIZEN_CLI && existsSync(process.env.TIZEN_CLI)) {
    return process.env.TIZEN_CLI;
  }

  try {
    execSync('tizen version', { stdio: 'ignore' });
    return 'tizen';
  } catch {
    const winDefault = 'C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat';
    if (process.platform === 'win32' && existsSync(winDefault)) {
      return winDefault;
    }
    return null;
  }
}

const tizenCli = resolveTizenCli();

if (!tizenCli) {
  console.warn(
    '[NetTV] Warning: "tizen" CLI not found in PATH or C:\\tizen-studio.\n' +
    'Web bundle is ready in ./dist (with config.xml and icon.png).\n' +
    'To generate the signed .wgt package, install Tizen Studio CLI and run:\n' +
    '  tizen package -t wgt -s <CERTIFICATE_PROFILE> -o dist-wgt -- dist',
  );
  process.exit(0);
}

const args = ['package', '-t', 'wgt'];
const certProfile = process.env.TIZEN_CERT_PROFILE;
if (certProfile) {
  args.push('-s', certProfile);
}
args.push('-o', outDir, '--', distDir);

console.log(`[NetTV] Packaging .wgt via "${tizenCli}"...`);
execFileSync(tizenCli, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log(`[NetTV] Package generated in ${outDir}`);
