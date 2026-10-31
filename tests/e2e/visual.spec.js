import { test, expect, openYoutube, spaNavigate, styleOf, isDisplayed } from '../helpers/extension.js';

const MAIN_VIDEO = '#movie_player video';
const SHORTS_VIDEO = '#shorts-player video';

test.describe('colour filters', () => {
  test('no filter at all with default settings', async ({ page }) => {
    await openYoutube(page);
    expect(await styleOf(page, MAIN_VIDEO, 'filter')).toBe('brightness(1)');
  });

  test('brightness, blue light and invert build one filter chain', async ({ page, harness }) => {
    await harness.set({ brightness: 70, bluelight: 50, invert: true });
    await openYoutube(page);
    const filter = await styleOf(page, MAIN_VIDEO, 'filter');
    expect(filter).toContain('brightness(0.7)');
    expect(filter).toContain('sepia(0.425)');
    expect(filter).toContain('invert(1)');
  });

  test('changes made in storage apply live', async ({ page, harness }) => {
    await openYoutube(page);
    await harness.set({ brightness: 130 });
    await expect.poll(() => styleOf(page, MAIN_VIDEO, 'filter')).toBe('brightness(1.3)');
  });

  test('Shorts can opt out of the filter', async ({ page, harness }) => {
    await harness.set({ brightness: 60, applyToShorts: false });
    await openYoutube(page, '/shorts/abc');
    expect(await styleOf(page, SHORTS_VIDEO, 'filter')).toBe('none');
  });

  test('Shorts get the filter by default', async ({ page, harness }) => {
    await harness.set({ brightness: 60 });
    await openYoutube(page, '/shorts/abc');
    expect(await styleOf(page, SHORTS_VIDEO, 'filter')).toBe('brightness(0.6)');
  });
});

test.describe('layout', () => {
  test('focus mode hides the home feed and explains why', async ({ page, harness }) => {
    await harness.set({ hideHome: true });
    await openYoutube(page, '/');
    expect(await isDisplayed(page, 'ytd-browse[page-subtype="home"] #contents')).toBe(false);
    const message = await page.evaluate(
      () => getComputedStyle(document.querySelector('ytd-browse[page-subtype="home"]'), '::before').content
    );
    expect(message).toContain('Focus mode');
  });

  test('hiding the sidebar hides related videos and widens the player column', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true });
    await openYoutube(page);
    expect(await isDisplayed(page, '#secondary')).toBe(false);
    expect(await styleOf(page, '#primary', 'maxWidth')).toBe('100%');
  });

  test('a panel the user opens brings the side column back without related videos', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true, allowPanels: true });
    await openYoutube(page);
    await page.evaluate(() =>
      window.__fx.setPanel('engagement-panel-macro-markers-description-chapters', true)
    );
    await expect.poll(() => isDisplayed(page, '#secondary')).toBe(true);
    expect(await isDisplayed(page, 'ytd-watch-next-secondary-results-renderer')).toBe(false);

    await page.evaluate(() =>
      window.__fx.setPanel('engagement-panel-macro-markers-description-chapters', false)
    );
    await expect.poll(() => isDisplayed(page, '#secondary')).toBe(false);
  });

  test('YouTube’s own always-expanded ads panel does not reveal the column', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true });
    await openYoutube(page);
    await page.waitForTimeout(2200);
    expect(await isDisplayed(page, '#secondary')).toBe(false);
  });

  test('a playlist the user keeps stays visible', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true, hidePlaylist: false });
    await openYoutube(page, '/watch?v=fixture1&list=PL1');
    expect(await isDisplayed(page, '#secondary')).toBe(true);
    expect(await isDisplayed(page, 'ytd-playlist-panel-renderer')).toBe(true);
    expect(await isDisplayed(page, 'ytd-watch-next-secondary-results-renderer')).toBe(false);
  });

  test('the playlist hides with the sidebar by default', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true });
    await openYoutube(page, '/watch?v=fixture1&list=PL1');
    expect(await isDisplayed(page, '#secondary')).toBe(false);
  });

  test('the column state follows in-app navigation into and out of a playlist', async ({ page, harness }) => {
    await harness.set({ hideSidebar: true, hidePlaylist: false });
    await openYoutube(page);
    expect(await isDisplayed(page, '#secondary')).toBe(false);
    await spaNavigate(page, '/watch?v=fixture2&list=PL1');
    await expect.poll(() => isDisplayed(page, '#secondary')).toBe(true);
    await spaNavigate(page, '/watch?v=fixture3');
    await expect.poll(() => isDisplayed(page, '#secondary')).toBe(false);
  });

  test('auto-hide controls fades the control bar', async ({ page, harness }) => {
    await harness.set({ autoHideControls: true });
    await openYoutube(page);
    await expect.poll(() => styleOf(page, '.ytp-chrome-bottom', 'opacity')).toBe('0');
  });

  test('hide play/pause animation removes the bezel', async ({ page, harness }) => {
    await harness.set({ hidePlayPause: true });
    await openYoutube(page);
    expect(await isDisplayed(page, '.ytp-bezel')).toBe(false);
  });

  test('skip animation indicators are hidden as they appear', async ({ page, harness }) => {
    await harness.set({ hideSkipAnim: true });
    await openYoutube(page);
    await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.className = 'ytp-doubletap-ui-legacy';
      wrap.innerHTML = '<div class="ytp-doubletap-tooltip"><span>+ 5</span></div>';
      document.querySelector('#movie_player').appendChild(wrap);
    });
    await expect.poll(() => isDisplayed(page, '.ytp-doubletap-ui-legacy')).toBe(false);
    // The control bar is never touched.
    expect(await isDisplayed(page, '.ytp-chrome-bottom')).toBe(true);
  });
});

test.describe('channel redirect', () => {
  for (const route of ['/@somechannel', '/@somechannel/featured', '/channel/UC123', '/c/name/']) {
    test(`${route} opens on the Videos tab`, async ({ page, harness }) => {
      await harness.set({ channelAutoVideos: true });
      await page.goto(`https://www.youtube.com${route}`);
      const base = route.replace(/\/featured$/, '').replace(/\/$/, '');
      await page.waitForURL(`https://www.youtube.com${base}/videos`);
    });
  }

  test('stays put when disabled', async ({ page }) => {
    await openYoutube(page, '/@somechannel');
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe('/@somechannel');
  });
});
