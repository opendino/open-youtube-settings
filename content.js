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
  clipNoRange: 'Set a start and end point first'
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
    playerChromeCss()
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

function writeRate(video, target) {
  expectedRate = target;
  video.playbackRate = target;
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
  const target = clamp(rate, 0.0625, 16);
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
    if (!(video instanceof HTMLVideoElement)) return;

    const rate = clamp(video.playbackRate, 0.0625, 16);
    if (expectedRate !== null && Math.abs(rate - expectedRate) < 0.001) {
      expectedRate = null;
      return;
    }
    if (Math.abs(rate - S.lastSpeed) < 0.001) return;

    S.lastSpeed = rate;
    persist({ lastSpeed: rate });
    YTE.notify();
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

/* --------------------------------------------------------------- refresh */

/** Re-applies everything that depends on the current settings and DOM. */
function refreshAll() {
  readSideState();
  markSideColumn();
  updateDynamicStyles();
  applySpeed();
  setupPanelObserver();
  setupOptimizedObserver();
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
    markSideColumn();
    applySpeed();
    if (readSideState()) updateDynamicStyles();
  } catch (error) {
    console.error('[YT-Enhancer] Periodic checker error:', error);
  }
}, 2000);
