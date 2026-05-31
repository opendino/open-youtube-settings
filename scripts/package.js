import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CHROME_DIR = path.join(DIST_DIR, 'chrome-temp');
const FIREFOX_DIR = path.join(DIST_DIR, 'firefox-temp');

// Files and folders to package
const FILES_TO_COPY = [
  'content.js',
  'popup.js',
  'popup.html',
  'popup.css',
  'icon.png',
  'icon_16.png',
  'icon_32.png',
  'icon_48.png',
  'icon_96.png',
  'icon_128.png'
];

const DIRS_TO_COPY = [
  '_locales',
  'icon'
];

/**
 * Recursively copies a directory to a target path.
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Standardizes files copy and directory creation.
 */
function prepareDirectory(targetDir, isChrome = false) {
  console.log(`[Packager] Preparing build directory: ${path.relative(ROOT_DIR, targetDir)}...`);
  
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy files
  for (const file of FILES_TO_COPY) {
    const srcPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(targetDir, file));
    }
  }

  // Copy directories
  for (const dir of DIRS_TO_COPY) {
    const srcPath = path.join(ROOT_DIR, dir);
    if (fs.existsSync(srcPath)) {
      copyDirSync(srcPath, path.join(targetDir, dir));
    }
  }

  // Handle manifest modifications
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);

    if (isChrome) {
      // Remove Firefox specific settings for Chrome to avoid Developer Console warnings
      delete manifest.browser_specific_settings;
      console.log('[Packager] Removed browser_specific_settings for Google Chrome package.');
    } else {
      // Firefox specific cleanup
      if (manifest.browser_specific_settings && manifest.browser_specific_settings.gecko) {
        // Clean any non-standard Gecko keys
        const gecko = manifest.browser_specific_settings.gecko;
        manifest.browser_specific_settings.gecko = {
          id: gecko.id || 'yt-visual-adjuster@example.com'
        };
      }
      console.log('[Packager] Configured Gecko IDs for Firefox package.');
    }

    fs.writeFileSync(
      path.join(targetDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }
}

/**
 * Compresses a target directory using native macOS zip.
 */
function zipDirectory(sourceDir, zipFileName) {
  const targetZipPath = path.join(DIST_DIR, zipFileName);
  if (fs.existsSync(targetZipPath)) {
    fs.unlinkSync(targetZipPath);
  }

  console.log(`[Packager] Packaging zip: dist/${zipFileName}...`);
  
  try {
    // Run native zip command from within the target directory to ensure files are at root level
    execSync(`cd "${sourceDir}" && zip -r "${targetZipPath}" . -x "*.DS_Store"`, { stdio: 'inherit' });
    console.log(`[Packager] Successfully generated: dist/${zipFileName}`);
  } catch (error) {
    console.error(`[Packager] Failed to package ${zipFileName}:`, error);
    throw error;
  }
}

function main() {
  console.log('[Packager] Starting build and package workflow...');

  // 1. Re-create base dist folder
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
  }

  try {
    // 2. Build and Zip Google Chrome Package
    prepareDirectory(CHROME_DIR, true);
    zipDirectory(CHROME_DIR, 'chrome-youtube-settings.zip');

    // 3. Build and Zip Mozilla Firefox Package
    prepareDirectory(FIREFOX_DIR, false);
    zipDirectory(FIREFOX_DIR, 'firefox-youtube-settings.zip');

    // 4. Clean up temporary directories
    console.log('[Packager] Cleaning up build temporary directories...');
    fs.rmSync(CHROME_DIR, { recursive: true, force: true });
    fs.rmSync(FIREFOX_DIR, { recursive: true, force: true });

    console.log('\n[Packager] Bundling finished successfully! Production packages are located in:');
    console.log(`- dist/chrome-youtube-settings.zip`);
    console.log(`- dist/firefox-youtube-settings.zip\n`);

  } catch (error) {
    console.error('[Packager] Bundling failed with errors:', error);
    process.exit(1);
  }
}

main();
