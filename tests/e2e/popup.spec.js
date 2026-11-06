import {
  test,
  expect,
  openYoutube,
  styleOf,
  playbackRate,
  openPage
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
    await openPage(popup, 'speed');
    await slide(popup, 'speed-default', 1.5);
    await expect.poll(() => playbackRate(page)).toBe(1.5);

    await openPage(popup, 'colour');
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
    await openPage(popup, 'speed');
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
    await openPage(popup, 'language');
    await popup.locator('.lang-btn[data-lang="tr"]').click();
    await expect(popup.locator('.card[data-page="colour"] .card-title')).toHaveText('Renk');

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
    await openPage(popup, 'layout');
    await popup.locator('label:has(#hide-sidebar)').click();
    await expect(popup.locator('#hide-playlist')).toBeEnabled();
  });

  test('the crop fit choice is stored, shown and greyed out with the crop tool', async ({ harness, openPopup }) => {
    const popup = await openPopup();
    await openPage(popup, 'crop');
    const contain = popup.locator('.crop-fit[data-fit="contain"]');
    const cover = popup.locator('.crop-fit[data-fit="cover"]');
    await expect(contain).toHaveClass(/active/);
    await cover.click();
    await expect(cover).toHaveClass(/active/);
    await expect(contain).not.toHaveClass(/active/);
    await expect.poll(async () => (await harness.get(['cropFit'])).cropFit).toBe('cover');

    await popup.locator('label:has(#crop-tool)').click();
    await expect.poll(async () => (await harness.get(['cropTool'])).cropTool).toBe(false);
    await expect(cover).toBeDisabled();
  });

  test('no console errors while using the popup', async ({ openPopup }) => {
    const errors = [];
    const popup = await openPopup();
    popup.on('pageerror', (e) => errors.push(e.message));
    popup.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    for (const name of ['colour', 'speed', 'layout', 'ads', 'clip', 'crop', 'channels', 'language']) {
      await openPage(popup, name);
    }
    await slide(popup, 'brightness', 80);
    await popup.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
});

test.describe('popup home', () => {
  test('each card sums up its feature', async ({ harness, openPopup }) => {
    await harness.set({
      brightness: 85,
      speedDefault: 1.5,
      hideHome: true,
      hideSidebar: true,
      muteAds: true,
      clipEnabled: false,
      blockedChannels: [{ name: 'A' }, { name: 'B' }]
    });
    const popup = await openPopup();
    const status = (name) => popup.locator(`.card[data-page="${name}"] .card-status`);
    await expect(status('colour')).toHaveText('☀ 85%');
    await expect(status('speed')).toHaveText('1.5× default');
    await expect(status('layout')).toHaveText('2 on');
    await expect(status('ads')).toHaveText('Muting ads');
    await expect(status('clip')).toHaveText('Off');
    await expect(status('crop')).toHaveText('On');
    await expect(status('channels')).toHaveText('2 blocked');
    await expect(popup.locator('.card[data-page="clip"]')).not.toHaveClass(/\bon\b/);
    await expect(popup.locator('.card[data-page="ads"]')).toHaveClass(/\bon\b/);
  });

  test('a card status follows a change made on its page', async ({ openPopup }) => {
    const popup = await openPopup();
    await openPage(popup, 'ads');
    await popup.locator('label:has(#mute-ads)').click();
    await popup.locator('#page-ads .back-btn').click();
    await expect(popup.locator('.card[data-page="ads"] .card-status')).toHaveText('Muting ads');
  });

  test('a card opens its page and back returns to the cards', async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.locator('.card[data-page="speed"]').click();
    await expect(popup.locator('#page-speed')).toBeVisible();
    await expect(popup.locator('.cards')).toBeHidden();
    await expect(popup.locator('#page-colour')).toBeHidden();
    await popup.locator('#page-speed .back-btn').click();
    await expect(popup.locator('.cards')).toBeVisible();
    await expect(popup.locator('#page-speed')).toBeHidden();
  });

  test('the footer shows the language and opens the language page', async ({ harness, openPopup }) => {
    await harness.set({ language: 'de' });
    const popup = await openPopup();
    await expect(popup.locator('#lang-name')).toHaveText('Deutsch');
    await popup.locator('.foot-btn[data-page="language"]').click();
    await expect(popup.locator('.lang-btn[data-lang="de"]')).toHaveClass(/active/);
  });

  for (const [ui, lang, dir] of [
    ['tr-TR', 'tr', 'ltr'],
    ['zh-HK', 'zh_TW', 'ltr'],
    ['pt-PT', 'pt_BR', 'ltr'],
    ['ar-EG', 'ar', 'rtl'],
    ['sv-SE', 'en', 'ltr']
  ]) {
    test(`with no language chosen, a ${ui} browser opens the popup in ${lang}`, async ({ context, extension, harness }) => {
      await harness.set({ introSeen: true });
      const popup = await context.newPage();
      await popup.addInitScript((value) => {
        chrome.i18n.getUILanguage = () => value;
      }, ui);
      await popup.goto(`chrome-extension://${extension.id}/popup.html`);
      await expect(popup.locator(`.lang-btn[data-lang="${lang}"]`)).toHaveClass(/active/);
      await expect(popup.locator('html')).toHaveAttribute('dir', dir);
      // Following the browser is not a choice; nothing is saved.
      expect((await harness.get(['language'])).language).toBeUndefined();
    });
  }

  test('search lists matching settings from every page, descriptions included', async ({ openPopup }) => {
    const popup = await openPopup();
    const search = popup.locator('#search');

    await search.fill('shorts');
    await expect(popup.locator('#page-colour')).toBeVisible();
    await expect(popup.locator('#apply-to-shorts')).toBeAttached();
    await expect(popup.locator('#page-colour .row:has(#apply-to-shorts)')).toBeVisible();
    await expect(popup.locator('#page-colour .row:has(#brightness)')).toBeHidden();
    await expect(popup.locator('#page-speed')).toBeHidden();
    await expect(popup.locator('.cards')).toBeHidden();

    // Words that only appear in a description find the setting too.
    await search.fill('whiteboard');
    await expect(popup.locator('#page-colour .row:has(#invert)')).toBeVisible();

    // A page's own name lists the whole page.
    await search.fill('clip tool');
    await expect(popup.locator('#page-clip .row:has(#clip-enabled)')).toBeVisible();
    await expect(popup.locator('#page-clip .row:has([data-shortcut="clipSave"])')).toBeVisible();

    // A group title lists the rows under it: every shortcut, page by page.
    await search.fill('shortcuts');
    for (const action of ['speedUp', 'clipSave', 'toggleCrop']) {
      await expect(popup.locator(`.row:has([data-shortcut="${action}"])`)).toBeVisible();
    }

    await search.fill('zzzz');
    await expect(popup.locator('#search-empty')).toBeVisible();

    await search.press('Escape');
    await expect(search).toHaveValue('');
    await expect(popup.locator('.cards')).toBeVisible();
  });

  test('search works in the chosen language', async ({ harness, openPopup }) => {
    await harness.set({ language: 'tr' });
    const popup = await openPopup();
    await popup.locator('#search').fill('REKLAMLARI');
    await expect(popup.locator('#page-ads .row:has(#mute-ads)')).toBeVisible();
  });

  test('the info button shows and hides a description', async ({ openPopup }) => {
    const popup = await openPopup();
    await openPage(popup, 'colour');
    const row = popup.locator('#page-colour .row:has(#invert)');
    await expect(row.locator('.hint')).toBeHidden();
    await row.locator('.info-btn').click();
    await expect(row.locator('.hint')).toBeVisible();
    await expect(row.locator('.info-btn')).toHaveAttribute('aria-expanded', 'true');
    await row.locator('.info-btn').click();
    await expect(row.locator('.hint')).toBeHidden();
  });

  test('a setting row records its own shortcut; the clear button shows only when set', async ({ harness, openPopup }) => {
    const popup = await openPopup();
    await openPage(popup, 'layout');
    const button = popup.locator('.shortcut-btn[data-shortcut="toggleHome"]');
    const clear = popup.locator('.shortcut-clear-btn[data-shortcut="toggleHome"]');
    await expect(button.locator('svg')).toBeVisible();
    await expect(clear).toBeHidden();

    await button.click();
    await popup.keyboard.press('Alt+KeyH');
    await expect(button).toHaveText('Alt+H');
    await expect(clear).toBeVisible();
    expect((await harness.get(['shortcuts'])).shortcuts).toEqual({ toggleHome: 'Alt+H' });

    await clear.click();
    await expect(clear).toBeHidden();
    await expect(button.locator('svg')).toBeVisible();
  });

  test('the colour switch greys out the colour sliders', async ({ openPopup }) => {
    const popup = await openPopup();
    await openPage(popup, 'colour');
    await expect(popup.locator('#brightness')).toBeEnabled();
    await popup.locator('label:has(#filters-enabled)').click();
    await expect(popup.locator('#brightness')).toBeDisabled();
    await expect(popup.locator('.card[data-page="colour"] .card-status')).toHaveText('Off');
  });
});

test.describe('first-run tour', () => {
  test('walks through three steps once, then stays away', async ({ harness, openPopup }) => {
    const popup = await openPopup({ intro: true });
    const intro = popup.locator('#intro');
    await expect(intro).toBeVisible();
    await expect(intro.locator('.intro-step:not([hidden]) h3')).toHaveText('New buttons on the player');
    await popup.locator('#intro-next').click();
    await expect(intro.locator('.intro-step:not([hidden]) h3')).toHaveText('Block a channel in one click');
    await popup.locator('#intro-next').click();
    await expect(popup.locator('#intro-next')).toHaveText('Get started');
    await popup.locator('#intro-next').click();
    await expect(intro).toBeHidden();
    expect((await harness.get(['introSeen'])).introSeen).toBe(true);

    await popup.reload();
    await popup.waitForFunction(() => document.querySelector('.lang-btn.active'));
    await expect(intro).toBeHidden();
  });

  test('can be skipped, and speaks the chosen language', async ({ harness, openPopup }) => {
    await harness.set({ language: 'tr' });
    const popup = await openPopup({ intro: true });
    await expect(popup.locator('#intro .intro-step:not([hidden]) h3')).toHaveText('Oynatıcıda yeni düğmeler');
    await expect(popup.locator('#intro-next')).toHaveText('İleri');
    await popup.locator('#intro-skip').click();
    await expect(popup.locator('#intro')).toBeHidden();
    expect((await harness.get(['introSeen'])).introSeen).toBe(true);
  });
});

test.describe('appearance', () => {
  const base = (popup) => popup.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const LIGHT = 'rgb(238, 240, 246)';
  const DARK = 'rgb(10, 11, 16)';

  test('automatic follows the browser, and a pick pins it and is remembered', async ({ harness, openPopup }) => {
    const popup = await openPopup();
    await popup.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => base(popup)).toBe(DARK);
    await popup.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => base(popup)).toBe(LIGHT);

    await popup.locator('#theme-btn').click();
    await expect(popup.locator('#theme-menu')).toBeVisible();
    await expect(popup.locator('#theme-menu [data-theme-choice="auto"]')).toHaveAttribute('aria-checked', 'true');
    await popup.locator('#theme-menu [data-theme-choice="dark"]').click();
    await expect(popup.locator('#theme-menu')).toBeHidden();
    await expect.poll(() => base(popup)).toBe(DARK);
    await expect.poll(async () => (await harness.get(['theme'])).theme).toBe('dark');

    await popup.reload();
    await popup.waitForFunction(() => document.querySelector('.lang-btn.active'));
    await expect.poll(() => base(popup)).toBe(DARK);
    await expect(popup.locator('[data-theme-icon="dark"]')).toBeVisible();

    // Light holds even when the browser asks for dark.
    await popup.emulateMedia({ colorScheme: 'dark' });
    await popup.locator('#theme-btn').click();
    await popup.locator('#theme-menu [data-theme-choice="light"]').click();
    await expect.poll(() => base(popup)).toBe(LIGHT);
  });

  test('the menu closes on Escape and on a click elsewhere', async ({ openPopup }) => {
    const popup = await openPopup();
    const menu = popup.locator('#theme-menu');
    await popup.locator('#theme-btn').click();
    await popup.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await popup.locator('#theme-btn').click();
    await popup.locator('.topbar h1').click();
    await expect(menu).toBeHidden();
  });

  test('the menu speaks the chosen language', async ({ harness, openPopup }) => {
    await harness.set({ language: 'tr' });
    const popup = await openPopup();
    await popup.locator('#theme-btn').click();
    await expect(popup.locator('#theme-menu')).toContainText('Otomatik');
    await expect(popup.locator('#theme-menu')).toContainText('Koyu');
    await expect(popup.locator('#theme-btn')).toHaveAttribute('title', 'Görünüm');
  });
});
