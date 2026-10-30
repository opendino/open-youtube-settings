/**
 * Playwright fixtures that run the real extension inside Playwright's Chromium.
 *
 * Every worker builds a fresh copy of the extension with the same packager the
 * release uses, pins its ID with a throwaway manifest `key`, and launches a
 * clean browser profile with it loaded. Fixture tests answer every
 * youtube.com request from `tests/fixtures`, so content scripts inject for
 * real while no network is touched; live tests let youtube.com through.
 */

import { test as base, expect, chromium } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');

// YTE_SOURCE_DIR points the suite at another checkout (say, an older commit)
// to confirm a test really catches the bug it was written for.
const SOURCE_DIR = process.env.YTE_SOURCE_DIR ? path.resolve(process.env.YTE_SOURCE_DIR) : ROOT_DIR;
export const { prepareDirectory } = await import(
  pathToFileURL(path.join(SOURCE_DIR, 'scripts', 'package.js')).href
);
const FIXTURE_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');

/** Chromium derives an unpacked extension's ID from the manifest key. */
function extensionIdentity() {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('sha256').update(der).digest('hex').slice(0, 32);
  const id = [...hash].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  return { key: der.toString('base64'), id };
}

/** Builds the Chrome flavour of the extension into a private directory. */
function buildExtension() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yte-ext-'));
  const { key, id } = extensionIdentity();
  const log = console.log;
  console.log = () => {};
  try {
    prepareDirectory(dir, true, { key });
  } finally {
    console.log = log;
  }
  // Blank extension page the tests use to read and seed storage.
  fs.writeFileSync(path.join(dir, 'test-harness.html'), '<!doctype html><title>harness</title>');
  return { dir, id };
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.webm': 'video/webm'
};

/** Maps a youtube.com URL onto a fixture page. */
function fixtureFor(url) {
  const { pathname } = new URL(url);
  if (pathname.startsWith('/__fixture/')) return pathname.slice('/__fixture/'.length);
  // One single-page app renders every route, like YouTube itself.
  return 'app.html';
}

async function serveFixtures(context) {
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('chrome-extension://')) return route.continue();
    if (!/^https?:\/\/([a-z]+\.)?youtube\.com\//.test(url)) return route.abort();

    const file = path.join(FIXTURE_DIR, fixtureFor(url));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing fixture' });
    return route.fulfill({
      status: 200,
      contentType: CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
      body: fs.readFileSync(file)
    });
  });
}

export const test = base.extend({
  // Real youtube.com instead of fixtures; enabled by the live project.
  live: [false, { option: true }],

  extension: [
    async ({}, use) => {
      const ext = buildExtension();
      await use(ext);
      fs.rmSync(ext.dir, { recursive: true, force: true });
    },
    { scope: 'worker' }
  ],

  context: async ({ extension, live, headless }, use) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yte-profile-'));
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless,
      locale: 'en-US',
      viewport: { width: 1400, height: 900 },
      args: [
        `--disable-extensions-except=${extension.dir}`,
        `--load-extension=${extension.dir}`,
        '--autoplay-policy=no-user-gesture-required',
        // Live tests play real videos and ads; keep them off the speakers.
        '--mute-audio'
      ]
    });
    if (!live) await serveFixtures(context);
    await use(context);
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  },

  page: async ({ context }, use) => {
    const page = context.pages()[0] || (await context.newPage());
    await use(page);
  },

  /** Page on the extension origin, for reading and seeding storage. */
  harness: async ({ context, extension }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extension.id}/test-harness.html`);
    const harness = {
      page,
      set: (values) => page.evaluate((v) => chrome.storage.local.set(v), values),
      get: (keys) => page.evaluate((k) => chrome.storage.local.get(k), keys ?? null)
    };
    await use(harness);
  },

  /** Opens the real popup in a tab. */
  openPopup: async ({ context, extension }, use) => {
    await use(async () => {
      const popup = await context.newPage();
      await popup.setViewportSize({ width: 420, height: 800 });
      await popup.goto(`chrome-extension://${extension.id}/popup.html`);
      await popup.waitForFunction(() => document.querySelector('.lang-btn.active'));
      return popup;
    });
  }
});

export { expect };

/** Waits until the content script has injected its stylesheet. */
export async function waitForExtension(page) {
  await page.waitForSelector('#yte-dynamic-styles', { state: 'attached' });
}

/** Opens a fixture route and waits for both the fake app and the extension. */
export async function openYoutube(page, route = '/watch?v=fixture1') {
  await page.goto(`https://www.youtube.com${route}`);
  await page.evaluate(() => window.__fx.ready);
  await waitForExtension(page);
  // Settings arrive asynchronously from storage; one round trip settles them.
  await page.waitForTimeout(150);
}

/** In-app navigation through the fake app. */
export async function spaNavigate(page, route, options = {}) {
  await page.evaluate(([r, o]) => window.__fx.navigate(r, o), [route, options]);
  await page.waitForTimeout(150);
}

/** Computed style of the first element matching a selector. */
export function styleOf(page, selector, property) {
  return page.evaluate(
    ([sel, prop]) => {
      const node = document.querySelector(sel);
      return node ? getComputedStyle(node)[prop] : null;
    },
    [selector, property]
  );
}

/** Whether an element is rendered at all. */
export function isDisplayed(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return false;
    return node.getClientRects().length > 0 && getComputedStyle(node).display !== 'none';
  }, selector);
}

/** Current playback rate of the watched video. */
export function playbackRate(page) {
  return page.evaluate(() => document.querySelector('#movie_player video').playbackRate);
}
