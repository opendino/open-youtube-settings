import { test, expect, openYoutube, spaNavigate } from '../helpers/extension.js';

const CROP_BUTTON = '.ytp-right-controls-left > .yte-ctl-crop';
const LAYER = '#yte-osc .yte-crop-layer';

/** Drags a box over the player, given as fractions of the player's size. */
async function dragBox(page, [x0, y0, x1, y1]) {
  const p = await page.locator('#movie_player').boundingBox();
  await page.mouse.move(p.x + x0 * p.width, p.y + y0 * p.height);
  await page.mouse.down();
  await page.mouse.move(p.x + ((x0 + x1) / 2) * p.width, p.y + ((y0 + y1) / 2) * p.height, { steps: 4 });
  await page.mouse.move(p.x + x1 * p.width, p.y + y1 * p.height, { steps: 4 });
  await page.mouse.up();
}

/**
 * Where the visible part of the video lands in the player, and where a box
 * of the uncropped video (fractions of it) ends up, read back from the
 * transform and clip-path actually applied.
 */
const cropGeometry = (page, box) =>
  page.evaluate((box) => {
    const player = document.querySelector('#movie_player');
    const video = player.querySelector('video');
    const cs = getComputedStyle(video);
    const m = cs.transform === 'none' ? [1, 0, 0, 1, 0, 0] : cs.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
    const [s, , , , tx, ty] = m;
    const pr = player.getBoundingClientRect();
    const vr = { x: video.offsetLeft, y: video.offsetTop, w: video.offsetWidth, h: video.offsetHeight };
    const map = (x, y) => [vr.x + tx + s * x, vr.y + ty + s * y];
    const inset = cs.clipPath === 'none' ? [0, 0, 0, 0] : cs.clipPath.match(/inset\(([^)]+)\)/)[1].split(' ').map(parseFloat);
    while (inset.length < 4) inset.push(inset[inset.length === 1 ? 0 : inset.length - 2]);
    const [t, r, b, l] = inset;
    const [cx0, cy0] = map(l, t);
    const [cx1, cy1] = map(vr.w - r, vr.h - b);
    const [bx0, by0] = map(box[0] * vr.w, box[1] * vr.h);
    const [bx1, by1] = map(box[2] * vr.w, box[3] * vr.h);
    const round = (a) => a.map((n) => Math.round(n));
    return {
      player: round([0, 0, pr.width, pr.height]),
      visible: round([cx0, cy0, cx1, cy1]),
      box: round([bx0, by0, bx1, by1]),
      paused: video.paused
    };
  }, box);

test.describe('crop', () => {
  test('the crop button sits after the clip button and starts a selection while the video plays', async ({ page }) => {
    await openYoutube(page);
    const order = await page.evaluate(() =>
      [...document.querySelector('.ytp-right-controls-left').children].map((n) => n.className.split(' ').pop())
    );
    expect(order.slice(1)).toEqual(['yte-ctl-speed', 'yte-ctl-clip', 'yte-ctl-crop', 'ytp-settings-button']);
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('title', 'Crop video');

    await page.locator(CROP_BUTTON).click();
    await expect(page.locator(LAYER)).toBeVisible();
    await expect(page.locator(`${LAYER} .yte-crop-hint`)).toContainText('Drag over the video');
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('aria-pressed', 'true');

    const time = () => page.evaluate(() => document.querySelector('#movie_player video').currentTime);
    const t0 = await time();
    await expect.poll(time).toBeGreaterThan(t0 + 0.3);
  });

  test('the dragged area fits the player with its proportions kept, the rest cut away', async ({ page }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    // A wide strip: twice as wide (in player terms) as the player's own shape.
    await dragBox(page, [0.25, 0.25, 0.75, 0.375]);
    await expect(page.locator(LAYER)).toBeHidden();

    const g = await cropGeometry(page, [0.25, 0.25, 0.75, 0.375]);
    const [, , W, H] = g.player;
    // Full width, centred vertically, nothing but the area visible.
    expect(g.box[0]).toBe(0);
    expect(g.box[2]).toBe(W);
    expect(Math.round((g.box[1] + g.box[3]) / 2)).toBe(Math.round(H / 2));
    expect(g.box[3] - g.box[1]).toBeLessThan(H);
    expect(g.visible).toEqual(g.box);
    expect(g.paused).toBe(false);

    // Nothing around the video hides it (YouTube's video box is 0px tall).
    const shown = await page.evaluate(() => {
      const r = document.querySelector('#movie_player').getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width * 0.3, r.y + r.height * 0.45).tagName;
    });
    expect(shown).toBe('VIDEO');
    await expect(page.locator('#movie_player')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('title', 'Show the whole video');
  });

  test('“fill the player” covers it and clips the area to the player', async ({ page, harness }) => {
    await harness.set({ cropFit: 'cover' });
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    await dragBox(page, [0.25, 0.25, 0.75, 0.375]);
    await expect(page.locator(LAYER)).toBeHidden();

    const g = await cropGeometry(page, [0.25, 0.25, 0.75, 0.375]);
    const [, , W, H] = g.player;
    expect(g.box[1]).toBe(0);
    expect(g.box[3]).toBe(H);
    expect(g.box[0]).toBeLessThan(0);
    expect(g.visible).toEqual([0, 0, W, H]);
  });

  test('the fit choice applies at once to a crop in place', async ({ page, harness }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    await dragBox(page, [0.25, 0.25, 0.75, 0.375]);
    const [, , W, H] = (await cropGeometry(page, [0, 0, 1, 1])).player;
    await harness.set({ cropFit: 'cover' });
    await expect.poll(async () => (await cropGeometry(page, [0.25, 0.25, 0.75, 0.375])).visible).toEqual([0, 0, W, H]);
  });

  test('the button again shows the whole video', async ({ page }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    await dragBox(page, [0.1, 0.1, 0.5, 0.5]);
    await page.locator(CROP_BUTTON).click();
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('aria-pressed', 'false');
    const g = await cropGeometry(page, [0, 0, 1, 1]);
    expect(g.box).toEqual(g.player);
    expect(g.visible).toEqual(g.player);
  });

  test('Esc or the ✕ cancels a selection, and a plain click does not crop', async ({ page }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    const p = await page.locator('#movie_player').boundingBox();
    await page.mouse.click(p.x + p.width / 2, p.y + p.height / 2);
    await expect(page.locator(LAYER)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator(LAYER)).toBeHidden();
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('aria-pressed', 'false');

    await page.locator(CROP_BUTTON).click();
    await page.locator(`${LAYER} .yte-crop-hint button`).click();
    await expect(page.locator(LAYER)).toBeHidden();
    const g = await cropGeometry(page, [0, 0, 1, 1]);
    expect(g.box).toEqual(g.player);
  });

  test('the crop follows the player when it changes size', async ({ page }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    await dragBox(page, [0.25, 0.25, 0.75, 0.375]);
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect
      .poll(async () => {
        const g = await cropGeometry(page, [0.25, 0.25, 0.75, 0.375]);
        return [g.box[0], g.box[2] - g.player[2]];
      })
      .toEqual([0, 0]);
  });

  test('the crop ends with the video', async ({ page }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    await dragBox(page, [0.1, 0.1, 0.5, 0.5]);
    await spaNavigate(page, '/watch?v=fixture2');
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('aria-pressed', 'false');
    const g = await cropGeometry(page, [0, 0, 1, 1]);
    expect(g.box).toEqual(g.player);
  });

  test('turning the crop tool off removes the button and the crop', async ({ page, harness }) => {
    await openYoutube(page);
    await page.locator(CROP_BUTTON).click();
    await dragBox(page, [0.1, 0.1, 0.5, 0.5]);
    await harness.set({ cropTool: false });
    await expect(page.locator(CROP_BUTTON)).toBeHidden();
    const g = await cropGeometry(page, [0, 0, 1, 1]);
    expect(g.box).toEqual(g.player);
  });

  test('the crop shortcut starts and ends a crop', async ({ page, harness }) => {
    await harness.set({ shortcuts: { toggleCrop: 'Alt+C' } });
    await openYoutube(page);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Alt+KeyC');
    await expect(page.locator(LAYER)).toBeVisible();
    await dragBox(page, [0.1, 0.1, 0.5, 0.5]);
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Alt+KeyC');
    await expect(page.locator(CROP_BUTTON)).toHaveAttribute('aria-pressed', 'false');
  });
});
