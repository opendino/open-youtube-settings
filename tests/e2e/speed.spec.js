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

  test('the speed button in the control bar sits before settings and shows the rate', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page);
    const button = page.locator('.ytp-right-controls-left > .yte-ctl-speed');
    await expect(button).toHaveText('1.50×');
    await expect(button).toHaveAttribute('title', 'Speed');
    const order = await page.evaluate(() =>
      [...document.querySelector('.ytp-right-controls-left').children].map((n) => n.className.split(' ').find((c) => /^(ytp|yte)-(?!button$)/.test(c) && c !== 'yte-ctl'))
    );
    expect(order).toEqual(['ytp-subtitles-button', 'yte-ctl-speed', 'yte-ctl-clip', 'yte-ctl-crop', 'ytp-settings-button']);

    await page.evaluate(() => window.__fx.youtubeSetRate(0.75));
    await expect(button).toHaveText('0.75×');
  });

  test('the speed tray steps by the configured step and shows a clean value', async ({ page, harness }) => {
    await harness.set({ speedStep: 0.1 });
    await openYoutube(page);
    await page.locator('.yte-ctl-speed').click();
    const tray = page.locator('#yte-osc .yte-speed-tray');
    await expect(tray).toBeVisible();
    for (let i = 0; i < 3; i++) await tray.locator('.yte-step').last().click();
    await expect.poll(() => playbackRate(page)).toBe(1.3);
    await expect(page.locator('.yte-ctl-speed')).toHaveText('1.30×');
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.3);
  });

  test('the speed tray opens above its button and a preset closes it', async ({ page, harness }) => {
    await openYoutube(page);
    const button = page.locator('.yte-ctl-speed');
    await button.click();
    const tray = page.locator('#yte-osc .yte-speed-tray');
    const [b, t] = [await button.boundingBox(), await tray.boundingBox()];
    expect(t.y + t.height).toBeLessThanOrEqual(b.y);
    expect(Math.round(t.x + t.width)).toBeLessThanOrEqual(Math.round(b.x + b.width));
    await expect(tray.locator('button[data-speed="1"]')).toHaveClass(/yte-current/);

    await tray.locator('button[data-speed="1.5"]').click();
    await expect.poll(() => playbackRate(page)).toBe(1.5);
    await expect(tray).toBeHidden();
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.5);
  });

  test('the speed tray closes on Escape and on a click elsewhere', async ({ page }) => {
    await openYoutube(page);
    const tray = page.locator('#yte-osc .yte-speed-tray');
    await page.locator('.yte-ctl-speed').click();
    await expect(tray).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tray).toBeHidden();

    await page.locator('.yte-ctl-speed').click();
    await expect(tray).toBeVisible();
    await page.locator('ytd-watch-metadata').click();
    await expect(tray).toBeHidden();
  });

  test('clicking the speed button does not pause the video', async ({ page }) => {
    await openYoutube(page);
    let clicks = 0;
    await page.exposeFunction('__playerClicked', () => clicks++);
    await page.evaluate(() => document.querySelector('#movie_player').addEventListener('click', () => window.__playerClicked()));
    await page.locator('.yte-ctl-speed').click();
    await page.locator('.yte-ctl-clip').click();
    await page.waitForTimeout(200);
    expect(clicks).toBe(0);
  });

  test('turning the indicator off removes the speed button only', async ({ page, harness }) => {
    await harness.set({ speedOverlay: false });
    await openYoutube(page);
    await expect(page.locator('.yte-ctl-speed')).toBeHidden();
    await expect(page.locator('.yte-ctl-clip')).toBeVisible();
  });

  test('does nothing at all while the controller is off', async ({ page, harness }) => {
    await harness.set({ speedEnabled: false, speedDefault: 2, lastSpeed: 2 });
    await openYoutube(page);
    await page.waitForTimeout(2500);
    expect(await playbackRate(page)).toBe(1);
    await expect(page.locator('.yte-ctl-speed')).toBeHidden();
  });

  test('applies the speed to Shorts', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page, '/shorts/abc');
    await expect
      .poll(() => page.evaluate(() => document.querySelector('#shorts-player video').playbackRate))
      .toBe(1.5);
  });
});
