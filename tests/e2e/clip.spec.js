import { test, expect, openYoutube, spaNavigate } from '../helpers/extension.js';

const seek = (page, t) =>
  page.evaluate(async (time) => {
    const v = document.querySelector('#movie_player video');
    v.pause();
    v.currentTime = time;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
  }, t);

test.describe('clip tool', () => {
  test('marks a range and downloads a playable recording of it', async ({ page, harness }) => {
    await harness.set({ shortcuts: { clipToggle: 'Alt+K' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyK');
    const bar = page.locator('#yte-osc .yte-clip');
    await expect(bar).toBeVisible();

    const buttons = bar.locator('.yte-row button');
    await seek(page, 2);
    await buttons.nth(0).click();
    await seek(page, 3.5);
    await buttons.nth(1).click();
    await expect(bar.locator('.yte-times')).toContainText('(1.50s)');

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await buttons.nth(3).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('yt-fixture1-2-3.webm');
    const file = test.info().outputPath('clip.webm');
    await download.saveAs(file);

    const fs = await import('fs');
    expect(fs.statSync(file).size).toBeGreaterThan(1000);
    await expect(page.locator('#yte-osc .yte-toast')).toHaveText('Clip saved');
  });

  test('saving keeps the user’s playback speed', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5, shortcuts: { clipToggle: 'Alt+K' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyK');
    const buttons = page.locator('#yte-osc .yte-clip .yte-row button');
    await seek(page, 1);
    await buttons.nth(0).click();
    await seek(page, 1.6);
    await buttons.nth(1).click();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await buttons.nth(3).click();
    await downloadPromise;
    await page.waitForTimeout(300);
    expect((await harness.get(['lastSpeed'])).lastSpeed).toBe(1.5);
    expect(await page.evaluate(() => document.querySelector('#movie_player video').playbackRate)).toBe(1.5);
  });

  test('save stays disabled until a start and end are set', async ({ page, harness }) => {
    await harness.set({ shortcuts: { clipToggle: 'Alt+K' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyK');
    await expect(page.locator('#yte-osc .yte-clip .yte-primary')).toBeDisabled();
  });

  test('the bar and its marks reset on the next video', async ({ page, harness }) => {
    await harness.set({ shortcuts: { clipToggle: 'Alt+K' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyK');
    await page.locator('#yte-osc .yte-clip .yte-row button').first().click();
    await spaNavigate(page, '/watch?v=fixture2');
    await expect(page.locator('#yte-osc .yte-clip')).toBeHidden();
  });

  test('the clip tool can be switched off', async ({ page, harness }) => {
    await harness.set({ clipEnabled: false, shortcuts: { clipToggle: 'Alt+K' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyK');
    await page.waitForTimeout(200);
    await expect(page.locator('#yte-osc .yte-clip')).toBeHidden();
  });
});
