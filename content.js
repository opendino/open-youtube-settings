/**
 * Open Youtube Settings — core content script
 *
 * Colour filters (brightness / blue light / invert), layout controls, side-panel
 * exceptions, video cropping, playback-speed plumbing and channel redirects.
 * Cross-browser: Chrome MV3 and Firefox.
 */

// Cross-browser compatibility layer
globalThis.browser = globalThis.browser || globalThis.chrome;

/** Every persisted setting with its default. Also used to coerce incoming values. */
const DEFAULTS = {
  // Colour
  brightness: 100,
  bluelight: 0,
  invert: false,
  filtersEnabled: true,
  applyToShorts: true,
  // Layout
  hideHome: false,
  hideSidebar: false,
  hidePlaylist: true,
  allowPanels: true,
  autoHideControls: false,
  hidePlayPause: false,
  hideSkipAnim: false,
  // Ads
  muteAds: false,
  // Speed controller
  speedEnabled: true,
  speedOverlay: true,
  speedStep: 0.1,
  speedDefault: 1,
  speedPersist: false,
  lastSpeed: 1,
  // Advanced
  cropEnabled: false,
  cropZoom: 100,
  cropOffsetY: 0,
  clipEnabled: true,
  channelAutoVideos: false,
  // Channels hidden from recommendations: { name, handle, id } each
  blockedChannels: [],
  // Shortcuts
  shortcuts: {}
};

/** Live settings state. */
const S = Object.assign({}, DEFAULTS);

/**
 * Strings the on-page UI needs. The popup mirrors the user's chosen language
 * into storage (`contentStrings`) because content scripts cannot read the
 * popup's manually selected locale.
 */
const STRING_FALLBACK = {
  focusMode: 'Focus mode active — the home feed is hidden.',
  speedLabel: 'Speed',
  speedReset: 'Reset',
  clipTitle: 'Clip',
  clipSetIn: 'Set start',
  clipSetOut: 'Set end',
  clipPreview: 'Preview',
  clipSave: 'Save clip',
  clipClose: 'Close',
  clipRecording: 'Recording…',
  clipSaved: 'Clip saved',
  clipFailed: 'Clip capture failed',
  clipNoRange: 'Set a start and end point first',
  blockChannel: 'Block channel',
  blockedChannel: 'Blocked channel'
};
const STR = Object.assign({}, STRING_FALLBACK);

/** Shared namespace so the overlay script can reuse this state. */
const YTE = globalThis.__YTE__ = {
  settings: S,
  defaults: DEFAULTS,
  strings: STR,
  api: {},
  _subs: new Set(),
  onChange(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  },
  notify() {
    for (const fn of this._subs) {
      try {
        fn(S);
      } catch (error) {
        console.error('[YT-Enhancer] Settings subscriber failed:', error);
      }
    }
  },
  getVideo: () => getMainVideo(),
  getPlayer: () => getPlayer(),
  save(patch) {
    applyIncoming(patch);
    persist(patch);
    refreshAll();
  }
};

/* ------------------------------------------------------------------ helpers */

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Escapes a string for use inside a CSS `content:` declaration. */
function cssString(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

const SHORTS_PATH = /^\/shorts(\/|$)/;

function onShorts() {
  return SHORTS_PATH.test(location.pathname);
}

function reelVideo() {
  return document.querySelector(
    'ytd-reel-video-renderer[is-active] video, #shorts-player video'
  );
}

/**
 * The video element the user is actually watching. The URL decides which
 * surface wins, because YouTube can leave a Shorts renderer in the DOM after
 * navigating back to a watch page.
 */
function getMainVideo() {
  if (onShorts()) {
    const reel = reelVideo();
    if (reel) return reel;
  }
  return (
    document.querySelector('#movie_player video.html5-main-video') ||
    reelVideo() ||
    document.querySelector('video.html5-main-video') ||
    document.querySelector('video')
  );
}

function getPlayer() {
  if (onShorts()) {
    const reel =
      document.querySelector('ytd-reel-video-renderer[is-active] .html5-video-player') ||
      document.querySelector('#shorts-player');
    if (reel) return reel;
  }
  return (
    document.querySelector('#movie_player') ||
    document.querySelector('ytd-reel-video-renderer[is-active] .html5-video-player') ||
    document.querySelector('#shorts-player') ||
    document.querySelector('.html5-video-player')
  );
}

function persist(patch) {
  if (!browser || !browser.storage || !browser.storage.local) return;
  browser.storage.local
    .set(patch)
    .catch((error) => console.error('[YT-Enhancer] Error writing settings:', error));
}

/** Coerces a stored value to the type implied by its default. */
function coerce(key, value) {
  const fallback = DEFAULTS[key];
  if (typeof fallback === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof fallback === 'boolean') return !!value;
  if (Array.isArray(fallback)) {
    return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
  }
  if (key === 'shortcuts') {
    return value && typeof value === 'object' ? value : {};
  }
  return value;
}

/**
 * Merges a settings payload (storage snapshot, change set or popup message)
 * into the live state.
 * @returns {boolean} Whether anything actually changed.
 */
function applyIncoming(payload) {
  if (!payload || typeof payload !== 'object') return false;
  let changed = false;
  const previousDefault = S.speedDefault;

  for (const key of Object.keys(DEFAULTS)) {
    if (payload[key] === undefined) continue;
    const value = coerce(key, payload[key]);
    if (key === 'shortcuts' || S[key] !== value) {
      S[key] = value;
      changed = true;
    }
  }

  if (payload.contentStrings && typeof payload.contentStrings === 'object') {
    Object.assign(STR, STRING_FALLBACK, payload.contentStrings);
    changed = true;
  }

  // Moving the default-speed slider should be audible immediately, not only
  // on the next video, unless the user asked to carry the speed over.
  if (payload.speedDefault !== undefined && S.speedDefault !== previousDefault && !S.speedPersist) {
    S.lastSpeed = S.speedDefault;
    persist({ lastSpeed: S.lastSpeed });
  }

  return changed;
}

/* ------------------------------------------------------- dynamic stylesheet */

const styleElement = document.createElement('style');
styleElement.id = 'yte-dynamic-styles';

/**
 * Ensures the dynamic style element is attached to the document head or
 * document element. Prevents styles from being lost during SPA page updates.
 */
function ensureStyleElement() {
  try {
    if (!styleElement.parentNode || !document.head.contains(styleElement)) {
      (document.head || document.documentElement).appendChild(styleElement);
    }
  } catch (error) {
    console.error('[YT-Enhancer] Failed to ensure dynamic style element:', error);
  }
}

/** Selectors that match the watched video in every layout, Shorts included. */
const VIDEO_SELECTOR =
  'video.html5-main-video, video.video-stream, ytd-reel-video-renderer video, #shorts-player video';
// Qualified with the same classes as VIDEO_SELECTOR so the Shorts opt-out
// out-ranks the general rule instead of losing the specificity tie.
const SHORTS_VIDEO_SELECTOR = [
  'ytd-reel-video-renderer video.html5-main-video',
  'ytd-reel-video-renderer video.video-stream',
  'ytd-reel-video-renderer video',
  '#shorts-player video.html5-main-video',
  '#shorts-player video.video-stream',
  'ytd-shorts video.html5-main-video',
  'ytd-shorts video.video-stream'
].join(', ');

/** Builds the colour filter chain, or `none` when filters are off. */
function buildFilterChain() {
  if (!S.filtersEnabled) return 'none';

  const brightness = clamp(S.brightness, 20, 200) / 100;
  const blue = clamp(S.bluelight, 0, 100) / 100;

  let chain = `brightness(${brightness.toFixed(3)})`;

  // Blue light reduction: warm shift that is a true no-op at 0.
  if (blue > 0) {
    chain +=
      ` sepia(${(blue * 0.85).toFixed(3)})` +
      ` saturate(${(1 + blue * 0.25).toFixed(3)})` +
      ` hue-rotate(${(-12 * blue).toFixed(2)}deg)`;
  }

  // Smart invert: inverting luminance while hue-rotate(180deg) restores the
  // original hues, so a whiteboard turns black without going negative-colour.
  if (S.invert) chain += ' invert(1) hue-rotate(180deg)';

  return chain;
}

function filterCss() {
  const parts = [];
  parts.push(`:root{--yte-filter:${buildFilterChain()};}`);
  parts.push(`${VIDEO_SELECTOR}{filter:var(--yte-filter)!important;}`);

  // Opt out of Shorts separately; this rule must come last to win.
  if (!S.applyToShorts) {
    parts.push(`${SHORTS_VIDEO_SELECTOR}{filter:none!important;}`);
  }
  return parts.join('\n');
}

function cropCss() {
  if (!S.cropEnabled) return '';
  const zoom = clamp(S.cropZoom, 100, 250) / 100;
  const offsetY = clamp(S.cropOffsetY, -50, 50);

  // Crop by scaling the frame inside a clipped container, so banners and
  // letterbox bars are pushed out of view and the subject fills more space.
  return [
    '#movie_player .html5-video-container{overflow:hidden!important;}',
    `#movie_player video.html5-main-video{` +
      `transform:scale(${zoom.toFixed(3)}) translateY(${offsetY}%)!important;` +
      `transform-origin:center center!important;}`
  ].join('\n');
}

function homeFeedCss() {
  if (!S.hideHome) return '';
  return `
    ytd-browse[page-subtype="home"] #contents,
    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer {
      display: none !important;
    }
    ytd-browse[page-subtype="home"]::before {
      content: ${cssString(STR.focusMode)};
      display: block;
      padding: 40px;
      text-align: center;
      font-size: 1.2rem;
      color: #aaa;
    }
  `;
}

/* ------------------------------------------------- side column / panel state */

const EXPANDED_PANEL =
  'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]';

/**
 * Panels YouTube keeps expanded on its own. They are part of the side column
 * rather than something the user asked to open, so they must not count as a
 * reason to reveal a sidebar the user chose to hide. Everything else counts,
 * which is deliberate: unknown and future panels (the AI panel among them) are
 * treated as user-opened rather than silently swallowed.
 */
const PERSISTENT_PANEL_TARGETS = [
  'engagement-panel-comments-section',
  'engagement-panel-ads',
  'PAsearch_preview'
];

function isUserOpenedPanel(panel) {
  return !PERSISTENT_PANEL_TARGETS.includes(panel.getAttribute('target-id') || '');
}

let panelOpen = false;
let hasPlaylist = false;

/**
 * Reads whether an engagement panel (chapters, transcript, AI ask, description)
 * is currently expanded, and whether the watch page carries a playlist.
 * @returns {boolean} Whether the observed state changed.
 */
function readSideState() {
  let expanded = false;
  let playlist = false;

  try {
    expanded = [
      ...document.querySelectorAll(
        `ytd-watch-flexy ${EXPANDED_PANEL}, ytd-watch-grid ${EXPANDED_PANEL}`
      )
    ].some(isUserOpenedPanel);
    playlist = !!document.querySelector(
      'ytd-watch-flexy ytd-playlist-panel-renderer, #secondary ytd-playlist-panel-renderer'
    );
  } catch (error) {
    console.error('[YT-Enhancer] Error reading side column state:', error);
  }

  if (expanded === panelOpen && playlist === hasPlaylist) return false;
  panelOpen = expanded;
  hasPlaylist = playlist;
  return true;
}

let panelObserver = null;

/**
 * Watches only the `visibility` attribute YouTube flips on engagement panels,
 * so opening "View chapters" or the AI panel reacts instantly without a
 * document-wide childList observer.
 */
function setupPanelObserver() {
  if (panelObserver) return;
  try {
    panelObserver = new MutationObserver(() => {
      if (readSideState()) updateDynamicStyles();
    });
    panelObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['visibility']
    });
  } catch (error) {
    console.error('[YT-Enhancer] Error setting up panel observer:', error);
  }
}

/**
 * Tags the column that holds the related-video list with a stable class.
 * YouTube moves that column below the player in split view / narrow windows,
 * so finding it at runtime is more reliable than hard-coding `#secondary`.
 */
function markSideColumn() {
  try {
    const related = document.querySelector('ytd-watch-next-secondary-results-renderer');
    if (!related) return;

    const player = document.querySelector('#movie_player, .html5-video-player');

    let node = related;
    while (
      node.parentElement &&
      node.parentElement.id !== 'columns' &&
      !/^YTD-WATCH-(FLEXY|GRID)$/.test(node.parentElement.tagName)
    ) {
      node = node.parentElement;
    }

    // In YouTube's single-column layout (narrow windows, split view) the
    // related list sits inside the primary column, alongside the player,
    // title, description and engagement panels. Hiding that column would take
    // the whole watch page with it, so the tag only ever goes on a column that
    // carries nothing but side content.
    const KEEPERS =
      '#movie_player, .html5-video-player, ytd-comments, #above-the-fold, ytd-watch-metadata';
    if (
      node.id === 'primary' ||
      node.querySelector(KEEPERS) ||
      (player && node.contains(player))
    ) {
      return;
    }

    node.classList.add('yte-side-column');
  } catch (error) {
    console.error('[YT-Enhancer] Error locating side column:', error);
  }
}

function sidebarCss() {
  if (!S.hideSidebar) return '';
  const parts = [];

  // Related videos, in every layout: two columns, split view / one column and
  // the newer watch-grid. The bare tag selector catches it wherever it lands.
  parts.push(
    'ytd-watch-next-secondary-results-renderer,' +
      'ytd-watch-flexy #related,' +
      'ytd-watch-grid #related' +
      '{display:none!important;}'
  );

  if (S.hidePlaylist) {
    parts.push(
      'ytd-watch-flexy ytd-playlist-panel-renderer,' +
        '#secondary ytd-playlist-panel-renderer' +
        '{display:none!important;}'
    );
  }

  // Keep the column alive while the user has a panel open (chapters, AI ask,
  // transcript…) or while a playlist they chose to keep is showing. YouTube
  // collapses panels on navigation, so the next video starts hidden again.
  const keepForPanel = S.allowPanels && panelOpen;
  const keepForPlaylist = !S.hidePlaylist && hasPlaylist;

  if (!keepForPanel && !keepForPlaylist) {
    parts.push(
      'ytd-watch-flexy #secondary,' +
        'ytd-watch-grid #secondary,' +
        '.yte-side-column' +
        '{display:none!important;}'
    );
    parts.push(
      'ytd-watch-flexy #primary,ytd-watch-grid #primary{max-width:100%!important;}'
    );
  }

  return parts.join('\n');
}

function playerChromeCss() {
  const parts = [];

  if (S.autoHideControls) {
    parts.push(`
      /* Hide control bar and bottom gradient by default, support transition */
      .ytp-chrome-bottom,
      .ytp-gradient-bottom {
        opacity: 0 !important;
        transition: opacity 0.3s ease-in-out !important;
      }

      /* Show control bar only on hover of the controls area */
      .ytp-chrome-bottom:hover,
      .ytp-gradient-bottom:hover {
        opacity: 1 !important;
      }

      /* Keep visible while volume slider is active or settings menu is open */
      .ytp-volume-panel-active .ytp-chrome-bottom,
      .ytp-settings-menu-opened .ytp-chrome-bottom {
        opacity: 1 !important;
      }
    `);
  }

  if (S.hidePlayPause) {
    parts.push(`
      /* Hide central play/pause bubble animations */
      .ytp-bezel,
      .ytp-bezel-text,
      .ytp-bezel-icon {
        display: none !important;
      }
    `);
  }

  return parts.join('\n');
}

/** Rebuilds the injected stylesheet from the current settings. */
function updateDynamicStyles() {
  ensureStyleElement();
  styleElement.textContent = [
    filterCss(),
    cropCss(),
    homeFeedCss(),
    sidebarCss(),
    playerChromeCss(),
    blockCss()
  ]
    .filter(Boolean)
    .join('\n');
}

/* ----------------------------------------------------------------- speed */

/**
 * The rate we last wrote ourselves, so the `ratechange` listener can tell our
 * own writes apart from a speed the user picked in YouTube's own menu.
 */
let expectedRate = null;

/** Range YouTube's player API accepts (see page-bridge.js). */
const API_MIN_RATE = 0.25;
const API_MAX_RATE = 2;

/** What YouTube's player turns a rate into, since its API clamps. */
function youtubeRateFor(rate) {
  return Math.min(API_MAX_RATE, Math.max(API_MIN_RATE, rate));
}

/** Ad breaks play at YouTube's own rate and must not be adopted or fought. */
function adShowing() {
  const player = getPlayer();
  return !!player && player.classList.contains('ad-showing');
}

/**
 * Writes a rate through YouTube's player API first, via the page bridge, so
 * YouTube's menu, its Shift+< / Shift+> shortcuts and the rate it restores
 * after an ad all agree with ours. The API stops at 0.25–2×, so the element is
 * written directly for anything beyond that, except during an ad.
 */
function writeRate(video, target) {
  expectedRate = target;
  const player = video.closest('.html5-video-player');
  if (player) player.dispatchEvent(new CustomEvent('yte-set-rate', { detail: target }));
  if (Math.abs(video.playbackRate - target) > 0.001 && !adShowing()) {
    video.playbackRate = target;
  }
}

/** Rounds away floating-point drift so stepped rates stay at 1.3, not 1.3000000000000003. */
function roundRate(rate) {
  return Math.round(rate * 1000) / 1000;
}

/**
 * Re-asserts the managed playback rate. `lastSpeed` always holds the rate in
 * force right now, so this only repairs rates YouTube reset on its own; it
 * does nothing at all while the speed controller is disabled, leaving a
 * dedicated speed extension in charge.
 */
function applySpeed() {
  if (!S.speedEnabled) return;
  try {
    const video = getMainVideo();
    if (!video) return;

    const target = clamp(S.lastSpeed, 0.0625, 16);
    if (Math.abs(video.playbackRate - target) > 0.001) writeRate(video, target);
  } catch (error) {
    console.error('[YT-Enhancer] Error applying playback rate:', error);
  }
}

/** Sets a new playback rate and remembers it as the rate in force. */
function setSpeed(rate) {
  if (!S.speedEnabled) return null;
  const target = roundRate(clamp(rate, 0.0625, 16));
  try {
    const video = getMainVideo();
    if (video) writeRate(video, target);
  } catch (error) {
    console.error('[YT-Enhancer] Error setting playback rate:', error);
  }
  S.lastSpeed = target;
  persist({ lastSpeed: target });
  YTE.notify();
  return target;
}

/**
 * Decides the rate a newly opened video starts at: the one carried over when
 * the user asked for that, otherwise the configured default.
 */
function resetSpeedForNavigation() {
  if (!S.speedEnabled || S.speedPersist) {
    applySpeed();
    return;
  }
  const target = clamp(S.speedDefault, 0.0625, 16);
  if (Math.abs(S.lastSpeed - target) > 0.001) {
    S.lastSpeed = target;
    persist({ lastSpeed: target });
  }
  applySpeed();
}

// A speed picked from YouTube's own menu wins; adopt it instead of fighting it.
document.addEventListener(
  'ratechange',
  (event) => {
    if (!S.speedEnabled) return;
    const video = event.target;
    // Hover previews and the hidden watch player on Shorts are not the video
    // being watched, and an ad break runs at YouTube's own rate.
    if (!(video instanceof HTMLVideoElement) || video !== getMainVideo()) return;
    if (adShowing()) return;
    // Loading a new source resets the rate to defaultPlaybackRate; that is the
    // browser, not the user. `loadedmetadata` below re-applies ours.
    if (video.readyState === HTMLMediaElement.HAVE_NOTHING) return;

    const rate = roundRate(clamp(video.playbackRate, 0.0625, 16));
    if (expectedRate !== null && Math.abs(rate - expectedRate) < 0.001) {
      expectedRate = null;
      return;
    }
    if (Math.abs(rate - S.lastSpeed) < 0.001) return;

    // YouTube only knows a clamped copy of rates beyond 0.25–2× and writes it
    // back after ads and video switches; that is not the user picking a speed.
    const clamped = youtubeRateFor(S.lastSpeed);
    if (Math.abs(clamped - S.lastSpeed) > 0.001 && Math.abs(rate - clamped) < 0.001) {
      writeRate(video, S.lastSpeed);
      return;
    }

    S.lastSpeed = rate;
    persist({ lastSpeed: rate });
    YTE.notify();
  },
  true
);

// A new source in the same element (next video, Shorts swipe) starts from the
// browser's default rate; put the managed rate back as soon as it can play.
document.addEventListener(
  'loadedmetadata',
  (event) => {
    if (event.target === getMainVideo()) applySpeed();
  },
  true
);

YTE.api.setSpeed = setSpeed;
YTE.api.nudgeSpeed = (direction) => {
  const video = getMainVideo();
  const current = video ? video.playbackRate : S.lastSpeed;
  return setSpeed(current + direction * clamp(S.speedStep, 0.01, 1));
};
YTE.api.resetSpeed = () => setSpeed(S.speedDefault);

/* ------------------------------------------------------- channel redirect */

const CHANNEL_ROOT = /^\/(@[^/]+|c\/[^/]+|user\/[^/]+|channel\/[^/]+)(\/featured)?\/?$/;

/**
 * Sends channel landing pages straight to their Videos tab when the user
 * opted in. `/videos` never matches, so this cannot loop.
 */
function maybeRedirectChannel() {
  if (!S.channelAutoVideos) return;
  try {
    const match = location.pathname.match(CHANNEL_ROOT);
    if (!match) return;
    location.replace(`${location.origin}/${match[1]}/videos${location.search}`);
  } catch (error) {
    console.error('[YT-Enhancer] Error redirecting to the Videos tab:', error);
  }
}

/* --------------------------------------------------- skip animation hider */

let videoObserver = null;

/**
 * Initializes a highly targeted MutationObserver on the YouTube video player.
 * Detects and hides double-tap skip overlays dynamically and quickly.
 */
function setupOptimizedObserver() {
  try {
    const player = document.querySelector('.html5-video-player');
    if (!player || player.dataset.hasHideObserver) return;

    if (videoObserver) videoObserver.disconnect();

    /**
     * Checks if a DOM element contains double tap / seek indicators and hides it.
     * @param {Element} el - The DOM element to examine.
     */
    function checkAndHide(el) {
      if (!el || !el.classList) return;

      // Completely ignore control bars, chrome overlays and subtitles.
      if (
        el.classList.contains('ytp-chrome-bottom') || el.closest('.ytp-chrome-bottom') ||
        el.classList.contains('ytp-chrome-top') || el.closest('.ytp-chrome-top') ||
        el.classList.contains('caption-window') || el.closest('.caption-window') ||
        el.closest('#yte-osc')
      ) {
        return;
      }

      const text = el.textContent.trim();
      // Matches indicators like: "+ 5", "- 10", "< - 5", "+ 15 >", "15s", "10 sn"
      if (/^[<>]*\s*[+-]\s*\d+\s*(s|sn|sec)?\s*[<>]*$/i.test(text) && text !== '') {
        // Walk up to hide the whole container rather than just the text label.
        let targetToHide = el;
        while (
          targetToHide.parentElement &&
          !targetToHide.parentElement.classList.contains('ytp-player-content') &&
          !targetToHide.parentElement.classList.contains('html5-video-player')
        ) {
          targetToHide = targetToHide.parentElement;
        }

        targetToHide.style.setProperty('display', 'none', 'important');
        targetToHide.style.setProperty('opacity', '0', 'important');
        targetToHide.style.setProperty('visibility', 'hidden', 'important');
      }
    }

    videoObserver = new MutationObserver((mutations) => {
      if (!S.hideSkipAnim) return;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              checkAndHide(node);
              for (const child of node.querySelectorAll('div, span')) checkAndHide(child);
            }
          }
        } else if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent) checkAndHide(parent);
        } else if (mutation.type === 'attributes') {
          checkAndHide(mutation.target);
        }
      }
    });

    videoObserver.observe(player, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    player.dataset.hasHideObserver = 'true';
  } catch (error) {
    console.error('[YT-Enhancer] Error setting up player MutationObserver:', error);
  }
}

/* ------------------------------------------------------- channel blocking */

/**
 * Covers recommendations from blocked channels with a black panel instead of
 * removing them, so grids and lists never reflow. The panel swallows clicks,
 * so a covered video cannot be opened by accident. A small button on each
 * card blocks its channel; the popup lists blocked channels for unblocking.
 *
 * Most cards no longer carry a channel link (the watch-page list and the end
 * screen show only the name), so a channel matches on its channel ID, handle
 * or display name, whichever the card has.
 */

/** Recommendation cards on every surface; nested matches are skipped. */
const CARD_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-reel-item-renderer',
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model',
  'ytm-shorts-lockup-view-model-v2',
  '.ytp-videowall-still',
  '.ytp-modern-videowall-still'
].join(', ');

const CHANNEL_HREF = /^(?:https?:\/\/[^/]+)?\/(?:channel\/(UC[\w-]+)|(@[^/?#]+))/;

/**
 * Home, search and the watch page (side list and end screen). Channel pages,
 * subscriptions and playlists are the user's own choice, not recommendations.
 */
function onRecommendationPage() {
  return ['/', '/results', '/watch'].includes(location.pathname);
}

function normalizeName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

/** The channel name as the card prints it. */
function cardChannelName(card) {
  const named = card.querySelector(
    'ytd-channel-name #text, #channel-name #text, .ytp-videowall-still-info-author'
  );
  // The first metadata row of a view-model lockup is the channel.
  const meta = named ? null : card.querySelector('yt-content-metadata-view-model');
  const row =
    named ||
    (meta &&
      (meta.querySelector('[class*="metadata-row"], [class*="MetadataRow"]') ||
        meta.firstElementChild));
  if (!row) return null;
  // End-screen authors read "Channel • 1.2M views".
  const name = row.textContent.split('•')[0].replace(/\s+/g, ' ').trim();
  return name || null;
}

/** Everything the card tells about its channel, or null if nothing. */
function cardChannel(card) {
  let id = null;
  let handle = null;
  for (const link of card.querySelectorAll('a[href]')) {
    const match = (link.getAttribute('href') || '').match(CHANNEL_HREF);
    if (!match) continue;
    if (match[1]) id = match[1];
    if (match[2]) handle = decodeURIComponent(match[2]).toLocaleLowerCase();
  }
  const name = cardChannelName(card);
  if (!id && !handle && !name) return null;
  return { name, handle, id };
}

function isBlocked(channel) {
  if (!channel) return false;
  const name = normalizeName(channel.name);
  return S.blockedChannels.some(
    (entry) =>
      (channel.id && entry.id === channel.id) ||
      (channel.handle && entry.handle === channel.handle) ||
      (name && entry.name && normalizeName(entry.name) === name)
  );
}

function blockChannel(channel) {
  if (!channel || isBlocked(channel)) return;
  const entry = {};
  for (const key of ['name', 'handle', 'id']) if (channel[key]) entry[key] = channel[key];
  S.blockedChannels = [...S.blockedChannels, entry];
  persist({ blockedChannels: S.blockedChannels });
  scanCards();
}

/** Keeps clicks, presses and menus on the overlay away from the card. */
function swallow(event) {
  event.preventDefault();
  event.stopPropagation();
}

function blockButton(card) {
  let button = card.querySelector(':scope > .yte-block-btn');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'yte-block-btn';
    button.textContent = '🚫';
    for (const type of ['mousedown', 'pointerdown', 'dblclick']) {
      button.addEventListener(type, swallow, true);
    }
    button.addEventListener(
      'click',
      (event) => {
        swallow(event);
        blockChannel(cardChannel(card));
      },
      true
    );
    card.appendChild(button);
  }
  if (button.title !== STR.blockChannel) {
    button.title = STR.blockChannel;
    button.setAttribute('aria-label', STR.blockChannel);
  }
  return button;
}

function blockOverlay(card) {
  let overlay = card.querySelector(':scope > .yte-block-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'yte-block-overlay';
    for (const type of ['click', 'mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'auxclick']) {
      overlay.addEventListener(type, swallow, true);
    }
    card.appendChild(overlay);
  }
  const label = `🚫 ${STR.blockedChannel}`;
  if (overlay.textContent !== label) overlay.textContent = label;
}

/** Adds or removes the block button and overlay on one card. */
function decorateCard(card, active) {
  const channel = active ? cardChannel(card) : null;
  if (!channel) {
    if (card.classList.contains('yte-card')) {
      card.classList.remove('yte-card', 'yte-card-anchor', 'yte-blocked');
      for (const node of card.querySelectorAll(':scope > .yte-block-btn, :scope > .yte-block-overlay')) {
        node.remove();
      }
    }
    return;
  }

  if (!card.classList.contains('yte-card')) {
    card.classList.add('yte-card');
    // Positioned cards (end-screen stills) already anchor the overlay.
    if (getComputedStyle(card).position === 'static') card.classList.add('yte-card-anchor');
  }
  blockButton(card);

  const blocked = isBlocked(channel);
  card.classList.toggle('yte-blocked', blocked);
  if (blocked) {
    blockOverlay(card);
  } else {
    const overlay = card.querySelector(':scope > .yte-block-overlay');
    if (overlay) overlay.remove();
  }
}

function scanCards() {
  try {
    const active = onRecommendationPage();
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      if (card.parentElement && card.parentElement.closest(CARD_SELECTOR)) continue;
      decorateCard(card, active);
    }
  } catch (error) {
    console.error('[YT-Enhancer] Error marking blocked channels:', error);
  }
}

let cardScanTimer = null;

/** YouTube streams cards in and recycles them; rescan shortly after changes. */
function scheduleCardScan() {
  if (cardScanTimer !== null) return;
  cardScanTimer = setTimeout(() => {
    cardScanTimer = null;
    scanCards();
  }, 200);
}

try {
  new MutationObserver(scheduleCardScan).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
} catch (error) {
  console.error('[YT-Enhancer] Error watching for recommendation cards:', error);
}

function blockCss() {
  return `
    .yte-card-anchor { position: relative !important; }
    /* Each card stacks on its own, so the overlay beats every z-index inside
       it (YouTube lifts the channel row) without rising above the masthead. */
    .yte-card { isolation: isolate; }
    .yte-block-btn {
      position: absolute; top: 8px; left: 8px; z-index: 2147483000;
      width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%;
      background: rgba(15, 15, 15, 0.85); color: #fff; font-size: 14px; line-height: 28px;
      cursor: pointer; opacity: 0; transition: opacity 0.15s ease;
    }
    .yte-card:hover > .yte-block-btn, .yte-block-btn:focus-visible { opacity: 1; }
    .yte-block-btn:hover { background: #cc0000; }
    .yte-blocked > .yte-block-btn { display: none; }
    .yte-block-overlay {
      position: absolute; inset: 0; z-index: 2147483000;
      display: flex; align-items: center; justify-content: center;
      background: #000; color: #aaa; border-radius: 12px;
      font: 500 14px 'Roboto', 'Arial', sans-serif; text-align: center; cursor: default;
    }
  `;
}

/* ------------------------------------------------------------- ad muting */

/**
 * Mutes ad breaks and gives the sound back when they end. YouTube writes its
 * own mute state onto the element every time it loads an ad or a video, so a
 * muted element would be unmuted again mid-break; the mute goes through
 * YouTube's player instead (page-bridge.js), which also keeps its volume
 * button honest and never touches the volume level.
 */
let adMuteRequested = false;
let adObserver = null;
let adObservedPlayer = null;

function syncAdMute() {
  const player = document.querySelector('#movie_player');
  if (!player) return;
  const want = S.muteAds && player.classList.contains('ad-showing');
  // Repeating the mute request is harmless (the bridge mutes once per break)
  // and covers a player whose API was not ready the first time.
  if (want || adMuteRequested) {
    player.dispatchEvent(new CustomEvent('yte-ad-mute', { detail: want }));
  }
  adMuteRequested = want;
}

/** Follows the player's `ad-showing` class, which flips at each ad break. */
function setupAdObserver() {
  const player = document.querySelector('#movie_player');
  if (!player || player === adObservedPlayer) return;
  try {
    if (adObserver) adObserver.disconnect();
    adObserver = new MutationObserver(syncAdMute);
    adObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
    adObservedPlayer = player;
  } catch (error) {
    console.error('[YT-Enhancer] Error watching for ad breaks:', error);
  }
}

/* --------------------------------------------------------------- refresh */

/** Re-applies everything that depends on the current settings and DOM. */
function refreshAll() {
  readSideState();
  markSideColumn();
  updateDynamicStyles();
  applySpeed();
  setupPanelObserver();
  setupOptimizedObserver();
  setupAdObserver();
  syncAdMute();
  scanCards();
  YTE.notify();
}

/* ---------------------------------------------------------- settings load */

if (browser && browser.storage && browser.storage.local) {
  browser.storage.local
    .get([...Object.keys(DEFAULTS), 'contentStrings'])
    .then((result) => {
      applyIncoming(result);
      maybeRedirectChannel();
      refreshAll();
    })
    .catch((error) => {
      console.error('[YT-Enhancer] Error loading extension options:', error);
      refreshAll();
    });
} else {
  refreshAll();
}

// Synchronize automatically when options change in storage.
if (browser && browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const payload = {};
    for (const [key, change] of Object.entries(changes)) {
      payload[key] = change.newValue;
    }

    if (applyIncoming(payload)) refreshAll();
  });
}

// Listen for updates explicitly dispatched from the popup.
if (browser && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'UPDATE_SETTINGS') return;
    applyIncoming(message);
    refreshAll();
  });
}

/* --------------------------------------------------------------- hotkeys */

/**
 * Formats a keyboard event into a standardized string combination.
 * @param {KeyboardEvent} e - The keyboard event object.
 * @returns {string|null} The formatted combination, or null if modifier-only.
 */
function formatKeyCombo(e) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;

  const keys = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  if (e.metaKey) keys.push('Cmd');

  let keyName = e.key.toUpperCase();
  if (keyName === ' ') keyName = 'SPACE';
  keys.push(keyName);

  return keys.join('+');
}

/** Toggles that simply flip a boolean setting and persist it. */
const TOGGLE_ACTIONS = {
  toggleHome: 'hideHome',
  toggleSidebar: 'hideSidebar',
  toggleControls: 'autoHideControls',
  togglePlayPause: 'hidePlayPause',
  toggleSkipAnim: 'hideSkipAnim',
  toggleFilters: 'filtersEnabled',
  toggleInvert: 'invert',
  toggleCrop: 'cropEnabled'
};

/** Actions handled by the overlay script. */
const API_ACTIONS = {
  speedUp: () => YTE.api.nudgeSpeed && YTE.api.nudgeSpeed(1),
  speedDown: () => YTE.api.nudgeSpeed && YTE.api.nudgeSpeed(-1),
  speedReset: () => YTE.api.resetSpeed && YTE.api.resetSpeed(),
  clipToggle: () => YTE.api.toggleClipBar && YTE.api.toggleClipBar(),
  clipMarkIn: () => YTE.api.markClipIn && YTE.api.markClipIn(),
  clipMarkOut: () => YTE.api.markClipOut && YTE.api.markClipOut(),
  clipSave: () => YTE.api.saveClip && YTE.api.saveClip()
};

window.addEventListener('keydown', (e) => {
  // Ignore shortcuts while the user is typing.
  if (
    e.target.tagName === 'INPUT' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.isContentEditable
  ) {
    return;
  }

  const combo = formatKeyCombo(e);
  if (!combo) return;

  const action = Object.keys(S.shortcuts || {}).find((key) => S.shortcuts[key] === combo);
  if (!action) return;

  if (API_ACTIONS[action]) {
    e.preventDefault();
    API_ACTIONS[action]();
    return;
  }

  const settingKey = TOGGLE_ACTIONS[action];
  if (!settingKey) return;

  e.preventDefault();
  S[settingKey] = !S[settingKey];
  persist({ [settingKey]: S[settingKey] });
  refreshAll();
});

/* ------------------------------------------------------- SPA navigation */

function onNavigate() {
  maybeRedirectChannel();
  refreshAll();
  resetSpeedForNavigation();
}

window.addEventListener('yt-navigate-finish', onNavigate);
window.addEventListener('yt-page-type-changed', onNavigate);
window.addEventListener('yt-player-updated', () => {
  applySpeed();
  setupOptimizedObserver();
});

// Low-frequency safety checker so styles, observers and speed stay applied even
// after long idle periods or player rebuilds.
setInterval(() => {
  try {
    ensureStyleElement();
    setupPanelObserver();
    setupOptimizedObserver();
    setupAdObserver();
    syncAdMute();
    markSideColumn();
    applySpeed();
    if (readSideState()) updateDynamicStyles();
  } catch (error) {
    console.error('[YT-Enhancer] Periodic checker error:', error);
  }
}, 2000);
