/**
 * ZIP Release Script
 * Automatically compresses the Windows installer into a .zip after electron-builder finishes.
 * Uses PowerShell's Compress-Archive — zero new dependencies.
 * 
 * Usage: node scripts/zip-release.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RELEASE_DIR = path.join(__dirname, '..', 'release');
const SOURCE_DIR = process.env.FLOATGPT_PACK_DIR || RELEASE_DIR;
const ZIP_NAME = 'FloatGPT_Windows.zip';

function main() {
  console.log('[zip-release] Scanning release directory...');

  if (!fs.existsSync(RELEASE_DIR)) {
    console.error('[zip-release] ERROR: release/ directory not found. Run electron-builder first.');
    process.exit(1);
  }

  // Read version from package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  const expectedExeName = `FloatGPT Setup ${version}.exe`;

  // The installer in release/ can be locked by OneDrive the moment it is copied.
  // The pack folder outside OneDrive is the readable source when it is set.
  const files = fs.readdirSync(SOURCE_DIR);
  const exeFile = files.find(f => f === expectedExeName);

  if (!exeFile) {
    console.error(`[zip-release] ERROR: Could not find ${expectedExeName} in ${SOURCE_DIR}`);
    process.exit(1);
  }

  const exePath = path.join(SOURCE_DIR, exeFile);
  const zipPath = path.join(RELEASE_DIR, ZIP_NAME);

  // Remove existing zip if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log('[zip-release] Removed existing zip.');
  }

  console.log(`[zip-release] Compressing: ${exeFile}`);

  // OneDrive can briefly lock a new file in release/. Retry, then fall back to tar.
  let zipped = false;
  for (let attempt = 1; attempt <= 4 && !zipped; attempt++) {
    try {
      execSync(
        `powershell -Command "Compress-Archive -Path '${exePath}' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
      zipped = fs.existsSync(zipPath);
    } catch (e) {
      console.error(`[zip-release] Compression attempt ${attempt} failed.`);
      if (attempt < 4) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4000);
    }
  }
  if (!zipped) {
    console.error('[zip-release] PowerShell compression failed, trying tar fallback...');
    try {
      execSync(`tar -a -cf "${zipPath}" -C "${SOURCE_DIR}" "${exeFile}"`, { stdio: 'inherit' });
    } catch (e2) {
      console.error('[zip-release] All compression methods failed.');
      process.exit(1);
    }
  }

  // Verify
  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`[zip-release] SUCCESS: ${ZIP_NAME} (${sizeMB} MB)`);
  } else {
    console.error('[zip-release] ERROR: Zip file was not created.');
    process.exit(1);
  }
}

main();
