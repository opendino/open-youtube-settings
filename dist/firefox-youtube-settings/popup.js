/**
 * Open Youtube Settings — popup controller
 * Binds every control to storage, mirrors the chosen locale into the strings
 * the content script needs, and records keyboard shortcuts.
 */

// Cross-browser compatibility layer
globalThis.browser = globalThis.browser || globalThis.chrome;

/** Must stay in sync with DEFAULTS in content.js. */
const DEFAULTS = {
  brightness: 100,
  bluelight: 0,
  invert: false,
  filtersEnabled: true,
  applyToShorts: true,
  hideHome: false,
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
  cropEnabled: false,
  cropZoom: 100,
  cropOffsetY: 0,
  clipEnabled: true,
  channelAutoVideos: false,
  shortcuts: {}
};

/** Declarative map of settings key -> control element. */
const CONTROLS = {
  brightness: { id: 'brightness', kind: 'range', display: 'brightness-val', format: (v) => `${Math.round(v)}%` },
  bluelight: { id: 'bluelight', kind: 'range', display: 'bluelight-val', format: (v) => `${Math.round(v)}%` },
  invert: { id: 'invert', kind: 'bool' },
  applyToShorts: { id: 'apply-to-shorts', kind: 'bool' },
  hideHome: { id: 'hide-home', kind: 'bool' },
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
  cropEnabled: { id: 'crop-enabled', kind: 'bool' },
  cropZoom: { id: 'crop-zoom', kind: 'range', display: 'crop-zoom-val', format: (v) => `${Math.round(v)}%` },
  cropOffsetY: { id: 'crop-offset', kind: 'range', display: 'crop-offset-val', format: (v) => `${Math.round(v)}%` },
  clipEnabled: { id: 'clip-enabled', kind: 'bool' },
  channelAutoVideos: { id: 'channel-auto-videos', kind: 'bool' }
};

/** Locale keys handed to the content script, which cannot read the popup locale. */
const CONTENT_STRING_KEYS = [
  'focusMode',
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
  'clipNoRange'
];

const settings = Object.assign({}, DEFAULTS);

const modalOverlay = document.getElementById('modal-overlay');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
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
}

/** Greys out sub-controls whose parent switch is off. */
function renderGating() {
  const groups = [
    { on: settings.hideSidebar, nodes: document.querySelectorAll('[data-sub="sidebar"]') },
    { on: settings.speedEnabled, nodes: document.querySelectorAll('#speed-body') },
    { on: settings.cropEnabled, nodes: document.querySelectorAll('#crop-body') }
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
 * Writes the current state to storage and pushes it to every YouTube tab.
 * `lastSpeed` belongs to the page, which moves it with every speed change, so
 * it is only sent when the caller means to set the speed (`extra.lastSpeed`);
 * otherwise the value read when the popup opened would undo newer changes.
 */
function commit(extra = {}) {
  const payload = Object.assign({}, settings, extra);
  if (!('lastSpeed' in extra)) delete payload.lastSpeed;

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
  commit(extra);
}

/* ------------------------------------------------------------ init load */

browser.storage.local
  .get([...Object.keys(DEFAULTS), 'language'])
  .then((result) => {
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

document.getElementById('reset').addEventListener('click', () => {
  const before = Object.assign({}, settings);

  for (const key of Object.keys(CONTROLS)) settings[key] = DEFAULTS[key];
  settings.filtersEnabled = DEFAULTS.filtersEnabled;
  settings.lastSpeed = DEFAULTS.lastSpeed;
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

/* ------------------------------------------------------------------ tabs */

for (const btn of tabBtns) {
  btn.addEventListener('click', () => {
    for (const other of tabBtns) other.classList.remove('active');
    for (const content of tabContents) content.classList.remove('active');
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
}

/* ------------------------------------------------------------- shortcuts */

function shortcutLabel() {
  return currentMessages && currentMessages.shortcutNotSet
    ? currentMessages.shortcutNotSet.message
    : 'Click to set';
}

function updateShortcutButtons() {
  for (const btn of shortcutBtns) {
    const key = btn.dataset.shortcut;
    btn.textContent = settings.shortcuts[key] || shortcutLabel();
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
  updateShortcutButtons();
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
    }

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
