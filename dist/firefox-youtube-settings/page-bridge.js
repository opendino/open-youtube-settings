/**
 * Open Youtube Settings — page bridge
 *
 * Runs in the page's own JavaScript world (manifest `world: "MAIN"`), where
 * YouTube's player API lives. Content scripts cannot call it from their
 * isolated world, so they dispatch `yte-set-rate` on the player element and
 * this forwards the rate to `player.setPlaybackRate()`.
 *
 * Going through the API keeps YouTube's own idea of the speed in step with the
 * extension: its speed menu, its Shift+< / Shift+> shortcuts and the rate it
 * restores after an ad break all start from the same value.
 */

(function () {
  /** Range YouTube's player API accepts; it clamps anything outside it. */
  const API_MIN = 0.25;
  const API_MAX = 2;

  document.addEventListener(
    'yte-set-rate',
    (event) => {
      const player = event.target;
      const rate = Number(event.detail);
      if (!player || typeof player.setPlaybackRate !== 'function') return;
      if (!Number.isFinite(rate)) return;

      try {
        player.setPlaybackRate(Math.min(API_MAX, Math.max(API_MIN, rate)));
      } catch (error) {
        console.error('[YT-Enhancer] Player API rejected the playback rate:', error);
      }
    },
    true
  );
})();
