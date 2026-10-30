/**
 * Smoke tests against the real youtube.com. They catch YouTube changing the
 * DOM or player behaviour the extension depends on. Slow and network bound,
 * so they run separately: `npm run test:live`.
 */

import { test, expect, waitForExtension, styleOf, isDisplayed } from '../helpers/extension.js';

const VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

/** Clears a consent interstitial if YouTube shows one for this region. */
async function passConsent(page) {
  if (!page.url().includes('consent.')) return;
  await page.getByRole('button', { name: /reject all/i }).first().click();
  await page.waitForURL(/youtube\.com\/watch/);
}

/** Waits out (and skips, when offered) any ad break. */
async function waitForContent(page) {
  for (let i = 0; i < 180; i++) {
    const ad = await page.evaluate(() => {
      const p = document.querySelector('#movie_player');
      return !p || p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting');
    });
    if (!ad) return;
    const skip = page.locator('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button').first();
    if (await skip.isVisible().catch(() => false)) await skip.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  throw new Error('ad break never ended');
}

const rates = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('#movie_player');
    return { element: p.querySelector('video').playbackRate, youtube: p.getPlaybackRate() };
  });

async function openVideo(page, url = VIDEO) {
  await page.goto(url);
  await passConsent(page);
  await page.waitForSelector('#movie_player video');
  await waitForExtension(page);
  await waitForContent(page);
}

/** Opens the first related video through YouTube's own in-app navigation. */
async function openRelated(page) {
  const link = page.locator('ytd-watch-next-secondary-results-renderer a[href^="/watch"]').first();
  const href = await link.getAttribute('href');
  await link.click();
  await page.waitForURL((url) => href.includes(new URL(url).searchParams.get('v')));
  await page.waitForTimeout(1000);
  await waitForContent(page);
}

test('the default speed reaches both the video and YouTube’s own player', async ({ page, harness }) => {
  await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
  await openVideo(page);
  await expect.poll(() => rates(page)).toEqual({ element: 1.5, youtube: 1.5 });
});

test('YouTube’s Shift+> speeds up from the extension’s speed', async ({ page, harness }) => {
  await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
  await openVideo(page);
  await expect.poll(() => rates(page)).toEqual({ element: 1.5, youtube: 1.5 });

  await page.locator('#movie_player').click({ position: { x: 300, y: 200 } });
  await page.keyboard.press('Shift+Period');
  await expect.poll(() => rates(page)).toEqual({ element: 1.75, youtube: 1.75 });
  await expect.poll(async () => (await harness.get(['lastSpeed'])).lastSpeed).toBe(1.75);
});

test('the next video starts at the default speed, ad break or not', async ({ page, harness }) => {
  await harness.set({ speedDefault: 1.5, lastSpeed: 1.5, speedPersist: false });
  await openVideo(page);
  await page.evaluate(() => document.querySelector('#movie_player').setPlaybackRate(0.75));
  await expect.poll(() => rates(page)).toEqual({ element: 0.75, youtube: 0.75 });

  await openRelated(page);
  await page.waitForTimeout(2500);
  expect(await rates(page)).toEqual({ element: 1.5, youtube: 1.5 });
  expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.5);
});

test('page structure the extension relies on is still there', async ({ page, harness }) => {
  await harness.set({ brightness: 80, hideSidebar: true });
  await openVideo(page);
  expect(await styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.8)');
  expect(await isDisplayed(page, '#secondary')).toBe(false);
  await expect(page.locator('#movie_player #yte-osc .yte-speed')).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id]').length
    )
  ).toBeGreaterThan(0);
});
