import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const pkgPath = resolve(rootDir, 'package.json');
const configXmlPath = resolve(rootDir, 'public', 'config.xml');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`[NetTV] Invalid semantic version in package.json: "${version}"`);
  process.exit(1);
}

const xml = readFileSync(configXmlPath, 'utf8');
const updatedXml = xml.replace(
  /(<widget\b[^>]*\bversion=")[^"]*(")/,
  `$1${version}$2`,
);

if (updatedXml === xml) {
  console.log(`[NetTV] config.xml already synchronized at v${version}.`);
} else {
  writeFileSync(configXmlPath, updatedXml, 'utf8');
  console.log(`[NetTV] Synchronized public/config.xml to v${version}.`);
}
