import {
  test,
  expect,
  openYoutube,
  styleOf,
  playbackRate
} from '../helpers/extension.js';

/** Drives a range input the way a user drag does: value + `input` event. */
async function slide(popup, id, value) {
  await popup.evaluate(
    ([sel, v]) => {
      const input = document.getElementById(sel);
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [id, String(value)]
  );
}

test.describe('popup', () => {
  test('a slider change reaches the open YouTube tab', async ({ page, openPopup }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await slide(popup, 'brightness', 60);
    await expect(popup.locator('#brightness-val')).toHaveText('60%');
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.6)');
  });

  test('changing another setting does not undo the default speed just picked', async ({
    page,
    openPopup
  }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await popup.locator('.tab-btn[data-tab="speed"]').click();
    await slide(popup, 'speed-default', 1.5);
    await expect.poll(() => playbackRate(page)).toBe(1.5);

    await popup.locator('.tab-btn[data-tab="settings"]').click();
    await slide(popup, 'brightness', 90);
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.9)');
    await page.waitForTimeout(500);
    expect(await playbackRate(page)).toBe(1.5);
  });

  test('opening the popup does not reset a speed changed on the page', async ({
    page,
    harness,
    openPopup
  }) => {
    await openYoutube(page);
    await page.evaluate(() => window.__fx.youtubeSetRate(1.75));
    await expect.poll(async () => (await harness.get(['lastSpeed'])).lastSpeed).toBe(1.75);

    const popup = await openPopup();
    await slide(popup, 'bluelight', 20);
    await page.waitForTimeout(500);
    expect(await playbackRate(page)).toBe(1.75);
  });

  test('a speed preset sets the default and the current speed', async ({ page, harness, openPopup }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await popup.locator('.tab-btn[data-tab="speed"]').click();
    await popup.locator('.speed-preset[data-speed="2"]').click();
    await expect(popup.locator('.speed-preset[data-speed="2"]')).toHaveClass(/active/);
    await expect.poll(() => playbackRate(page)).toBe(2);
    const stored = await harness.get(['speedDefault', 'lastSpeed']);
    expect(stored).toEqual({ speedDefault: 2, lastSpeed: 2 });
  });

  test('switching language translates the popup and the on-page text', async ({
    page,
    harness,
    openPopup
  }) => {
    await harness.set({ hideHome: true });
    await openYoutube(page, '/');
    const popup = await openPopup();
    await popup.locator('.tab-btn[data-tab="language"]').click();
    await popup.locator('.lang-btn[data-lang="tr"]').click();
    await expect(popup.locator('.tab-btn[data-tab="settings"]')).not.toHaveText('Settings');

    const tr = JSON.parse(
      await popup.evaluate(() => fetch('_locales/tr/messages.json').then((r) => r.text()))
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.querySelector('ytd-browse'), '::before').content
        )
      )
      .toBe(JSON.stringify(tr.focusMode.message));
    expect((await harness.get(['language'])).language).toBe('tr');
  });

  test('reset defaults, then cancelling the reload prompt, leaves settings untouched', async ({
    harness,
    openPopup
  }) => {
    await harness.set({ hideSkipAnim: true, brightness: 70, hideHome: true });
    const popup = await openPopup();
    await popup.locator('#reset').click();
    await expect(popup.locator('#modal-overlay')).toHaveClass(/active/);
    await popup.locator('#modal-cancel').click();

    // What the popup shows must match what is stored.
    const stored = await harness.get(['brightness', 'hideHome', 'hideSkipAnim']);
    await expect(popup.locator('#brightness')).toHaveValue(String(stored.brightness));
    await expect(popup.locator('#hide-home')).toBeChecked({ checked: stored.hideHome });
    await expect(popup.locator('#hide-skip-anim')).toBeChecked({ checked: stored.hideSkipAnim });
  });

  test('reset defaults, then confirming, stores the defaults', async ({ harness, openPopup }) => {
    await harness.set({ hideSkipAnim: true, brightness: 70, hideHome: true });
    const popup = await openPopup();
    await popup.locator('#reset').click();
    await popup.locator('#modal-confirm').click();
    await expect
      .poll(() => harness.get(['brightness', 'hideHome', 'hideSkipAnim']))
      .toEqual({ brightness: 100, hideHome: false, hideSkipAnim: false });
  });

  test('sub-options are disabled while their parent switch is off', async ({ openPopup }) => {
    const popup = await openPopup();
    await expect(popup.locator('#hide-playlist')).toBeDisabled();
    await popup.locator('label:has(#hide-sidebar)').click();
    await expect(popup.locator('#hide-playlist')).toBeEnabled();
  });

  test('no console errors while using the popup', async ({ openPopup }) => {
    const errors = [];
    const popup = await openPopup();
    popup.on('pageerror', (e) => errors.push(e.message));
    popup.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    for (const tab of ['speed', 'advanced', 'shortcuts', 'language', 'settings']) {
      await popup.locator(`.tab-btn[data-tab="${tab}"]`).click();
    }
    await slide(popup, 'brightness', 80);
    await popup.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
});
