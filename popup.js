/**
 * Open Youtube Settings — popup controller
 * A home screen of feature cards that open their settings, a search across
 * every setting, and a first-run tour. Binds every control to storage,
 * mirrors the chosen locale into the strings the content script needs, and
 * records the keyboard shortcut next to each setting.
 */

// Cross-browser compatibility layer
globalThis.browser = globalThis.browser || globalThis.chrome;

/** Must stay in sync with DEFAULTS in content.js. */
const DEFAULTS = {
  enabled: true,
  brightness: 100,
  bluelight: 0,
  invert: false,
  filtersEnabled: true,
  applyToShorts: true,
  hideHome: false,
  hideShorts: false,
  hideSidebar: false,
  hidePlaylist: true,
  allowPanels: true,
  autoHideControls: false,
  hidePlayPause: false,
  hideSkipAnim: false,
  muteAds: false,
  speedEnabled: true,
  speedOverlay: true,
  speedStep: 0.1,
  speedDefault: 1,
  speedPersist: false,
  lastSpeed: 1,
  cropTool: true,
  cropFit: 'contain',
  clipEnabled: true,
  channelAutoVideos: false,
  blockedChannels: [],
  shortcuts: {}
};

/** Declarative map of settings key -> control element. */
const CONTROLS = {
  enabled: { id: 'enabled', kind: 'bool' },
  filtersEnabled: { id: 'filters-enabled', kind: 'bool' },
  brightness: { id: 'brightness', kind: 'range', display: 'brightness-val', format: (v) => `${Math.round(v)}%` },
  bluelight: { id: 'bluelight', kind: 'range', display: 'bluelight-val', format: (v) => `${Math.round(v)}%` },
  invert: { id: 'invert', kind: 'bool' },
  applyToShorts: { id: 'apply-to-shorts', kind: 'bool' },
  hideHome: { id: 'hide-home', kind: 'bool' },
  hideShorts: { id: 'hide-shorts', kind: 'bool' },
  hideSidebar: { id: 'hide-sidebar', kind: 'bool' },
  hidePlaylist: { id: 'hide-playlist', kind: 'bool' },
  allowPanels: { id: 'allow-panels', kind: 'bool' },
  autoHideControls: { id: 'auto-hide-controls', kind: 'bool' },
  hidePlayPause: { id: 'hide-play-pause', kind: 'bool' },
  hideSkipAnim: { id: 'hide-skip-anim', kind: 'bool', needsReload: true },
  muteAds: { id: 'mute-ads', kind: 'bool' },
  speedEnabled: { id: 'speed-enabled', kind: 'bool' },
  speedOverlay: { id: 'speed-overlay', kind: 'bool' },
  speedDefault: { id: 'speed-default', kind: 'range', display: 'speed-default-val', format: (v) => `${Number(v).toFixed(2)}×` },
  speedStep: { id: 'speed-step', kind: 'range', display: 'speed-step-val', format: (v) => Number(v).toFixed(2) },
  speedPersist: { id: 'speed-persist', kind: 'bool' },
  cropTool: { id: 'crop-tool', kind: 'bool' },
  clipEnabled: { id: 'clip-enabled', kind: 'bool' },
  channelAutoVideos: { id: 'channel-auto-videos', kind: 'bool' }
};

/** Locale keys handed to the content script, which cannot read the popup locale. */
const CONTENT_STRING_KEYS = [
  'focusMode',
  'brightness',
  'blueLightFilter',
  'speedLabel',
  'speedReset',
  'clipTitle',
  'clipSetIn',
  'clipSetOut',
  'clipPreview',
  'clipSave',
  'clipClose',
  'clipRecording',
  'clipSaved',
  'clipFailed',
  'clipNoRange',
  'blockChannel',
  'blockedChannel',
  'cropTitle',
  'cropRemove',
  'cropSelectHint'
];

const settings = Object.assign({}, DEFAULTS);

const modalOverlay = document.getElementById('modal-overlay');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

/* ----------------------------------------------------------- appearance */

/**
 * Automatic follows the browser; light and dark pin the popup. The choice is
 * also kept in localStorage so the next popup paints in it before storage
 * answers.
 */
const THEME_CACHE = 'yte-theme';
const themeButton = document.getElementById('theme-btn');
const themeMenu = document.getElementById('theme-menu');

function applyTheme(theme) {
  const choice = theme === 'light' || theme === 'dark' ? theme : 'auto';
  const root = document.documentElement;
  if (choice === 'auto') delete root.dataset.theme;
  else root.dataset.theme = choice;
  root.dataset.themeChoice = choice;
  for (const item of themeMenu.querySelectorAll('[data-theme-choice]')) {
    item.setAttribute('aria-checked', String(item.dataset.themeChoice === choice));
  }
  try {
    localStorage.setItem(THEME_CACHE, choice);
  } catch (error) {
    /* Storage blocked; the next popup starts on automatic. */
  }
}

function setThemeMenuOpen(open) {
  themeMenu.hidden = !open;
  themeButton.setAttribute('aria-expanded', String(open));
}

try {
  applyTheme(localStorage.getItem(THEME_CACHE));
} catch (error) {
  applyTheme('auto');
}

themeButton.addEventListener('click', (event) => {
  event.stopPropagation();
  setThemeMenuOpen(themeMenu.hidden);
});

for (const item of themeMenu.querySelectorAll('[data-theme-choice]')) {
  item.addEventListener('click', () => {
    applyTheme(item.dataset.themeChoice);
    setThemeMenuOpen(false);
    browser.storage.local
      .set({ theme: item.dataset.themeChoice })
      .catch((error) => console.error('[YT-Enhancer] Error saving the theme:', error));
  });
}

document.addEventListener('click', (event) => {
  if (!themeMenu.hidden && !themeMenu.contains(event.target)) setThemeMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !themeMenu.hidden) setThemeMenuOpen(false);
});

const pages = document.querySelectorAll('.page');
const searchInput = document.getElementById('search');
const langBtns = document.querySelectorAll('.lang-btn');
const shortcutBtns = document.querySelectorAll('.shortcut-btn');

let currentLang = 'en';
let currentMessages = null;
let recordingShortcutFor = null;
/** Settings to go back to when the reload prompt is cancelled. */
let restoreOnCancel = null;
/** The reload prompt is confirming a "Reset Defaults". */
let resetPending = false;

/* ------------------------------------------------------------- utilities */

function element(key) {
  const control = CONTROLS[key];
  return control ? document.getElementById(control.id) : null;
}

function readControl(key) {
  const control = CONTROLS[key];
  const node = element(key);
  if (!control || !node) return settings[key];
  return control.kind === 'bool' ? node.checked : Number(node.value);
}

function writeControl(key, value) {
  const control = CONTROLS[key];
  const node = element(key);
  if (!control || !node) return;

  if (control.kind === 'bool') {
    node.checked = !!value;
  } else {
    node.value = value;
  }

  if (control.display) {
    const display = document.getElementById(control.display);
    if (display) display.textContent = control.format(value);
  }
}

/** Reflects every setting into the UI. */
function renderAll() {
  for (const key of Object.keys(CONTROLS)) writeControl(key, settings[key]);
  renderGating();
  updateSpeedPresets();
  updateCropFit();
  renderBlocked();
  renderStatuses();
}

/* ------------------------------------------------------------ home cards */

/** A locale message with `{n}` filled in. */
function format(key, fallback, n) {
  return message(key, fallback).replace('{n}', n);
}

/** The one-line summary each home card shows, and whether it reads as "on". */
function cardStatus(page) {
  const s = settings;
  switch (page) {
    case 'colour': {
      if (!s.filtersEnabled) return [message('statusOff', 'Off'), false];
      const parts = [];
      if (Number(s.brightness) !== 100) parts.push(`☀ ${Math.round(s.brightness)}%`);
      if (Number(s.bluelight) > 0) parts.push(`☾ ${Math.round(s.bluelight)}%`);
      if (s.invert) parts.push(message('statusInverted', 'Inverted'));
      return parts.length ? [parts.join(' · '), true] : [message('statusOriginal', 'Original'), false];
    }
    case 'speed':
      return s.speedEnabled
        ? [format('statusSpeed', '{n}× default', Number(Number(s.speedDefault).toFixed(2))), true]
        : [message('statusOff', 'Off'), false];
    case 'layout': {
      const count = ['hideHome', 'hideShorts', 'hideSidebar', 'autoHideControls', 'hidePlayPause', 'hideSkipAnim'].filter((k) => s[k]).length;
      return count ? [format('statusCount', '{n} on', count), true] : [message('statusDefault', 'Default'), false];
    }
    case 'ads':
      return s.muteAds ? [message('statusMuting', 'Muting ads'), true] : [message('statusOff', 'Off'), false];
    case 'clip':
      return s.clipEnabled ? [message('statusOn', 'On'), true] : [message('statusOff', 'Off'), false];
    case 'crop':
      return s.cropTool ? [message('statusOn', 'On'), true] : [message('statusOff', 'Off'), false];
    case 'channels': {
      const count = Array.isArray(s.blockedChannels) ? s.blockedChannels.length : 0;
      return count ? [format('statusBlocked', '{n} blocked', count), true] : [message('statusNoBlocks', 'None blocked'), false];
    }
    default:
      return ['', false];
  }
}

function renderStatuses() {
  for (const card of document.querySelectorAll('.card')) {
    const [text, on] = cardStatus(card.dataset.page);
    card.querySelector('.card-status').textContent = text;
    card.classList.toggle('on', on);
  }
  document.body.classList.toggle('ext-off', !settings.enabled);
  document.getElementById('off-notice').hidden = settings.enabled;
}

/* ------------------------------------------------------------ navigation */

/** Shows the home cards, one feature's page, or search results. */
function showView(view, page) {
  document.body.dataset.view = view;
  for (const section of pages) section.classList.toggle('open', section.dataset.page === page);
  window.scrollTo(0, 0);
}

for (const button of document.querySelectorAll('button[data-page]')) {
  button.addEventListener('click', () => {
    searchInput.value = '';
    showView('page', button.dataset.page);
  });
}

for (const button of document.querySelectorAll('.back-btn')) {
  button.addEventListener('click', () => showView('home'));
}

/* ---------------------------------------------------------------- search */

/** The pieces of a page that are shown or hidden one by one while searching. */
const SEARCH_UNITS = '.row, .group-title, .preset-row, .ghost-btn, .lang-selector, #blocked-list, .empty';

function normalize(text) {
  const locale = currentLang.replace('_', '-');
  try {
    return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase(locale);
  } catch (error) {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }
}

/** Lists every setting whose name or description matches, grouped by page. */
function runSearch() {
  const query = normalize(searchInput.value);
  if (!query) {
    showView('home');
    return;
  }
  let found = false;
  for (const section of pages) {
    // A page title that matches lists the whole page; a group title that
    // matches (say "Shortcuts") lists the rows under it.
    const pageHit = normalize(section.querySelector('h2').textContent).includes(query);
    const units = [...section.querySelectorAll(SEARCH_UNITS)].filter(
      (unit) => !unit.parentElement.closest(SEARCH_UNITS)
    );
    let hits = 0;
    let group = null;
    let groupHit = false;
    const groupShown = new Map();
    for (const unit of units) {
      if (unit.matches('.group-title')) {
        group = unit;
        groupHit = normalize(unit.textContent).includes(query);
        groupShown.set(unit, groupHit);
        continue;
      }
      const hit = pageHit || groupHit || normalize(unit.textContent).includes(query);
      unit.classList.toggle('miss', !hit);
      if (!hit) continue;
      hits++;
      if (group) groupShown.set(group, true);
    }
    for (const [title, shown] of groupShown) title.classList.toggle('miss', !(pageHit || shown));
    section.classList.toggle('match', hits > 0);
    if (hits) found = true;
  }
  document.getElementById('search-empty').hidden = found;
  document.body.dataset.view = 'search';
}

searchInput.addEventListener('input', runSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchInput.value) {
    event.preventDefault();
    searchInput.value = '';
    runSearch();
  }
});

/* ------------------------------------------------------- info and hints */

for (const button of document.querySelectorAll('.info-btn')) {
  button.addEventListener('click', () => {
    const hint = button.closest('.row').querySelector('.hint');
    hint.hidden = !hint.hidden;
    button.setAttribute('aria-expanded', String(!hint.hidden));
  });
}

/* ------------------------------------------------------- first-run tour */

const intro = document.getElementById('intro');
const introSteps = intro.querySelectorAll('.intro-step');
const introNext = document.getElementById('intro-next');
let introStep = 0;

function showIntroStep(step) {
  introStep = step;
  introSteps.forEach((node, i) => (node.hidden = i !== step));
  intro.querySelectorAll('.intro-dots span').forEach((dot, i) => dot.classList.toggle('active', i === step));
  const last = step === introSteps.length - 1;
  introNext.textContent = last ? message('introDone', 'Get started') : message('introNext', 'Next');
}

function closeIntro() {
  intro.hidden = true;
  browser.storage.local
    .set({ introSeen: true })
    .catch((error) => console.error('[YT-Enhancer] Error saving the tour state:', error));
}

introNext.addEventListener('click', () => {
  if (introStep === introSteps.length - 1) closeIntro();
  else showIntroStep(introStep + 1);
});
document.getElementById('intro-skip').addEventListener('click', closeIntro);

/* ------------------------------------------------------- blocked channels */

function message(key, fallback) {
  return currentMessages && currentMessages[key] ? currentMessages[key].message : fallback;
}

function sameChannel(a, b) {
  return a.id === b.id && a.handle === b.handle && a.name === b.name;
}

/** Lists blocked channels, each with a button that unblocks it. */
function renderBlocked() {
  const list = document.getElementById('blocked-list');
  const empty = document.getElementById('blocked-empty');
  if (!list || !empty) return;
  const entries = Array.isArray(settings.blockedChannels) ? settings.blockedChannels : [];

  list.replaceChildren(
    ...entries.map((entry) => {
      const row = document.createElement('div');
      row.className = 'shortcut-group blocked-item';

      const label = document.createElement('span');
      label.textContent = entry.name || entry.handle || entry.id;
      if (entry.handle) label.title = entry.handle;

      const remove = document.createElement('button');
      remove.className = 'shortcut-clear-btn';
      remove.textContent = '✖';
      remove.title = message('unblockChannel', 'Unblock');
      remove.addEventListener('click', () => unblock(entry));

      row.append(label, remove);
      return row;
    })
  );
  empty.hidden = entries.length > 0;
}

/** Removes one channel from the newest stored list, not the one read at open. */
function unblock(entry) {
  browser.storage.local
    .get('blockedChannels')
    .then((result) => {
      const current = Array.isArray(result.blockedChannels) ? result.blockedChannels : [];
      settings.blockedChannels = current.filter((other) => !sameChannel(other, entry));
      renderBlocked();
      renderStatuses();
      commit({ blockedChannels: settings.blockedChannels });
    })
    .catch((error) => console.error('[YT-Enhancer] Error unblocking channel:', error));
}

// Channels blocked on the page while the popup is open show up at once.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.blockedChannels) return;
  settings.blockedChannels = changes.blockedChannels.newValue || [];
  renderBlocked();
  renderStatuses();
});

/** Greys out sub-controls whose parent switch is off. */
function renderGating() {
  const groups = [
    { on: settings.filtersEnabled, nodes: document.querySelectorAll('#colour-body') },
    { on: settings.hideSidebar, nodes: document.querySelectorAll('[data-sub="sidebar"]') },
    { on: settings.speedEnabled, nodes: document.querySelectorAll('#speed-body') },
    { on: settings.cropTool, nodes: document.querySelectorAll('#crop-body') }
  ];

  for (const group of groups) {
    for (const node of group.nodes) {
      node.classList.toggle('disabled', !group.on);
      for (const input of node.querySelectorAll('input, button')) {
        input.disabled = !group.on;
      }
    }
  }
}

function updateSpeedPresets() {
  for (const button of document.querySelectorAll('.speed-preset')) {
    button.classList.toggle(
      'active',
      Math.abs(Number(button.dataset.speed) - Number(settings.speedDefault)) < 0.001
    );
  }
}

function updateCropFit() {
  for (const button of document.querySelectorAll('.crop-fit')) {
    button.classList.toggle('active', button.dataset.fit === settings.cropFit);
  }
}

/* --------------------------------------------------------------- persist */

function buildContentStrings() {
  if (!currentMessages) return null;
  const strings = {};
  for (const key of CONTENT_STRING_KEYS) {
    if (currentMessages[key] && currentMessages[key].message) {
      strings[key] = currentMessages[key].message;
    }
  }
  return Object.keys(strings).length ? strings : null;
}

/**
 * Settings the page changes on its own: `lastSpeed` with every speed change,
 * `blockedChannels` from the block button on each card. They are only sent
 * when the caller means to change them (`extra`); otherwise the values read
 * when the popup opened would undo newer changes.
 */
const PAGE_OWNED_KEYS = ['lastSpeed', 'blockedChannels'];

/** Writes the current state to storage and pushes it to every YouTube tab. */
function commit(extra = {}) {
  const payload = Object.assign({}, settings, extra);
  for (const key of PAGE_OWNED_KEYS) {
    if (!(key in extra)) delete payload[key];
  }

  browser.storage.local
    .set(payload)
    .catch((error) => console.error('[YT-Enhancer] Error saving options to storage:', error));

  browser.tabs
    .query({ url: '*://*.youtube.com/*' })
    .then((tabs) => {
      for (const tab of tabs) {
        browser.tabs
          .sendMessage(tab.id, Object.assign({ type: 'UPDATE_SETTINGS' }, payload))
          .catch(() => {
            /* Tab has no content script yet; storage sync covers it. */
          });
      }
    })
    .catch((error) =>
      console.error('[YT-Enhancer] Error querying tabs to send update:', error)
    );
}

/** Pulls every control's value into state, then persists. */
function collectAndCommit(extra = {}) {
  for (const key of Object.keys(CONTROLS)) settings[key] = readControl(key);
  renderGating();
  updateSpeedPresets();
  renderStatuses();
  commit(extra);
}

/* ------------------------------------------------------------ init load */

browser.storage.local
  .get([...Object.keys(DEFAULTS), 'language', 'introSeen', 'theme'])
  .then((result) => {
    applyTheme(result.theme);
    if (!result.introSeen) {
      intro.hidden = false;
      showIntroStep(0);
    }
    for (const key of Object.keys(DEFAULTS)) {
      if (result[key] === undefined) continue;
      settings[key] =
        typeof DEFAULTS[key] === 'boolean'
          ? !!result[key]
          : typeof DEFAULTS[key] === 'number'
            ? Number(result[key])
            : result[key];
    }
    if (result.language) currentLang = result.language;

    renderAll();
    loadLanguage(currentLang);
  })
  .catch((error) => {
    console.error('[YT-Enhancer] Error reading options from storage:', error);
    renderAll();
    loadLanguage(currentLang);
  });

/* ------------------------------------------------------------- controls */

for (const [key, control] of Object.entries(CONTROLS)) {
  const node = element(key);
  if (!node) continue;

  if (control.needsReload) {
    node.addEventListener('change', () => {
      // `settings` still holds the value from before this click.
      restoreOnCancel = Object.assign({}, settings);
      resetPending = false;
      modalOverlay.classList.add('active');
    });
    continue;
  }

  node.addEventListener(control.kind === 'bool' ? 'change' : 'input', () => {
    if (control.display) {
      const display = document.getElementById(control.display);
      if (display) display.textContent = control.format(node.value);
    }
    collectAndCommit();
  });
}

document.getElementById('original-colors').addEventListener('click', () => {
  settings.brightness = DEFAULTS.brightness;
  settings.bluelight = DEFAULTS.bluelight;
  settings.invert = DEFAULTS.invert;
  settings.filtersEnabled = true;
  renderAll();
  commit();
});

for (const button of document.querySelectorAll('.speed-preset')) {
  button.addEventListener('click', () => {
    settings.speedDefault = Number(button.dataset.speed);
    settings.lastSpeed = settings.speedDefault;
    renderAll();
    commit({ lastSpeed: settings.lastSpeed });
  });
}

for (const button of document.querySelectorAll('.crop-fit')) {
  button.addEventListener('click', () => {
    settings.cropFit = button.dataset.fit;
    renderAll();
    commit({ cropFit: settings.cropFit });
  });
}

document.getElementById('reset').addEventListener('click', () => {
  const before = Object.assign({}, settings);

  for (const key of Object.keys(CONTROLS)) settings[key] = DEFAULTS[key];
  settings.filtersEnabled = DEFAULTS.filtersEnabled;
  settings.lastSpeed = DEFAULTS.lastSpeed;
  settings.cropFit = DEFAULTS.cropFit;
  renderAll();

  if (before.hideSkipAnim) {
    // Turning the skip-animation hider off needs a reload; nothing is saved
    // until the user confirms, and cancelling puts everything back.
    restoreOnCancel = before;
    resetPending = true;
    modalOverlay.classList.add('active');
  } else {
    commit({ lastSpeed: settings.lastSpeed });
  }
});

/* ----------------------------------------------------------- reload modal */

modalConfirmBtn.addEventListener('click', () => {
  collectAndCommit(resetPending ? { lastSpeed: settings.lastSpeed } : {});
  restoreOnCancel = null;
  resetPending = false;

  browser.tabs
    .query({ url: '*://*.youtube.com/*' })
    .then((tabs) => {
      for (const tab of tabs) {
        browser.tabs
          .reload(tab.id)
          .catch((error) => console.error('[YT-Enhancer] Error reloading tab:', error));
      }
    })
    .catch((error) =>
      console.error('[YT-Enhancer] Error querying tabs for reload:', error)
    );

  modalOverlay.classList.remove('active');
});

modalCancelBtn.addEventListener('click', () => {
  if (restoreOnCancel) Object.assign(settings, restoreOnCancel);
  restoreOnCancel = null;
  resetPending = false;
  renderAll();
  modalOverlay.classList.remove('active');
});

/* ------------------------------------------------------------- shortcuts */

/** Keyboard glyph a shortcut button shows while it has no keys assigned. */
const KEYBOARD_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>';

/** Each shortcut button shows its keys, or a keyboard glyph when unset. */
function updateShortcutButtons() {
  for (const btn of shortcutBtns) {
    const combo = settings.shortcuts[btn.dataset.shortcut];
    if (combo) btn.textContent = combo;
    else btn.innerHTML = KEYBOARD_ICON;
    btn.classList.toggle('set', !!combo);
    const clear = btn.nextElementSibling;
    if (clear && clear.classList.contains('shortcut-clear-btn')) clear.hidden = !combo;
  }
}

function stopRecording() {
  recordingShortcutFor = null;
  for (const btn of shortcutBtns) btn.classList.remove('recording');
  updateShortcutButtons();
}

function saveShortcuts() {
  browser.storage.local
    .set({ shortcuts: settings.shortcuts })
    .catch((error) => console.error('[YT-Enhancer] Error saving shortcuts:', error));
  commit();
}

for (const btn of shortcutBtns) {
  btn.addEventListener('click', (event) => {
    event.stopPropagation();

    if (recordingShortcutFor === btn.dataset.shortcut) {
      stopRecording();
      return;
    }

    for (const other of shortcutBtns) other.classList.remove('recording');
    recordingShortcutFor = btn.dataset.shortcut;
    btn.classList.add('recording');
    btn.textContent =
      currentMessages && currentMessages.shortcutRecording
        ? currentMessages.shortcutRecording.message
        : 'Press key…';
  });
}

for (const btn of document.querySelectorAll('.shortcut-clear-btn')) {
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    delete settings.shortcuts[btn.dataset.shortcut];
    if (recordingShortcutFor === btn.dataset.shortcut) recordingShortcutFor = null;
    stopRecording();
    saveShortcuts();
  });
}

window.addEventListener('keydown', (event) => {
  if (!recordingShortcutFor) return;
  event.preventDefault();

  if (event.key === 'Escape') {
    stopRecording();
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    delete settings.shortcuts[recordingShortcutFor];
    stopRecording();
    saveShortcuts();
    return;
  }

  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;

  const keys = [];
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Cmd');

  let keyName = event.key.toUpperCase();
  if (keyName === ' ') keyName = 'SPACE';
  keys.push(keyName);

  const combo = keys.join('+');

  // A combo can only drive one action; release it from any previous owner.
  for (const [action, assigned] of Object.entries(settings.shortcuts)) {
    if (assigned === combo && action !== recordingShortcutFor) {
      delete settings.shortcuts[action];
    }
  }

  settings.shortcuts[recordingShortcutFor] = combo;
  stopRecording();
  saveShortcuts();
});

window.addEventListener('click', () => {
  if (recordingShortcutFor) stopRecording();
});

/* -------------------------------------------------------------- language */

function applyTranslations(messages) {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.dataset.i18n;
    if (!messages[key] || !messages[key].message) continue;
    if (el.tagName === 'INPUT' && el.type === 'button') {
      el.value = messages[key].message;
    } else {
      el.textContent = messages[key].message;
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const entry = messages[el.dataset.i18nTitle];
    if (!entry || !entry.message) continue;
    el.title = entry.message;
    el.setAttribute('aria-label', entry.message);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const entry = messages[el.dataset.i18nPlaceholder];
    if (entry && entry.message) el.placeholder = entry.message;
  }
  updateShortcutButtons();
  renderBlocked();
  renderStatuses();
  if (!intro.hidden) showIntroStep(introStep);
  if (searchInput.value) runSearch();
}

async function loadLanguage(lang) {
  try {
    const response = await fetch(`_locales/${lang}/messages.json`);
    if (!response.ok) {
      console.error('[YT-Enhancer] Failed to load language file:', lang);
      return;
    }

    currentMessages = await response.json();
    applyTranslations(currentMessages);

    for (const btn of langBtns) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
      if (btn.dataset.lang === lang) document.getElementById('lang-name').textContent = btn.textContent;
    }
    document.documentElement.lang = lang.replace('_', '-');

    // Hand the on-page strings to the content script.
    const contentStrings = buildContentStrings();
    if (contentStrings) {
      browser.storage.local
        .set({ contentStrings })
        .catch((error) =>
          console.error('[YT-Enhancer] Error saving content strings:', error)
        );
      commit({ contentStrings });
    }
  } catch (error) {
    console.error('[YT-Enhancer] Error fetching language:', error);
  }
}

for (const btn of langBtns) {
  btn.addEventListener('click', () => {
    currentLang = btn.dataset.lang;
    browser.storage.local
      .set({ language: currentLang })
      .catch((error) => console.error('[YT-Enhancer] Error saving language:', error));
    loadLanguage(currentLang);
  });
}
