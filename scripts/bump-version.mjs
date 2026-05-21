import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+/.test(newVersion)) {
  console.error('Usage: npm run version -- <semver>');
  console.error('Example: npm run version -- 1.0.1');
  process.exit(1);
}

// 1. package.json
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`  updated package.json  => ${newVersion}`);

// 2. tauri.conf.json
const tauriPath = resolve(root, 'src-tauri/tauri.conf.json');
const tauri = JSON.parse(readFileSync(tauriPath, 'utf-8'));
tauri.version = newVersion;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
console.log(`  updated tauri.conf.json => ${newVersion}`);

// 3. Cargo.toml
const cargoPath = resolve(root, 'src-tauri/Cargo.toml');
let cargo = readFileSync(cargoPath, 'utf-8');
cargo = cargo.replace(/^version\s*=\s*".*?"/m, `version = "${newVersion}"`);
writeFileSync(cargoPath, cargo);
console.log(`  updated Cargo.toml     => ${newVersion}`);

// 4. Create git commit + tag
execSync(`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`, { cwd: root });
execSync(`git commit -m "chore: bump version to v${newVersion}"`, { cwd: root });
execSync(`git tag v${newVersion}`, { cwd: root });

console.log(`\nDone! Created commit and tag v${newVersion}`);
console.log(`Run: git push origin dev && git push origin v${newVersion}`);
