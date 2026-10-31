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
  // The speed and clip buttons sit in the control bar, just before settings.
  expect(
    await page.evaluate(() => {
      const settings = document.querySelector('#movie_player .ytp-right-controls .ytp-settings-button');
      return [settings.previousElementSibling.classList.contains('yte-ctl-clip'),
        settings.previousElementSibling.previousElementSibling.classList.contains('yte-ctl-speed')];
    })
  ).toEqual([true, true]);
  await expect(page.locator('.yte-ctl-speed')).toHaveText(/^\d\.\d\d×$/);
  expect(
    await page.evaluate(() =>
      document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id]').length
    )
  ).toBeGreaterThan(0);
});

/** Hops through related videos until YouTube serves an ad break. */
async function findAdBreak(page, hops = 5) {
  for (let hop = 0; hop < hops; hop++) {
    for (let i = 0; i < 16; i++) {
      if (await page.evaluate(() => document.querySelector('#movie_player').classList.contains('ad-showing'))) {
        return true;
      }
      await page.waitForTimeout(500);
    }
    const link = page.locator('ytd-watch-next-secondary-results-renderer a[href^="/watch"]').first();
    await link.click();
    await page.waitForTimeout(1000);
  }
  return false;
}

test('ads are muted and the sound comes back at the same volume', async ({ page, harness }) => {
  test.setTimeout(240_000);
  await harness.set({ muteAds: true });
  await page.goto(VIDEO);
  await passConsent(page);
  await page.waitForSelector('#movie_player video');
  await waitForExtension(page);

  const before = await page.evaluate(() => document.querySelector('#movie_player').getVolume());
  test.skip(!(await findAdBreak(page)), 'YouTube served no ad in this run');

  const during = () =>
    page.evaluate(() => {
      const p = document.querySelector('#movie_player');
      return { element: p.querySelector('video').muted, youtube: p.isMuted() };
    });
  await expect.poll(during).toEqual({ element: true, youtube: true });

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

test('channel blocking reads real cards and covers them without moving anything', async ({ page, harness }) => {
  test.setTimeout(180_000);
  await page.goto(VIDEO);
  await passConsent(page);
  await page.waitForSelector('ytd-watch-next-secondary-results-renderer yt-lockup-view-model');
  await waitForExtension(page);
  await waitForContent(page);

  const SIDE = 'ytd-watch-next-secondary-results-renderer yt-lockup-view-model';
  // Nearly every recommendation names its channel, so nearly every one gets a button.
  await expect
    .poll(() =>
      page.evaluate((sel) => {
        const cards = [...document.querySelectorAll(sel)];
        return cards.filter((c) => c.querySelector(':scope > .yte-block-btn')).length / cards.length;
      }, SIDE)
    )
    .toBeGreaterThan(0.8);

  const rects = () =>
    page.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 8).map((n) => {
      const r = n.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }), SIDE);
  const before = await rects();

  const first = page.locator(SIDE).first();
  const shownName = (await first.locator('yt-content-metadata-view-model').innerText()).split('\n')[0].trim();
  await first.hover();
  await first.locator('> .yte-block-btn').click();
  await expect(first.locator('> .yte-block-overlay')).toBeVisible();
  const [entry] = (await harness.get(['blockedChannels'])).blockedChannels;
  expect(entry.name).toBe(shownName);
  expect(await rects()).toEqual(before);

  // End screen: stills name their channel too.
  await page.evaluate(() => {
    const v = document.querySelector('#movie_player video');
    v.currentTime = v.duration - 0.5;
  });
  await expect
    .poll(() => page.locator('.ytp-videowall-still > .yte-block-btn, .ytp-modern-videowall-still > .yte-block-btn').count(), { timeout: 15000 })
    .toBeGreaterThan(0);

  // Search for the channel: its own results are covered by name.
  await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(entry.name)}`);
  await page.waitForSelector('ytd-video-renderer');
  await expect.poll(() => page.locator('ytd-video-renderer > .yte-block-overlay').count()).toBeGreaterThan(0);

  // Nothing inside a covered result shows through (YouTube lifts the channel row).
  const leaks = await page.evaluate(() =>
    [...document.querySelectorAll('ytd-video-renderer.yte-blocked')].filter((card) => {
      const r = card.querySelector('ytd-channel-name, #channel-info');
      if (!r) return false;
      const box = r.getBoundingClientRect();
      if (!box.width || box.bottom < 0 || box.top > innerHeight) return false;
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !(hit && hit.classList.contains('yte-block-overlay'));
    }).length
  );
  expect(leaks).toBe(0);
});

test('YouTube’s hover preview in search carries a working block button', async ({ page, harness }) => {
  await page.goto('https://www.youtube.com/results?search_query=lofi+music');
  await passConsent(page);
  await page.waitForSelector('ytd-video-renderer.yte-card > .yte-block-btn');

  const card = page.locator('ytd-video-renderer.yte-card').first();
  const box = await card.locator('a#thumbnail').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const preview = page.locator('ytd-video-preview').first();
  await expect(preview).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1500);

  // Same spot as the card's own button, which the preview covers.
  const button = preview.locator('> .yte-block-btn');
  const spot = await card.locator('> .yte-block-btn').boundingBox();
  await page.mouse.move(spot.x + spot.width / 2, spot.y + spot.height / 2);
  await expect(button).toHaveCSS('opacity', '1');
  expect(await button.boundingBox()).toEqual(spot);
  await button.click();

  await expect(card.locator('> .yte-block-overlay')).toBeVisible();
  expect((await harness.get(['blockedChannels'])).blockedChannels).toHaveLength(1);
  const topmost = await card.locator('a#thumbnail').evaluate((node) => {
    const r = node.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).className;
  });
  expect(topmost).toBe('yte-block-overlay');
});
