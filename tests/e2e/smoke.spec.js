import { test, expect, waitForExtension } from '../helpers/extension.js';

test('content scripts inject on a youtube.com page', async ({ page }) => {
  await page.goto('https://www.youtube.com/watch?v=fixture1');
  await waitForExtension(page);
  await expect(page.locator('#movie_player #yte-osc')).toHaveCount(1);
});
