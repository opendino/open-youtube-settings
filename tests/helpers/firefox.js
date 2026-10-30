/**
 * Playwright Test fixtures that run the real Firefox package inside Firefox.
 *
 * Playwright's own Firefox cannot load extensions, so these fixtures drive a
 * Puppeteer-managed Firefox over WebDriver BiDi and install the freshly built
 * package as a temporary add-on, the same as about:debugging does.
 *
 * BiDi cannot see moz-extension:// pages at all, so the test copy of the
 * add-on carries three small helpers (tests/helpers/firefox-addon):
 *   - test-bridge.js, a content script that reads and writes storage and
 *     relays messages for tests running in a youtube.com tab;
 *   - test-background.js, which opens the popup as a tab;
 *   - test-popup-driver.js, appended to popup.html, which clicks, drags and
 *     reads inside the real popup on request.
 * The add-on's own code is untouched.
 *
 * One Firefox runs per worker; every test starts from empty storage.
 */

import { test as base, expect } from '@playwright/test';
import { Browser as BrowserName, getInstalledBrowsers } from '@puppeteer/browsers';
import puppeteer from 'puppeteer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ROOT_DIR, prepareDirectory } from './extension.js';

const FIXTURE_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');
const ADDON_HELPERS = path.join(ROOT_DIR, 'tests', 'helpers', 'firefox-addon');
const CACHE_DIR = path.join(ROOT_DIR, 'node_modules', '.puppeteer-browsers');
const HARNESS_URL = 'https://www.youtube.com/__harness';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.webm': 'video/webm'
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The newest Firefox `npm run test:install` downloaded. */
async function firefoxExecutable() {
  const installed = (await getInstalledBrowsers({ cacheDir: CACHE_DIR })).filter(
    (b) => b.browser === BrowserName.FIREFOX
  );
  if (!installed.length) {
    throw new Error('Firefox is not installed for tests; run `npm run test:install`.');
  }
  installed.sort((a, b) => b.buildId.localeCompare(a.buildId, undefined, { numeric: true }));
  return installed[0].executablePath;
}

/** Builds the Firefox package, then adds the test-only helpers to the copy. */
function buildExtension() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yte-ff-ext-'));
  const log = console.log;
  console.log = () => {};
  try {
    prepareDirectory(dir, false);
  } finally {
    console.log = log;
  }

  for (const file of fs.readdirSync(ADDON_HELPERS)) {
    fs.copyFileSync(path.join(ADDON_HELPERS, file), path.join(dir, file));
  }
  const popupPath = path.join(dir, 'popup.html');
  fs.writeFileSync(
    popupPath,
    fs
      .readFileSync(popupPath, 'utf8')
      .replace('</body>', '  <script src="test-popup-driver.js"></script>\n</body>')
  );

  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.content_scripts.push({
    matches: ['*://*.youtube.com/*'],
    js: ['test-bridge.js'],
    run_at: 'document_start'
  });
  manifest.background = { scripts: ['test-background.js'] };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { dir };
}

/**
 * Answers youtube.com requests from the fixture app and blocks the rest. With
 * `harnessOnly`, only the harness address is answered and real YouTube passes.
 */
async function interceptYoutube(page, { harnessOnly = false } = {}) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const url = new URL(request.url());
    if (url.href.startsWith(HARNESS_URL)) {
      return request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>harness</title>' });
    }
    if (harnessOnly) return request.continue();
    if (!/^([a-z]+\.)?youtube\.com$/.test(url.hostname)) return request.abort();

    const file = url.pathname.startsWith('/__fixture/')
      ? url.pathname.slice('/__fixture/'.length)
      : 'app.html';
    const full = path.join(FIXTURE_DIR, file);
    if (!fs.existsSync(full)) return request.respond({ status: 404, body: 'missing fixture' });
    request.respond({
      status: 200,
      contentType: CONTENT_TYPES[path.extname(full)] || 'application/octet-stream',
      body: fs.readFileSync(full)
    });
  });
}

/** Sends one request through test-bridge.js and waits for its reply. */
async function bridge(page, op, value) {
  const reply = await page.evaluate(
    (op, value) =>
      new Promise((resolve) => {
        const id = Math.random();
        const onReply = (event) => {
          if (event.data && event.data.yteTestReply === id) {
            window.removeEventListener('message', onReply);
            resolve(event.data);
          }
        };
        window.addEventListener('message', onReply);
        window.postMessage({ yteTest: { id, op, value } }, '*');
      }),
    op,
    value === undefined ? null : value
  );
  if (reply.error) throw new Error(`[test-bridge ${op}] ${reply.error}`);
  return reply.result;
}

export const test = base.extend({
  live: [false, { option: true }],

  ffExtension: [
    async ({}, use) => {
      const ext = buildExtension();
      await use(ext);
      fs.rmSync(ext.dir, { recursive: true, force: true });
    },
    { scope: 'worker' }
  ],

  firefox: [
    async ({ ffExtension }, use) => {
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yte-ff-profile-'));
      const browser = await puppeteer.launch({
        browser: 'firefox',
        executablePath: await firefoxExecutable(),
        headless: true,
        userDataDir: profile,
        defaultViewport: { width: 1400, height: 900 },
        extraPrefsFirefox: {
          'media.autoplay.default': 0,
          'media.autoplay.blocking_policy': 0,
          // Live tests play real videos and ads; keep them off the speakers.
          'media.volume_scale': '0.0',
          'intl.accept_languages': 'en-US',
          'browser.download.useDownloadDir': true,
          'browser.download.always_ask_before_handling_new_types': false,
          'browser.download.folderList': 2,
          'browser.download.dir': path.join(profile, 'downloads')
        }
      });
      await browser.installExtension(ffExtension.dir);
      await use({ browser, downloads: path.join(profile, 'downloads') });
      await browser.close();
      fs.rmSync(profile, { recursive: true, force: true });
    },
    { scope: 'worker' }
  ],

  /** Storage access through a youtube.com tab running test-bridge.js. */
  harness: async ({ firefox }, use) => {
    const page = await firefox.browser.newPage();
    await interceptYoutube(page, { harnessOnly: true });
    await page.goto(HARNESS_URL);
    await page.waitForFunction(() => document.readyState === 'complete');
    // The content script may still be starting up right after load.
    for (let i = 0; ; i++) {
      try {
        await Promise.race([bridge(page, 'clear'), sleep(500).then(() => Promise.reject(new Error('no reply')))]);
        break;
      } catch (error) {
        if (i > 20) throw error;
      }
    }
    const harness = {
      page,
      set: (values) => bridge(page, 'set', values),
      get: (keys) => bridge(page, 'get', keys ?? null),
      call: (op, value) => bridge(page, op, value)
    };
    await use(harness);
    await page.close();
  },

  page: async ({ firefox, harness, live }, use) => {
    void harness; // created first, so storage starts empty
    const page = await firefox.browser.newPage();
    if (!live) await interceptYoutube(page);
    await use(page);
    await page.close();
  },

  /**
   * Opens the real popup as a tab and returns a driver for it. Clicks and
   * drags are performed inside the popup by test-popup-driver.js.
   */
  openPopup: async ({ harness }, use) => {
    const tabs = [];
    await use(async () => {
      tabs.push(await harness.call('open', 'popup.html'));
      const send = (action) => harness.call('popup', action);
      for (let i = 0; i < 50; i++) {
        if (await send({ type: 'ready' }).catch(() => false)) break;
        await sleep(100);
      }
      return {
        click: (selector) => send({ type: 'click', selector }),
        slide: (id, value) => send({ type: 'slide', selector: `#${id}`, value }),
        key: (init) => send({ type: 'key', init }),
        read: (selector) => send({ type: 'read', selector })
      };
    });
    for (const tab of tabs) await harness.call('close', tab).catch(() => {});
  }
});

export { expect };

export async function openYoutube(page, route = '/watch?v=fixture1') {
  await page.goto(`https://www.youtube.com${route}`);
  await page.evaluate(() => window.__fx.ready);
  await page.waitForSelector('#yte-dynamic-styles');
  await sleep(150);
}

export async function spaNavigate(page, route, options = {}) {
  await page.evaluate((r, o) => window.__fx.navigate(r, o), route, options);
  await sleep(150);
}

export function styleOf(page, selector, property) {
  return page.evaluate(
    (sel, prop) => {
      const node = document.querySelector(sel);
      return node ? getComputedStyle(node)[prop] : null;
    },
    selector,
    property
  );
}

export function isDisplayed(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return false;
    return node.getClientRects().length > 0 && getComputedStyle(node).display !== 'none';
  }, selector);
}

export function playbackRate(page) {
  return page.evaluate(() => document.querySelector('#movie_player video').playbackRate);
}
