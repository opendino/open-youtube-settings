import { test, expect, openYoutube, styleOf, playbackRate, openPage } from '../helpers/extension.js';

test.describe('master switch', () => {
  test('turning the extension off leaves YouTube untouched, and on brings it all back', async ({
    page,
    harness,
    openPopup
  }) => {
    await harness.set({
      brightness: 80,
      speedDefault: 1.5,
      lastSpeed: 1.5,
      muteAds: true,
      blockedChannels: [{ name: 'Blocked Co' }]
    });
    await openYoutube(page);
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.8)');
    await expect.poll(() => playbackRate(page)).toBe(1.5);
    await expect(page.locator('.yte-block-overlay')).toHaveCount(1);
    await expect(page.locator('.yte-ctl-speed')).toBeVisible();

    const popup = await openPopup();
    await popup.locator('label.master').click();
    await expect(popup.locator('#off-notice')).toBeVisible();
    await expect.poll(async () => (await harness.get(['enabled'])).enabled).toBe(false);

    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('none');
    await expect(page.locator('.yte-block-overlay')).toHaveCount(0);
    await expect(page.locator('.yte-block-btn')).toHaveCount(0);
    for (const ctl of ['.yte-ctl-speed', '.yte-ctl-clip', '.yte-ctl-crop']) {
      await expect(page.locator(ctl)).toBeHidden();
    }
    // YouTube's own speed choice is left alone.
    await page.evaluate(() => window.__fx.youtubeSetRate(1.25));
    await page.waitForTimeout(500);
    expect(await playbackRate(page)).toBe(1.25);
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.5);
    // Ads are not muted.
    await page.evaluate(() => window.__fx.startAd());
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.querySelector('#movie_player video').muted)).toBe(false);
    await page.evaluate(() => window.__fx.endAd());

    await popup.locator('label.master').click();
    await expect(popup.locator('#off-notice')).toBeHidden();
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.8)');
    await expect(page.locator('.yte-block-overlay')).toHaveCount(1);
    await expect(page.locator('.yte-ctl-speed')).toBeVisible();
  });

  test('shortcuts do nothing while the extension is off', async ({ page, harness }) => {
    await harness.set({ enabled: false, shortcuts: { toggleInvert: 'Alt+I' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyI');
    await page.waitForTimeout(300);
    expect((await harness.get(['invert'])).invert).toBeFalsy();
    expect(await styleOf(page, '#movie_player video', 'filter')).toBe('none');
  });

  test('a crop in place ends when the extension is turned off', async ({ page, harness }) => {
    await openYoutube(page);
    await page.locator('.yte-ctl-crop').click();
    const p = await page.locator('#movie_player').boundingBox();
    await page.mouse.move(p.x + p.width * 0.2, p.y + p.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(p.x + p.width * 0.6, p.y + p.height * 0.6, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => styleOf(page, '#movie_player video', 'transform')).not.toBe('none');
    await harness.set({ enabled: false });
    await expect.poll(() => styleOf(page, '#movie_player video', 'transform')).toBe('none');
  });

  test('the cards dim while it is off', async ({ harness, openPopup }) => {
    await harness.set({ enabled: false });
    const popup = await openPopup();
    await expect(popup.locator('#enabled')).not.toBeChecked();
    await expect(popup.locator('body')).toHaveClass(/ext-off/);
    await openPage(popup, 'colour');
  });
});
