// Puppeteer only drives Firefox for the extension tests (Chromium runs under
// Playwright), and keeps its browser inside node_modules like Playwright does.
const { join } = require('path');

module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.puppeteer-browsers'),
  chrome: { skipDownload: true },
  'chrome-headless-shell': { skipDownload: true },
  firefox: { skipDownload: false }
};
