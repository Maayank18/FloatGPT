/**
 * Windows pack that survives OneDrive.
 * electron-builder renames a huge unpack folder. OneDrive locks that rename
 * when it happens inside this repo, so the unpack is written under
 * %LOCALAPPDATA%\FloatGPT-pack. The finished installer is then copied into
 * release/, which is the folder the previous Setup files already live in.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;

const packDir = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'FloatGPT-pack'
);
const releaseDir = path.join(root, 'release');
const builderCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

const packed = spawnSync(
  process.execPath,
  [builderCli, '--win', `-c.directories.output=${packDir.replace(/\\/g, '/')}`],
  { cwd: root, stdio: 'inherit' }
);

if (packed.status !== 0) {
  process.exit(packed.status ?? 1);
}

const artifacts = [
  `FloatGPT Setup ${version}.exe`,
  `FloatGPT Setup ${version}.exe.blockmap`,
  'latest.yml',
];

for (const name of artifacts) {
  const from = path.join(packDir, name);
  if (!fs.existsSync(from)) {
    console.error(`[pack-win] Missing ${name} in ${packDir}`);
    process.exit(1);
  }
  const to = path.join(releaseDir, name);
  fs.copyFileSync(from, to);
  const sizeMb = (fs.statSync(to).size / (1024 * 1024)).toFixed(1);
  console.log(`[pack-win] ${name} is in release/ (${sizeMb} MB)`);
}

const zipped = spawnSync(process.execPath, [path.join(root, 'scripts', 'zip-release.js')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, FLOATGPT_PACK_DIR: packDir },
});

process.exit(zipped.status ?? 1);
