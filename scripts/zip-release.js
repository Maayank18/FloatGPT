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
const ZIP_NAME = 'FloatGPT_Windows.zip';

function main() {
  console.log('[zip-release] Scanning release directory...');

  if (!fs.existsSync(RELEASE_DIR)) {
    console.error('[zip-release] ERROR: release/ directory not found. Run electron-builder first.');
    process.exit(1);
  }

  // Find the .exe installer (pattern: "FloatGPT Setup *.exe" or "FloatGPT*.exe")
  const files = fs.readdirSync(RELEASE_DIR);
  const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('__uninstaller'));

  if (!exeFile) {
    console.error('[zip-release] ERROR: No .exe installer found in release/');
    process.exit(1);
  }

  const exePath = path.join(RELEASE_DIR, exeFile);
  const zipPath = path.join(RELEASE_DIR, ZIP_NAME);

  // Remove existing zip if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log('[zip-release] Removed existing zip.');
  }

  console.log(`[zip-release] Compressing: ${exeFile}`);

  // Use PowerShell Compress-Archive (available on all modern Windows)
  try {
    execSync(
      `powershell -Command "Compress-Archive -Path '${exePath}' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } catch (e) {
    console.error('[zip-release] PowerShell compression failed, trying tar fallback...');
    // Fallback for non-Windows or older systems
    try {
      execSync(`tar -czf "${zipPath}" -C "${RELEASE_DIR}" "${exeFile}"`, { stdio: 'inherit' });
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
