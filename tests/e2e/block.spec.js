import { test, expect, openYoutube, spaNavigate, openPage } from '../helpers/extension.js';

const BLOCKED = { name: 'Blocked Co' };

/**
 * The outermost card for a video, on any surface. Home lockups sit inside a
 * ytd-rich-item-renderer, which is the card there.
 */
const card = (page, videoId) =>
  page.locator(
    [
      `ytd-rich-item-renderer:has(yt-lockup-view-model[data-video="${videoId}"])`,
      `ytd-watch-next-secondary-results-renderer yt-lockup-view-model[data-video="${videoId}"]`,
      `ytd-video-renderer:has(a[href="/watch?v=${videoId}"])`,
      `a.ytp-videowall-still[href$="v=${videoId}"]`
    ].join(', ')
  );
const overlay = (page, videoId) => card(page, videoId).locator('> .yte-block-overlay');
const blockedList = async (harness) => (await harness.get(['blockedChannels'])).blockedChannels;

/** Rests the pointer on a thumbnail; YouTube then opens its hover preview over it. */
async function restOn(page, thumb) {
  const box = await thumb.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('ytd-video-preview')).toBeVisible();
}

/** Positions of every card, to prove blocking never moves anything. */
const layout = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('yt-lockup-view-model, ytd-video-renderer, .ytp-videowall-still')].map((n) => {
      const r = n.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    })
  );

test.describe('channel blocking', () => {
  test('the card button blocks a channel from the watch-page list', async ({ page, harness }) => {
    await openYoutube(page);
    const target = card(page, 'rel1');
    await target.hover();
    const button = target.locator('> .yte-block-btn');
    await expect(button).toHaveCSS('opacity', '1');
    await expect(button).toHaveAttribute('title', 'Block channel');
    await button.click();

    await expect(overlay(page, 'rel1')).toBeVisible();
    await expect(overlay(page, 'rel1')).toHaveText('🚫 Blocked channel');
    await expect(overlay(page, 'rel0')).toHaveCount(0);
    await expect(overlay(page, 'rel2')).toHaveCount(0);
    expect(await blockedList(harness)).toEqual([BLOCKED]);
  });

  for (const [surface, route, videoId] of [
    ['home', '/', 'home1'],
    ['search', '/results?search_query=x', 'search1']
  ]) {
    test(`on ${surface} YouTube's hover preview carries a button for the card under it`, async ({ page, harness }) => {
      await openYoutube(page, route);
      const target = card(page, videoId);
      const thumb = target.locator('a[href*="/watch"]').first();
      await restOn(page, thumb);

      // The preview covers the card's own button; its button takes the same spot.
      const button = page.locator('ytd-video-preview > .yte-block-btn');
      await expect(button).toHaveCSS('opacity', '1');
      await expect(button).toHaveAttribute('title', 'Block channel');
      expect(await button.boundingBox()).toEqual(await target.locator('> .yte-block-btn').boundingBox());
      // Playwright's click fails if anything else would take it.
      await button.click();
      await expect(overlay(page, videoId)).toBeVisible();
      expect(await blockedList(harness)).toEqual([expect.objectContaining(BLOCKED)]);

      // The preview is put away, so the black cover shows where it was.
      await expect(page.locator('ytd-video-preview')).toBeHidden();
      const topmost = await thumb.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).className;
      });
      expect(topmost).toBe('yte-block-overlay');
    });
  }

  test('a later preview shows again after one was put away', async ({ page }) => {
    await openYoutube(page, '/');
    await restOn(page, card(page, 'home1').locator('a.thumb'));
    await page.locator('ytd-video-preview > .yte-block-btn').click();
    await expect(page.locator('ytd-video-preview')).toBeHidden();

    await restOn(page, card(page, 'home0').locator('a.thumb'));
    await expect(page.locator('ytd-video-preview > .yte-block-btn')).toHaveCSS('opacity', '1');
  });

  test('previews outside recommendations get no button', async ({ page }) => {
    await openYoutube(page, '/feed/subscriptions');
    await restOn(page, page.locator('a.thumb').first());
    await page.mouse.move(...(await page.locator('ytd-video-preview').boundingBox().then((b) => [b.x + 20, b.y + 20])));
    await expect(page.locator('ytd-video-preview > .yte-block-btn')).toBeHidden();
  });

  test('the overlay is solid black, covers the whole card and moves nothing', async ({ page, harness }) => {
    await openYoutube(page);
    const before = await layout(page);
    await harness.set({ blockedChannels: [BLOCKED] });
    await expect(overlay(page, 'rel1')).toBeVisible();

    expect(await layout(page)).toEqual(before);
    await expect(overlay(page, 'rel1')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    const [cardBox, overlayBox] = [await card(page, 'rel1').boundingBox(), await overlay(page, 'rel1').boundingBox()];
    expect(overlayBox).toEqual(cardBox);
  });

  test('a covered video cannot be opened by clicking it', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page, '/');
    await expect(overlay(page, 'home1')).toBeVisible();
    const url = page.url();
    await card(page, 'home1').click({ position: { x: 40, y: 30 } });
    await card(page, 'home1').dblclick({ position: { x: 40, y: 30 } });
    await page.waitForTimeout(300);
    expect(page.url()).toBe(url);
  });

  test('a channel blocked by name is covered on home, search and the end screen', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [BLOCKED] });

    await openYoutube(page, '/');
    await expect(overlay(page, 'home1')).toBeVisible();
    await expect(overlay(page, 'home0')).toHaveCount(0);

    await openYoutube(page, '/results?search_query=x');
    await expect(overlay(page, 'search1')).toBeVisible();
    await expect(overlay(page, 'search2')).toHaveCount(0);

    await openYoutube(page);
    await page.evaluate(() => window.__fx.showEndscreen());
    await expect(overlay(page, 'end1')).toBeVisible();
    await expect(overlay(page, 'end0')).toHaveCount(0);
  });

  test('parts of the card YouTube lifts with z-index stay covered', async ({ page, harness }) => {
    // Real search results raise the channel row above the rest of the card.
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page, '/results?search_query=x');
    await expect(overlay(page, 'search1')).toBeVisible();
    const topmost = await page.evaluate(() => {
      const name = document.querySelectorAll('ytd-video-renderer ytd-channel-name')[1];
      const r = name.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).className;
    });
    expect(topmost).toBe('yte-block-overlay');
  });

  test('end-screen stills keep their own positioning', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page);
    await page.evaluate(() => window.__fx.showEndscreen());
    await expect(overlay(page, 'end1')).toBeVisible();
    await expect(card(page, 'end1')).toHaveCSS('position', 'absolute');
    await expect(card(page, 'end1')).toHaveCSS('left', '200px');
  });

  test('blocking from search remembers the handle and channel ID too', async ({ page, harness }) => {
    await openYoutube(page, '/results?search_query=x');
    await card(page, 'search1').hover();
    await card(page, 'search1').locator('> .yte-block-btn').click();
    expect(await blockedList(harness)).toEqual([
      { name: 'Blocked Co', handle: '@blockedco', id: 'UCbbbbbbbbbbbbbbbbbbbbbb' }
    ]);
  });

  test('a channel blocked by handle is still covered after renaming', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [{ name: 'Old Name', handle: '@blockedco' }] });
    await openYoutube(page, '/');
    await expect(overlay(page, 'home1')).toBeVisible();
  });

  test('cards YouTube recycles for another channel are uncovered and covered again', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page);
    await expect(overlay(page, 'rel1')).toBeVisible();

    const rename = (name) =>
      page.evaluate((n) => {
        document.querySelector('[data-video="rel1"] yt-content-metadata-view-model span').textContent = n;
      }, name);
    await rename('Channel Z');
    await expect(overlay(page, 'rel1')).toHaveCount(0);
    await rename('Blocked Co');
    await expect(overlay(page, 'rel1')).toBeVisible();
  });

  test('cards that name no channel (Shorts) get no block button', async ({ page }) => {
    await openYoutube(page, '/');
    await expect(page.locator('ytm-shorts-lockup-view-model-v2 .yte-block-btn')).toHaveCount(0);
    await expect(card(page, 'home0').locator('> .yte-block-btn')).toHaveCount(1);
  });

  test('pages that are not recommendations are left alone', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page, '/feed/subscriptions');
    await page.waitForTimeout(500);
    await expect(page.locator('.yte-block-overlay')).toHaveCount(0);
    await expect(page.locator('.yte-block-btn')).toHaveCount(0);
  });

  test('cards streamed in after in-app navigation are covered', async ({ page, harness }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page, '/feed/subscriptions');
    await spaNavigate(page, '/');
    await expect(overlay(page, 'home1')).toBeVisible();
  });

  test('the popup lists blocked channels and unblocks them live', async ({ page, harness, openPopup }) => {
    await harness.set({ blockedChannels: [BLOCKED, { name: 'Channel C', handle: '@channelc' }] });
    await openYoutube(page);
    await expect(overlay(page, 'rel1')).toBeVisible();

    const popup = await openPopup();
    await openPage(popup, 'channels');
    const rows = popup.locator('#blocked-list .blocked-item');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('span')).toHaveText('Blocked Co');
    await expect(popup.locator('#blocked-empty')).toBeHidden();

    await rows.first().locator('button').click();
    await expect(rows).toHaveCount(1);
    await expect(overlay(page, 'rel1')).toHaveCount(0);
    await expect(overlay(page, 'rel2')).toBeVisible();
    expect(await blockedList(harness)).toEqual([{ name: 'Channel C', handle: '@channelc' }]);
  });

  test('a channel blocked while the popup is open shows up in its list', async ({ page, openPopup }) => {
    await openYoutube(page);
    const popup = await openPopup();
    await openPage(popup, 'channels');
    await expect(popup.locator('#blocked-empty')).toBeVisible();

    await card(page, 'rel1').hover();
    await card(page, 'rel1').locator('> .yte-block-btn').click();
    await expect(popup.locator('#blocked-list .blocked-item span')).toHaveText(['Blocked Co']);

    // A later popup change must not bring the old, empty list back.
    await openPage(popup, 'colour');
    await popup.locator('label:has(#invert)').click();
    await page.waitForTimeout(500);
    await expect(overlay(page, 'rel1')).toBeVisible();
  });

  test('the overlay and button follow the chosen language', async ({ page, harness, openPopup }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    await openYoutube(page);
    const popup = await openPopup();
    await openPage(popup, 'language');
    await popup.locator('.lang-btn[data-lang="tr"]').click();
    await expect(overlay(page, 'rel1')).toHaveText('🚫 Engellenen kanal');
    await expect(card(page, 'rel0').locator('> .yte-block-btn')).toHaveAttribute('title', 'Kanalı engelle');
  });

  test('reset defaults keeps the blocked channels', async ({ harness, openPopup }) => {
    await harness.set({ blockedChannels: [BLOCKED] });
    const popup = await openPopup();
    await popup.locator('#reset').click();
    await popup.waitForTimeout(400);
    expect(await blockedList(harness)).toEqual([BLOCKED]);
  });
});
