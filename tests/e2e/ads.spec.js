import { test, expect, openYoutube, spaNavigate, openPage } from '../helpers/extension.js';

/** What the user hears, and what YouTube's volume button shows. */
const sound = (page) =>
  page.evaluate(() => {
    const player = document.querySelector('#movie_player');
    const video = player.querySelector('video');
    return { muted: video.muted, volume: video.volume, youtubeMuted: window.__fx.youtubeMuted() };
  });

const fx = (page, call) => page.evaluate((c) => window.__fx[c](), call);

test.describe('mute ads', () => {
  test('mutes an ad break and gives the sound back at the same volume', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await page.evaluate(() => (document.querySelector('#movie_player video').volume = 0.4));

    await fx(page, 'startAd');
    await expect.poll(() => sound(page)).toEqual({ muted: true, volume: 0.4, youtubeMuted: true });

    await fx(page, 'endAd');
    await expect.poll(() => sound(page)).toEqual({ muted: false, volume: 0.4, youtubeMuted: false });
  });

  test('stays muted through every ad of a break', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await fx(page, 'startAd');
    await expect.poll(async () => (await sound(page)).muted).toBe(true);

    // YouTube loads the next ad and writes its own mute state again.
    await fx(page, 'nextAdInBreak');
    await page.waitForTimeout(300);
    expect((await sound(page)).muted).toBe(true);
  });

  test('a user who was already muted stays muted after the ad', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await fx(page, 'youtubeToggleMute');
    await fx(page, 'startAd');
    await page.waitForTimeout(300);
    await fx(page, 'endAd');
    await page.waitForTimeout(300);
    expect(await sound(page)).toMatchObject({ muted: true, youtubeMuted: true });
  });

  test('unmuting by hand during an ad is respected', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await fx(page, 'startAd');
    await expect.poll(async () => (await sound(page)).muted).toBe(true);

    await fx(page, 'youtubeToggleMute');
    await page.waitForTimeout(2500); // past one periodic check
    expect((await sound(page)).muted).toBe(false);
    await fx(page, 'endAd');
    await page.waitForTimeout(300);
    expect((await sound(page)).muted).toBe(false);
  });

  test('every ad break is muted, not only the first', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    for (let i = 0; i < 2; i++) {
      await fx(page, 'startAd');
      await expect.poll(async () => (await sound(page)).muted).toBe(true);
      await fx(page, 'endAd');
      await expect.poll(async () => (await sound(page)).muted).toBe(false);
    }
  });

  test('a pre-roll on the next video is muted too', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await spaNavigate(page, '/watch?v=fixture2', { ad: true });
    await expect.poll(async () => (await sound(page)).muted).toBe(true);
    await fx(page, 'endAd');
    await expect.poll(async () => (await sound(page)).muted).toBe(false);
  });

  test('a page opened in the middle of an ad is muted', async ({ page, harness }) => {
    await page.addInitScript(() => {
      // The ad is already showing when the extension starts up.
      document.addEventListener('DOMContentLoaded', () =>
        window.__fx.ready.then(() => window.__fx.startAd())
      );
    });
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await expect.poll(async () => (await sound(page)).muted).toBe(true);
  });

  test('switching the option off mid-ad gives the sound back at once', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await fx(page, 'startAd');
    await expect.poll(async () => (await sound(page)).muted).toBe(true);
    await harness.set({ muteAds: false });
    await expect.poll(async () => (await sound(page)).muted).toBe(false);
  });

  test('ads keep their sound while the option is off (the default)', async ({ page }) => {
    await openYoutube(page);
    await fx(page, 'startAd');
    await page.waitForTimeout(500);
    expect((await sound(page)).muted).toBe(false);
  });

  test('the popup toggle is labelled “Reklamları Sessize Al” in Turkish and works', async ({
    page,
    harness,
    openPopup
  }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await openPage(popup, 'language');
    await popup.locator('.lang-btn[data-lang="tr"]').click();
    await expect(popup.locator('[data-i18n="muteAds"]')).toHaveText('Reklamları Sessize Al');

    await openPage(popup, 'ads');
    await popup.locator('label:has(#mute-ads)').click();
    await expect.poll(async () => (await harness.get(['muteAds'])).muteAds).toBe(true);

    await fx(page, 'startAd');
    await expect.poll(async () => (await sound(page)).muted).toBe(true);
  });

  test('reset defaults switches it back off', async ({ harness, openPopup }) => {
    await harness.set({ muteAds: true });
    const popup = await openPopup();
    await expect(popup.locator('#mute-ads')).toBeChecked();
    await popup.locator('#reset').click();
    await expect(popup.locator('#mute-ads')).not.toBeChecked();
    await expect.poll(async () => (await harness.get(['muteAds'])).muteAds).toBe(false);
  });
});
