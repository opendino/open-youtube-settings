import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
// Unpacked builds stay next to the zips so they can be loaded with
// "Load unpacked" / about:debugging and never drift from the zipped package.
const CHROME_DIR = path.join(DIST_DIR, 'chrome-youtube-settings');
const FIREFOX_DIR = path.join(DIST_DIR, 'firefox-youtube-settings');

// Files and folders to package
const FILES_TO_COPY = [
  'page-bridge.js',
  'content.js',
  'ui-overlay.js',
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
 * @param {string} targetDir - Where the unpacked extension is written.
 * @param {boolean} isChrome - Build the Chrome flavour of the manifest.
 * @param {object} [manifestOverrides] - Extra manifest keys (tests pin the
 *   extension ID with a `key`).
 */
export function prepareDirectory(targetDir, isChrome = false, manifestOverrides = {}) {
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
        // world: "MAIN" content scripts (page-bridge.js) need Firefox 128+.
        manifest.browser_specific_settings.gecko = {
          id: gecko.id || 'yt-visual-adjuster@example.com',
          strict_min_version: gecko.strict_min_version || '128.0',
          // Firefox requires a data-collection declaration; this add-on collects nothing.
          data_collection_permissions: gecko.data_collection_permissions || { required: ['none'] }
        };
      }
      console.log('[Packager] Configured Gecko IDs for Firefox package.');
    }

    Object.assign(manifest, manifestOverrides);

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

    console.log('\n[Packager] Bundling finished successfully! Production packages are located in:');
    console.log(`- dist/chrome-youtube-settings.zip (unpacked: dist/chrome-youtube-settings/)`);
    console.log(`- dist/firefox-youtube-settings.zip (unpacked: dist/firefox-youtube-settings/)\n`);

  } catch (error) {
    console.error('[Packager] Bundling failed with errors:', error);
    process.exit(1);
  }
}

// Only package when run directly; the test suite imports prepareDirectory.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
