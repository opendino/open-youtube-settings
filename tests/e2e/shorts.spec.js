import { test, expect, openYoutube, isDisplayed, openPage } from '../helpers/extension.js';

/** Every place Shorts show up in the fixture, by page. */
const SHORTS = {
  '/': ['ytd-rich-shelf-renderer[is-shorts]', 'ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model-v2)'],
  '/results?search_query=x': ['grid-shelf-view-model', 'ytd-video-renderer:has(a[href="/shorts/s5"])'],
  '/@somechannel': ['ytd-reel-shelf-renderer', 'yt-tab-shape[tab-title="Shorts"]']
};
const GUIDE = ['ytd-guide-entry-renderer:has(a[title="Shorts"])', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]'];

test.describe('turning Shorts off', () => {
  test('hides Shorts on home, search, channel pages and in the guide', async ({ page, harness }) => {
    await harness.set({ hideShorts: true });
    for (const [route, selectors] of Object.entries(SHORTS)) {
      await openYoutube(page, route);
      for (const selector of [...selectors, ...GUIDE]) {
        await expect.poll(() => isDisplayed(page, selector), { message: `${route} ${selector}` }).toBe(false);
      }
    }
  });

  test('keeps everything else in place', async ({ page, harness }) => {
    await harness.set({ hideShorts: true });
    await openYoutube(page, '/results?search_query=x');
    await expect(page.locator('ytd-video-renderer:has(a[href="/watch?v=search0"])')).toBeVisible();
    expect(await isDisplayed(page, 'ytd-guide-entry-renderer:has(a[title="Home"])')).toBe(true);
    expect(await isDisplayed(page, 'ytd-mini-guide-entry-renderer[aria-label="Home"]')).toBe(true);
    await openYoutube(page, '/@somechannel');
    expect(await isDisplayed(page, 'yt-tab-shape[tab-title="Videos"]')).toBe(true);
  });

  test('a Shorts link opens the video in the normal player', async ({ page, harness }) => {
    await harness.set({ hideShorts: true });
    await page.goto('https://www.youtube.com/shorts/abc123');
    await page.waitForURL('https://www.youtube.com/watch?v=abc123');
    await page.waitForSelector('#movie_player video');
  });

  test('Shorts stay as they are while the setting is off', async ({ page }) => {
    for (const [route, selectors] of Object.entries(SHORTS)) {
      await openYoutube(page, route);
      for (const selector of [...selectors, ...GUIDE]) expect(await isDisplayed(page, selector), selector).toBe(true);
    }
    await openYoutube(page, '/shorts/abc123');
    expect(new URL(page.url()).pathname).toBe('/shorts/abc123');
  });

  test('the switch sits on the Layout page, counts on its card and works live', async ({ page, harness, openPopup }) => {
    await openYoutube(page, '/');
    expect(await isDisplayed(page, 'ytd-rich-shelf-renderer[is-shorts]')).toBe(true);
    const popup = await openPopup();
    await openPage(popup, 'layout');
    await popup.locator('label:has(#hide-shorts)').click();
    await expect.poll(async () => (await harness.get(['hideShorts'])).hideShorts).toBe(true);
    await expect.poll(() => isDisplayed(page, 'ytd-rich-shelf-renderer[is-shorts]')).toBe(false);
    await popup.locator('#page-layout .back-btn').click();
    await expect(popup.locator('.card[data-page="layout"] .card-status')).toHaveText('1 on');
  });

  test('its shortcut flips it on the page', async ({ page, harness }) => {
    await harness.set({ shortcuts: { toggleShorts: 'Alt+S' } });
    await openYoutube(page, '/');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyS');
    await expect.poll(() => isDisplayed(page, 'ytd-rich-shelf-renderer[is-shorts]')).toBe(false);
    expect((await harness.get(['hideShorts'])).hideShorts).toBe(true);
  });

  test('nothing is hidden while the extension is off', async ({ page, harness }) => {
    await harness.set({ hideShorts: true, enabled: false });
    await openYoutube(page, '/');
    expect(await isDisplayed(page, 'ytd-rich-shelf-renderer[is-shorts]')).toBe(true);
  });
});
