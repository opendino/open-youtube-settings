/**
 * The Firefox package in Firefox, on the fixture app. Focused on what can
 * differ from Chromium: the MAIN-world page bridge, events crossing from the
 * content script into the page, Firefox's tabs/storage APIs behind the popup,
 * keyboard handling and mozCaptureStream-based clip recording.
 */

import fs from 'fs';
import path from 'path';
import {
  test,
  expect,
  openYoutube,
  spaNavigate,
  styleOf,
  isDisplayed,
  playbackRate,
  sleep
} from '../helpers/firefox.js';

const youtubeRate = (page) => page.evaluate(() => window.__fx.youtubeRate());
const stored = async (harness, key) => (await harness.get([key]))[key];

/** Presses a key combination on the page with real (trusted) key events. */
async function press(page, modifiers, key) {
  for (const m of modifiers) await page.keyboard.down(m);
  await page.keyboard.press(key);
  for (const m of [...modifiers].reverse()) await page.keyboard.up(m);
}

test.describe('Firefox: speed', () => {
  test('default speed reaches the video and YouTube’s own player through the bridge', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page);
    await expect.poll(() => playbackRate(page)).toBe(1.5);
    expect(await youtubeRate(page)).toBe(1.5);
  });

  test('YouTube’s speed-up shortcut steps up from the extension’s speed', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page);
    await expect.poll(() => youtubeRate(page)).toBe(1.5);
    await page.evaluate(() => window.__fx.youtubeStep(1));
    await expect.poll(() => playbackRate(page)).toBe(1.75);
    await expect.poll(() => stored(harness, 'lastSpeed')).toBe(1.75);
  });

  test('the default speed survives an ad break on the next video', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5, speedPersist: false });
    await openYoutube(page);
    await page.evaluate(() => window.__fx.youtubeSetRate(0.75));
    await expect.poll(() => playbackRate(page)).toBe(0.75);

    await spaNavigate(page, '/watch?v=fixture2', { ad: true });
    await sleep(300);
    await page.evaluate(() => window.__fx.endAd());
    await sleep(2500);
    expect(await playbackRate(page)).toBe(1.5);
    expect(await stored(harness, 'lastSpeed')).toBe(1.5);
  });

  test('rates beyond 2× stick', async ({ page, harness }) => {
    await harness.set({ speedDefault: 2.5, lastSpeed: 2.5 });
    await openYoutube(page);
    await expect.poll(() => playbackRate(page)).toBe(2.5);
    await sleep(2500);
    expect(await playbackRate(page)).toBe(2.5);
  });

  test('player chip steps the speed', async ({ page, harness }) => {
    await harness.set({ speedStep: 0.1 });
    await openYoutube(page);
    await page.hover('#movie_player');
    for (let i = 0; i < 3; i++) await page.click('#yte-osc .yte-speed .yte-step:last-of-type');
    await expect.poll(() => playbackRate(page)).toBe(1.3);
    expect(await page.$eval('#yte-osc .yte-speed-value', (n) => n.textContent)).toBe('1.30×');
  });

  test('applies the speed to Shorts', async ({ page, harness }) => {
    await harness.set({ speedDefault: 1.5, lastSpeed: 1.5 });
    await openYoutube(page, '/shorts/abc');
    await expect
      .poll(() => page.evaluate(() => document.querySelector('#shorts-player video').playbackRate))
      .toBe(1.5);
  });
});

test.describe('Firefox: page styling', () => {
  test('colour filter chain', async ({ page, harness }) => {
    await harness.set({ brightness: 70, bluelight: 50, invert: true });
    await openYoutube(page);
    const filter = await styleOf(page, '#movie_player video', 'filter');
    expect(filter).toContain('brightness(0.7)');
    expect(filter).toContain('invert(1)');
  });

  test('storage changes apply live', async ({ page, harness }) => {
    await openYoutube(page);
    await harness.set({ brightness: 130 });
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(1.3)');
  });

  test('Shorts opt-out', async ({ page, harness }) => {
    await harness.set({ brightness: 60, applyToShorts: false });
    await openYoutube(page, '/shorts/abc');
    expect(await styleOf(page, '#shorts-player video', 'filter')).toBe('none');
  });

  test('sidebar hides, and a user-opened panel brings the column back', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true });
    await openYoutube(page);
    expect(await isDisplayed(page, '#secondary')).toBe(false);
    await page.evaluate(() =>
      window.__fx.setPanel('engagement-panel-macro-markers-description-chapters', true)
    );
    await expect.poll(() => isDisplayed(page, '#secondary')).toBe(true);
    expect(await isDisplayed(page, 'ytd-watch-next-secondary-results-renderer')).toBe(false);
  });

  test('focus mode hides the home feed', async ({ page, harness }) => {
    await harness.set({ hideHome: true });
    await openYoutube(page, '/');
    expect(await isDisplayed(page, 'ytd-browse[page-subtype="home"] #contents')).toBe(false);
  });

  test('crop scales the video', async ({ page, harness }) => {
    await harness.set({ cropEnabled: true, cropZoom: 150 });
    await openYoutube(page);
    expect(await styleOf(page, '#movie_player video', 'transform')).toBe('matrix(1.5, 0, 0, 1.5, 0, 0)');
  });

  test('channel pages open on the Videos tab', async ({ page, harness }) => {
    await harness.set({ channelAutoVideos: true });
    await page.goto('https://www.youtube.com/@somechannel');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/@somechannel/videos');
  });
});

test.describe('Firefox: popup', () => {
  test('a slider change reaches the open YouTube tab', async ({ page, openPopup }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await popup.slide('brightness', 60);
    expect((await popup.read('#brightness-val')).text).toBe('60%');
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.6)');
  });

  test('changing another setting keeps the default speed just picked', async ({ page, openPopup }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await popup.slide('speed-default', 1.5);
    await expect.poll(() => playbackRate(page)).toBe(1.5);
    await popup.slide('brightness', 90);
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toBe('brightness(0.9)');
    await sleep(500);
    expect(await playbackRate(page)).toBe(1.5);
  });

  test('switching language translates the on-page text', async ({ page, harness, openPopup }) => {
    await harness.set({ hideHome: true });
    await openYoutube(page, '/');
    const popup = await openPopup();
    await popup.click('.lang-btn[data-lang="tr"]');
    await expect.poll(async () => (await popup.read('.tab-btn[data-tab="settings"]')).text).not.toBe('Settings');
    const tr = JSON.parse(fs.readFileSync(path.resolve('_locales/tr/messages.json'), 'utf8'));
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.querySelector('ytd-browse'), '::before').content)
      )
      .toBe(JSON.stringify(tr.focusMode.message));
  });

  test('reset defaults then cancel leaves popup and storage in agreement', async ({ harness, openPopup }) => {
    await harness.set({ hideSkipAnim: true, brightness: 70 });
    const popup = await openPopup();
    await popup.click('#reset');
    expect((await popup.read('#modal-overlay')).className).toContain('active');
    await popup.click('#modal-cancel');
    expect((await popup.read('#brightness')).value).toBe(String(await stored(harness, 'brightness')));
  });

  test('a shortcut recorded in the popup works on the page', async ({ page, harness, openPopup }) => {
    const popup = await openPopup();
    await popup.click('.shortcut-btn[data-shortcut="toggleInvert"]');
    await popup.key({ key: 'i', code: 'KeyI', altKey: true });
    await expect.poll(() => stored(harness, 'shortcuts')).toEqual({ toggleInvert: 'Alt+I' });

    await openYoutube(page);
    await page.click('body');
    await press(page, ['Alt'], 'KeyI');
    await expect.poll(() => styleOf(page, '#movie_player video', 'filter')).toContain('invert(1)');
  });
});

test.describe('Firefox: keyboard and clips', () => {
  test('speed shortcuts', async ({ page, harness }) => {
    await harness.set({ shortcuts: { speedUp: 'Shift+W' }, speedStep: 0.25 });
    await openYoutube(page);
    await page.click('body');
    await press(page, ['Shift'], 'KeyW');
    await expect.poll(() => playbackRate(page)).toBe(1.25);
  });

  test('a marked range is recorded and downloaded', async ({ page, harness, firefox }) => {
    await harness.set({ shortcuts: { clipToggle: 'Alt+K' } });
    await openYoutube(page);
    await page.click('body');
    await press(page, ['Alt'], 'KeyK');
    await page.waitForSelector('#yte-osc .yte-clip', { visible: true });

    const seek = (t) =>
      page.evaluate(async (time) => {
        const v = document.querySelector('#movie_player video');
        v.pause();
        v.currentTime = time;
        await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      }, t);
    const buttons = await page.$$('#yte-osc .yte-clip .yte-row button');
    await seek(2);
    await buttons[0].click();
    await seek(3.5);
    await buttons[1].click();
    await buttons[3].click();

    await expect
      .poll(() => page.$eval('#yte-osc .yte-toast', (n) => n.textContent), { timeout: 15000 })
      .toMatch(/Clip saved|Clip capture failed/);
    expect(await page.$eval('#yte-osc .yte-toast', (n) => n.textContent)).toBe('Clip saved');
    await expect
      .poll(() => (fs.existsSync(firefox.downloads) ? fs.readdirSync(firefox.downloads) : []), { timeout: 10000 })
      .toContain('yt-fixture1-2-3.webm');
  });
});

test.describe('Firefox: mute ads', () => {
  const sound = (page) =>
    page.evaluate(() => {
      const video = document.querySelector('#movie_player video');
      return { muted: video.muted, volume: video.volume, youtubeMuted: window.__fx.youtubeMuted() };
    });
  const fx = (page, call) => page.evaluate((c) => window.__fx[c](), call);

  test('mutes an ad break through the bridge and gives the sound back at the same volume', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await page.evaluate(() => (document.querySelector('#movie_player video').volume = 0.4));
    await fx(page, 'startAd');
    await expect.poll(() => sound(page)).toEqual({ muted: true, volume: 0.4, youtubeMuted: true });
    await fx(page, 'nextAdInBreak');
    await sleep(300);
    expect((await sound(page)).muted).toBe(true);
    await fx(page, 'endAd');
    await expect.poll(() => sound(page)).toEqual({ muted: false, volume: 0.4, youtubeMuted: false });
  });

  test('a user who was already muted stays muted', async ({ page, harness }) => {
    await harness.set({ muteAds: true });
    await openYoutube(page);
    await fx(page, 'youtubeToggleMute');
    await fx(page, 'startAd');
    await sleep(300);
    await fx(page, 'endAd');
    await sleep(300);
    expect((await sound(page)).muted).toBe(true);
  });

  test('ads keep their sound while the option is off', async ({ page }) => {
    await openYoutube(page);
    await fx(page, 'startAd');
    await sleep(500);
    expect((await sound(page)).muted).toBe(false);
  });

  test('the popup toggle reads “Reklamları Sessize Al” in Turkish and switches it on', async ({
    page,
    harness,
    openPopup
  }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await popup.click('.lang-btn[data-lang="tr"]');
    await expect.poll(async () => (await popup.read('[data-i18n="muteAds"]')).text).toBe('Reklamları Sessize Al');
    await popup.click('#mute-ads');
    await expect.poll(() => stored(harness, 'muteAds')).toBe(true);
    await fx(page, 'startAd');
    await expect.poll(async () => (await sound(page)).muted).toBe(true);
  });
});
