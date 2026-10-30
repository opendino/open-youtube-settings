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
 *
 * Ad muting (`yte-ad-mute`) goes through the API for the same reason: YouTube
 * re-applies its own mute state to the element whenever it loads an ad.
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

  /**
   * Set on the player while an ad break is muted on the extension's behalf,
   * so the sound is only given back when it was the extension that took it.
   */
  const AD_MUTED_FLAG = 'yteAdMuted';

  /**
   * `yte-ad-mute` with `detail: true` at an ad break, `false` when it ends.
   * Mutes once per break: a user who was already muted stays muted, and a user
   * who unmutes during the ad is not muted again.
   */
  document.addEventListener(
    'yte-ad-mute',
    (event) => {
      const player = event.target;
      if (!player || typeof player.mute !== 'function') return;

      try {
        if (event.detail) {
          if (player.dataset[AD_MUTED_FLAG] || player.isMuted()) return;
          player.mute();
          player.dataset[AD_MUTED_FLAG] = 'true';
        } else if (player.dataset[AD_MUTED_FLAG]) {
          delete player.dataset[AD_MUTED_FLAG];
          if (player.isMuted()) player.unMute();
        }
      } catch (error) {
        console.error('[YT-Enhancer] Player API rejected the ad mute:', error);
      }
    },
    true
  );

  // YouTube remembers its mute state across visits; never leave it muted
  // because the tab closed during an ad.
  window.addEventListener('pagehide', () => {
    const player = document.querySelector('#movie_player[data-yte-ad-muted]');
    if (!player) return;
    try {
      if (player.isMuted()) player.unMute();
    } catch (error) {
      /* the page is going away */
    }
  });
})();
