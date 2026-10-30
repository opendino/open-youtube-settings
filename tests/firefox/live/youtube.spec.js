/**
 * The Firefox package against the real youtube.com. Same smoke checks as the
 * Chromium live suite: `npm run test:firefox:live`.
 */

import { test, expect, styleOf, isDisplayed, sleep } from '../../helpers/firefox.js';

const VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

async function passConsent(page) {
  if (!page.url().includes('consent.')) return;
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const label = await button.evaluate((n) => n.textContent.trim());
    if (/reject all/i.test(label)) {
      await button.click();
      break;
    }
  }
  await page.waitForNavigation();
}

/** Waits out (and skips, when offered) any ad break. */
async function waitForContent(page) {
  for (let i = 0; i < 180; i++) {
    const ad = await page.evaluate(() => {
      const p = document.querySelector('#movie_player');
      return !p || p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting');
    });
    if (!ad) return;
    const skip = await page.$('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button');
    if (skip && (await skip.isVisible().catch(() => false))) await skip.click().catch(() => {});
    await sleep(500);
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
  await page.waitForSelector('#yte-dynamic-styles');
  await waitForContent(page);
}

test('default speed reaches the video and YouTube’s own player', async ({ page, harness }) => {
  await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
  await openVideo(page);
  await expect.poll(() => rates(page)).toEqual({ element: 1.5, youtube: 1.5 });
});

test('YouTube’s Shift+> speeds up from the extension’s speed', async ({ page, harness }) => {
  await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
  await openVideo(page);
  await expect.poll(() => rates(page)).toEqual({ element: 1.5, youtube: 1.5 });
  await page.click('#movie_player', { offset: { x: 300, y: 200 } });
  await page.keyboard.down('Shift');
  await page.keyboard.press('Period');
  await page.keyboard.up('Shift');
  await expect.poll(() => rates(page)).toEqual({ element: 1.75, youtube: 1.75 });
  await expect.poll(async () => (await harness.get(['lastSpeed'])).lastSpeed).toBe(1.75);
});

test('the next video starts at the default speed, ad break or not', async ({ page, harness }) => {
  await harness.set({ speedDefault: 1.5, lastSpeed: 1.5, speedPersist: false });
  await openVideo(page);
  await page.evaluate(() => document.querySelector('#movie_player').setPlaybackRate(0.75));
  await expect.poll(() => rates(page)).toEqual({ element: 0.75, youtube: 0.75 });

  const href = await page.$eval(
    'ytd-watch-next-secondary-results-renderer a[href^="/watch"]',
    (a) => a.getAttribute('href')
  );
  await page.click(`ytd-watch-next-secondary-results-renderer a[href="${href}"]`);
  await expect.poll(() => page.url()).toContain(new URL(href, VIDEO).searchParams.get('v'));
  await sleep(1000);
  await waitForContent(page);
  await sleep(2500);
  expect(await rates(page)).toEqual({ element: 1.5, youtube: 1.5 });
  expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.5);
});

test('page structure the extension relies on is still there', async ({ page, harness }) => {
  await harness.set({ brightness: 80, hideSidebar: true });
  await openVideo(page);
  expect(await styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.8)');
  expect(await isDisplayed(page, '#secondary')).toBe(false);
  expect(await page.$('#movie_player #yte-osc .yte-speed')).not.toBeNull();
});

/** Hops through related videos until YouTube serves an ad break. */
async function findAdBreak(page, hops = 5) {
  for (let hop = 0; hop < hops; hop++) {
    for (let i = 0; i < 16; i++) {
      if (await page.evaluate(() => document.querySelector('#movie_player').classList.contains('ad-showing'))) {
        return true;
      }
      await sleep(500);
    }
    await page.click('ytd-watch-next-secondary-results-renderer a[href^="/watch"]');
    await sleep(1000);
  }
  return false;
}

test('ads are muted and the sound comes back at the same volume', async ({ page, harness }) => {
  test.setTimeout(240_000);
  await harness.set({ muteAds: true });
  await page.goto(VIDEO);
  await passConsent(page);
  await page.waitForSelector('#movie_player video');
  await page.waitForSelector('#yte-dynamic-styles');

  const before = await page.evaluate(() => document.querySelector('#movie_player').getVolume());
  test.skip(!(await findAdBreak(page)), 'YouTube served no ad in this run');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const p = document.querySelector('#movie_player');
        return { element: p.querySelector('video').muted, youtube: p.isMuted() };
      })
    )
    .toEqual({ element: true, youtube: true });

  await waitForContent(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const p = document.querySelector('#movie_player');
        return { element: p.querySelector('video').muted, youtube: p.isMuted(), volume: p.getVolume() };
      })
    )
    .toEqual({ element: false, youtube: false, volume: before });
});

test('channel blocking reads real cards and covers them', async ({ page, harness }) => {
  test.setTimeout(180_000);
  const SIDE = 'ytd-watch-next-secondary-results-renderer yt-lockup-view-model';
  await page.goto(VIDEO);
  await passConsent(page);
  await page.waitForSelector(SIDE);
  await page.waitForSelector('#yte-dynamic-styles');
  await waitForContent(page);
  await page.waitForSelector(`${SIDE} > .yte-block-btn`);

  const shownName = await page.$eval(SIDE, (card) =>
    card.querySelector('yt-content-metadata-view-model').innerText.split('\n')[0].trim()
  );
  await page.hover(SIDE);
  await page.click(`${SIDE} > .yte-block-btn`);
  await page.waitForSelector(`${SIDE} > .yte-block-overlay`);
  const [entry] = (await harness.get(['blockedChannels'])).blockedChannels;
  expect(entry.name).toBe(shownName);

  await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(entry.name)}`);
  await page.waitForSelector('ytd-video-renderer');
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('ytd-video-renderer > .yte-block-overlay').length))
    .toBeGreaterThan(0);
});
