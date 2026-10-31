import { test, expect, openYoutube, styleOf, playbackRate, openPage } from '../helpers/extension.js';

/** The popup page that holds each action's shortcut button. */
const PAGE_OF = {
  brightnessUp: 'colour',
  brightnessDown: 'colour',
  bluelightUp: 'colour',
  bluelightDown: 'colour',
  toggleFilters: 'colour',
  toggleInvert: 'colour',
  toggleHome: 'layout',
  toggleSidebar: 'layout',
  toggleControls: 'layout',
  togglePlayPause: 'layout',
  toggleSkipAnim: 'layout',
  speedUp: 'speed',
  speedDown: 'speed',
  speedReset: 'speed',
  clipToggle: 'clip',
  clipMarkIn: 'clip',
  clipMarkOut: 'clip',
  clipSave: 'clip',
  toggleCrop: 'crop'
};

/** Records a shortcut through the popup UI exactly as a user would. */
async function record(popup, action, keys) {
  await openPage(popup, PAGE_OF[action]);
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

  test('brightness steps down and up by 10% and shows the new value on the player', async ({ page, harness, openPopup }) => {
    const popup = await openPopup();
    await record(popup, 'brightnessDown', 'Alt+KeyN');
    await record(popup, 'brightnessUp', 'Alt+KeyM');
    await expect(popup.locator('.shortcut-btn[data-shortcut="brightnessDown"]')).toHaveText('Alt+N');
    await popup.close();

    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyN');
    await page.keyboard.press('Alt+KeyN');
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.8)');
    await expect(page.locator('#yte-osc .yte-toast')).toHaveText('Brightness 80%');
    await page.keyboard.press('Alt+KeyM');
    await expect.poll(async () => (await harness.get(['brightness'])).brightness).toBe(90);
  });

  test('colour steps stop at the ends of their range', async ({ page, harness }) => {
    await harness.set({ brightness: 145, bluelight: 5, shortcuts: { brightnessUp: 'Alt+M', bluelightDown: 'Alt+V' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyM');
    await page.keyboard.press('Alt+KeyV');
    await expect
      .poll(() => harness.get(['brightness', 'bluelight']))
      .toEqual({ brightness: 150, bluelight: 0 });
  });

  test('the blue light shortcut warms the picture and switches colour settings back on', async ({ page, harness }) => {
    await harness.set({ filtersEnabled: false, shortcuts: { bluelightUp: 'Alt+B' } });
    await openYoutube(page);
    expect(await styleOf(page, '#movie_player video', 'filter')).toBe('none');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyB');
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toContain('sepia(');
    expect(await harness.get(['bluelight', 'filtersEnabled'])).toEqual({ bluelight: 10, filtersEnabled: true });
    await expect(page.locator('#yte-osc .yte-toast')).toHaveText('Blue Light Filter 10%');
  });

  test('the speed shortcuts sit together and step the speed', async ({ page, harness, openPopup }) => {
    await harness.set({ speedStep: 0.25 });
    const popup = await openPopup();
    await record(popup, 'speedUp', 'Alt+KeyU');
    const pair = popup.locator('#page-speed .shortcut-pair');
    await expect(pair.locator('.shortcut-btn')).toHaveCount(2);
    await expect(pair.locator('.shortcut-btn[data-shortcut="speedUp"]')).toHaveText('Alt+U');
    await popup.close();

    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyU');
    await expect.poll(() => playbackRate(page)).toBe(1.25);
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
    await openPage(popup, 'crop');
    await popup.locator('.shortcut-clear-btn[data-shortcut="toggleCrop"]').click();
    await expect.poll(async () => (await harness.get(['shortcuts'])).shortcuts).toEqual({});
  });
});
