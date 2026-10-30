import { test, expect, openYoutube, styleOf, playbackRate } from '../helpers/extension.js';

/** Records a shortcut through the popup UI exactly as a user would. */
async function record(popup, action, keys) {
  await popup.locator('.tab-btn[data-tab="shortcuts"]').click();
  await popup.locator(`.shortcut-btn[data-shortcut="${action}"]`).click();
  await popup.keyboard.press(keys);
}

test.describe('shortcuts', () => {
  test('a shortcut recorded in the popup works on the page', async ({ page, harness, openPopup }) => {
    const popup = await openPopup();
    await record(popup, 'toggleInvert', 'Alt+KeyI');
    await expect(popup.locator('.shortcut-btn[data-shortcut="toggleInvert"]')).toHaveText(/^Alt\+/);
    await popup.close();

    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyI');
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toContain('invert(1)');
    expect((await harness.get(['invert'])).invert).toBe(true);
  });

  test('speed shortcuts step the speed', async ({ page, harness }) => {
    await harness.set({ shortcuts: { speedUp: 'Shift+W', speedDown: 'Shift+S' }, speedStep: 0.25 });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Shift+KeyW');
    await page.keyboard.press('Shift+KeyW');
    await expect.poll(() => playbackRate(page)).toBe(1.5);
    await page.keyboard.press('Shift+KeyS');
    await expect.poll(() => playbackRate(page)).toBe(1.25);
  });

  test('shortcuts are ignored while typing in a text field', async ({ page, harness }) => {
    await harness.set({ shortcuts: { toggleInvert: 'I' } });
    await openYoutube(page);
    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'search';
      document.body.prepend(input);
    });
    await page.locator('#search').click();
    await page.keyboard.press('KeyI');
    await page.waitForTimeout(200);
    expect(await styleOf(page, '#movie_player video', 'filter')).not.toContain('invert');
  });

  test('assigning a combo already in use moves it to the new action', async ({ harness, openPopup }) => {
    const popup = await openPopup();
    await record(popup, 'toggleHome', 'Alt+KeyH');
    await record(popup, 'toggleSidebar', 'Alt+KeyH');
    await expect.poll(async () => (await harness.get(['shortcuts'])).shortcuts).toEqual({
      toggleSidebar: 'Alt+H'
    });
  });

  test('Enter and Space can be recorded as shortcuts', async ({ harness, openPopup }) => {
    const popup = await openPopup();
    await record(popup, 'clipToggle', 'Enter');
    await expect
      .poll(async () => (await harness.get(['shortcuts'])).shortcuts)
      .toEqual({ clipToggle: 'ENTER' });
    await record(popup, 'clipSave', 'Space');
    await expect
      .poll(async () => (await harness.get(['shortcuts'])).shortcuts)
      .toEqual({ clipToggle: 'ENTER', clipSave: 'SPACE' });
  });

  test('Escape cancels recording and keeps the old shortcut', async ({ harness, openPopup }) => {
    await harness.set({ shortcuts: { toggleCrop: 'Alt+C' } });
    const popup = await openPopup();
    await record(popup, 'toggleCrop', 'Escape');
    await expect(popup.locator('.shortcut-btn[data-shortcut="toggleCrop"]')).toHaveText('Alt+C');
    expect((await harness.get(['shortcuts'])).shortcuts).toEqual({ toggleCrop: 'Alt+C' });
  });

  test('the clear button removes a shortcut', async ({ harness, openPopup }) => {
    await harness.set({ shortcuts: { toggleCrop: 'Alt+C' } });
    const popup = await openPopup();
    await popup.locator('.tab-btn[data-tab="shortcuts"]').click();
    await popup.locator('.shortcut-clear-btn[data-shortcut="toggleCrop"]').click();
    await expect.poll(async () => (await harness.get(['shortcuts'])).shortcuts).toEqual({});
  });
});
