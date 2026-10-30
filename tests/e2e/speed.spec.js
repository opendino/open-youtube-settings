import { test, expect, openYoutube, spaNavigate, playbackRate } from '../helpers/extension.js';

const youtubeRate = (page) => page.evaluate(() => window.__fx.youtubeRate());

test.describe('speed controller', () => {
  test('applies the default speed when a video opens', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page);
    await expect.poll(() => playbackRate(page)).toBe(1.5);
  });

  test("keeps YouTube's own player rate in sync with the speed it sets", async ({ page, harness }) => {
    // Otherwise YouTube's menu shows "Normal" and Shift+> steps from 1.
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page);
    await expect.poll(() => playbackRate(page)).toBe(1.5);
    expect(await youtubeRate(page)).toBe(1.5);
  });

  test("YouTube's speed-up shortcut speeds up instead of slowing down", async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page);
    await expect.poll(() => playbackRate(page)).toBe(1.5);

    await page.evaluate(() => window.__fx.youtubeStep(1));
    await expect.poll(() => playbackRate(page)).toBe(1.75);
    await expect.poll(async () => (await harness.get(['lastSpeed'])).lastSpeed).toBe(1.75);
  });

  test('a speed picked in YouTube’s menu is adopted and remembered', async ({ page, harness }) => {
    await openYoutube(page);
    await page.evaluate(() => window.__fx.youtubeSetRate(1.25));
    await expect.poll(async () => (await harness.get(['lastSpeed'])).lastSpeed).toBe(1.25);
    await page.waitForTimeout(2500); // past one periodic re-apply
    expect(await playbackRate(page)).toBe(1.25);
  });

  test('the next video starts at the default speed when not carrying speed over', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5, speedPersist: false });
    await openYoutube(page);
    await page.evaluate(() => window.__fx.youtubeSetRate(0.75));
    await expect.poll(() => playbackRate(page)).toBe(0.75);

    await spaNavigate(page, '/watch?v=fixture2');
    await expect.poll(() => playbackRate(page)).toBe(1.5);
  });

  test('the default speed survives an ad break on the next video', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5, speedPersist: false });
    await openYoutube(page);
    await page.evaluate(() => window.__fx.youtubeSetRate(0.75));
    await expect.poll(() => playbackRate(page)).toBe(0.75);

    await spaNavigate(page, '/watch?v=fixture2', { ad: true });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__fx.endAd());

    await page.waitForTimeout(2500);
    expect(await playbackRate(page)).toBe(1.5);
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.5);
  });

  test('carries the speed over when asked to', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1, lastSpeed: 1, speedPersist: true });
    await openYoutube(page);
    await page.evaluate(() => window.__fx.youtubeSetRate(1.75));
    await expect.poll(() => playbackRate(page)).toBe(1.75);

    await spaNavigate(page, '/watch?v=fixture2');
    await page.waitForTimeout(500);
    expect(await playbackRate(page)).toBe(1.75);
  });

  test('rates beyond YouTube’s 2× limit stick after an ad break', async ({ page, harness }) => {
    await harness.set({ speedDefault: 2.5, lastSpeed: 2.5, speedPersist: false });
    await openYoutube(page);
    await expect.poll(() => playbackRate(page)).toBe(2.5);

    await spaNavigate(page, '/watch?v=fixture2', { ad: true });
    await page.evaluate(() => window.__fx.endAd());
    await page.waitForTimeout(2500);
    expect(await playbackRate(page)).toBe(2.5);
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(2.5);
  });

  test('player chip steps by the configured step and shows a clean value', async ({ page, harness }) => {
    await harness.set({ speedStep: 0.1 });
    await openYoutube(page);
    const chip = page.locator('#yte-osc .yte-speed');
    await page.locator('#movie_player').hover();
    for (let i = 0; i < 3; i++) await chip.locator('.yte-step').last().click();
    await expect.poll(() => playbackRate(page)).toBe(1.3);
    await expect(chip.locator('.yte-speed-value')).toHaveText('1.30×');
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.3);
  });

  test('does nothing at all while the controller is off', async ({ page, harness }) => {
    await harness.set({ speedEnabled: false, speedDefault: 2, lastSpeed: 2 });
    await openYoutube(page);
    await page.waitForTimeout(2500);
    expect(await playbackRate(page)).toBe(1);
    await expect(page.locator('#yte-osc .yte-speed')).toBeHidden();
  });

  test('applies the speed to Shorts', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page, '/shorts/abc');
    await expect
      .poll(() => page.evaluate(() => document.querySelector('#shorts-player video').playbackRate))
      .toBe(1.5);
  });
});
