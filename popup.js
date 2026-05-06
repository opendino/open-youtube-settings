const brightnessSlider = document.getElementById('brightness');
const bluelightSlider = document.getElementById('bluelight');
const brightnessVal = document.getElementById('brightness-val');
const bluelightVal = document.getElementById('bluelight-val');
const hideHomeToggle = document.getElementById('hide-home');
const hideSidebarToggle = document.getElementById('hide-sidebar');
const hidePlaylistToggle = document.getElementById('hide-playlist');
const hidePlaylistGroup = document.querySelector('.sub-toggle-group');
const autoHideControlsToggle = document.getElementById('auto-hide-controls');
const hidePlayPauseToggle = document.getElementById('hide-play-pause');
const hideSkipAnimToggle = document.getElementById('hide-skip-anim');
const resetBtn = document.getElementById('reset');

const modalOverlay = document.getElementById('modal-overlay');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Language
const langBtns = document.querySelectorAll('.lang-btn');
let currentLang = 'en';

// Shortcuts
const shortcutBtns = document.querySelectorAll('.shortcut-btn');
let currentShortcuts = {};
let recordingShortcutFor = null;

let pendingTabId = null;
let revertSkipAnimState = false;

// --- Initialization ---
browser.storage.local.get(['brightness', 'bluelight', 'hideHome', 'hideSidebar', 'hidePlaylist', 'autoHideControls', 'hidePlayPause', 'hideSkipAnim', 'language', 'shortcuts']).then((result) => {
  // Restore Settings
  if (result.brightness) {
    brightnessSlider.value = result.brightness;
    brightnessVal.textContent = result.brightness + '%';
  }
  if (result.bluelight) {
    bluelightSlider.value = result.bluelight;
    bluelightVal.textContent = result.bluelight + '%';
  }
  hideHomeToggle.checked = result.hideHome || false;
  hideSidebarToggle.checked = result.hideSidebar || false;
  hidePlaylistToggle.checked = result.hidePlaylist !== undefined ? result.hidePlaylist : true;
  autoHideControlsToggle.checked = result.autoHideControls || false;
  hidePlayPauseToggle.checked = result.hidePlayPause || false;
  hideSkipAnimToggle.checked = result.hideSkipAnim || false;
  updateSidebarSubToggleState();

  // Restore Language
  if (result.language) {
    currentLang = result.language;
  }
  loadLanguage(currentLang);

  // Restore Shortcuts
  if (result.shortcuts) {
    currentShortcuts = result.shortcuts;
    updateShortcutButtons();
  }
});

// --- Tab Switching ---
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// --- Settings Logic ---
function showCustomModal() {
  modalOverlay.classList.add('active');
}

function hideCustomModal() {
  modalOverlay.classList.remove('active');
}

modalConfirmBtn.addEventListener('click', () => {
  updateSettings();
  browser.tabs.query({ url: "*://*.youtube.com/*" }).then((tabs) => {
    for (const tab of tabs) {
      browser.tabs.reload(tab.id);
    }
  });
  hideCustomModal();
});

modalCancelBtn.addEventListener('click', () => {
  hideSkipAnimToggle.checked = revertSkipAnimState;
  hideCustomModal();
});

function updateSettings() {
  const brightness = brightnessSlider.value;
  const bluelight = bluelightSlider.value;
  const hideHome = hideHomeToggle.checked;
  const hideSidebar = hideSidebarToggle.checked;
  const hidePlaylist = hidePlaylistToggle.checked;
  const autoHideControls = autoHideControlsToggle.checked;
  const hidePlayPause = hidePlayPauseToggle.checked;
  const hideSkipAnim = hideSkipAnimToggle.checked;

  brightnessVal.textContent = brightness + '%';
  bluelightVal.textContent = bluelight + '%';

  browser.storage.local.set({ brightness, bluelight, hideHome, hideSidebar, hidePlaylist, autoHideControls, hidePlayPause, hideSkipAnim });

  browser.tabs.query({ url: "*://*.youtube.com/*" }).then((tabs) => {
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, {
        type: 'UPDATE_SETTINGS',
        brightness, bluelight, hideHome, hideSidebar, hidePlaylist, autoHideControls, hidePlayPause, hideSkipAnim,
        shortcuts: currentShortcuts
      }).catch(err => console.log('Tab not ready:', err));
    }
  });
}

function updateSidebarSubToggleState() {
  const sidebarEnabled = hideSidebarToggle.checked;
  hidePlaylistGroup.classList.toggle('disabled', !sidebarEnabled);
  hidePlaylistToggle.disabled = !sidebarEnabled;
}

brightnessSlider.addEventListener('input', () => updateSettings());
bluelightSlider.addEventListener('input', () => updateSettings());
hideHomeToggle.addEventListener('change', () => updateSettings());
hideSidebarToggle.addEventListener('change', () => {
  updateSidebarSubToggleState();
  updateSettings();
});
hidePlaylistToggle.addEventListener('change', () => updateSettings());
autoHideControlsToggle.addEventListener('change', () => updateSettings());
hidePlayPauseToggle.addEventListener('change', () => updateSettings());

hideSkipAnimToggle.addEventListener('change', (e) => {
  revertSkipAnimState = !e.target.checked;
  showCustomModal();
});

resetBtn.addEventListener('click', () => {
  brightnessSlider.value = 100;
  bluelightSlider.value = 0;
  hideHomeToggle.checked = false;
  hideSidebarToggle.checked = false;
  hidePlaylistToggle.checked = true;
  autoHideControlsToggle.checked = false;
  hidePlayPauseToggle.checked = false;
  updateSidebarSubToggleState();

  let wasSkipAnimChecked = hideSkipAnimToggle.checked;
  hideSkipAnimToggle.checked = false;

  if (wasSkipAnimChecked) {
    revertSkipAnimState = true;
    showCustomModal();
  } else {
    updateSettings();
  }
});

// --- Shortcut Logic ---
function updateShortcutButtons() {
  shortcutBtns.forEach(btn => {
    const key = btn.dataset.shortcut;
    if (currentShortcuts[key]) {
      btn.textContent = currentShortcuts[key];
    } else {
      // Revert to default translation text if not set
      const defaultText = currentMessages && currentMessages['shortcutNotSet'] 
        ? currentMessages['shortcutNotSet'].message 
        : 'Click to set';
      btn.textContent = defaultText;
    }
  });
}

shortcutBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    // If already recording, stop
    if (recordingShortcutFor === btn.dataset.shortcut) {
      recordingShortcutFor = null;
      btn.classList.remove('recording');
      updateShortcutButtons();
      return;
    }

    // Stop others
    shortcutBtns.forEach(b => b.classList.remove('recording'));
    
    // Start recording
    recordingShortcutFor = btn.dataset.shortcut;
    btn.classList.add('recording');
    btn.textContent = currentMessages && currentMessages['shortcutRecording'] 
      ? currentMessages['shortcutRecording'].message 
      : 'Recording...';
    
    e.stopPropagation(); // prevent window click from immediately cancelling
  });
});

window.addEventListener('keydown', (e) => {
  if (!recordingShortcutFor) return;
  e.preventDefault();

  if (e.key === 'Escape') {
    // Cancel recording
    recordingShortcutFor = null;
    updateShortcutButtons();
    document.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('recording'));
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    // Clear shortcut
    delete currentShortcuts[recordingShortcutFor];
    browser.storage.local.set({ shortcuts: currentShortcuts });
    recordingShortcutFor = null;
    updateShortcutButtons();
    document.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('recording'));
    updateSettings(); // sync to content
    return;
  }

  let keys = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  if (e.metaKey) keys.push('Cmd');
  
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return; // Wait for full combo
  
  let keyName = e.key.toUpperCase();
  if (keyName === ' ') keyName = 'SPACE';
  keys.push(keyName);
  
  const combo = keys.join('+');
  
  currentShortcuts[recordingShortcutFor] = combo;
  browser.storage.local.set({ shortcuts: currentShortcuts });
  
  recordingShortcutFor = null;
  updateShortcutButtons();
  document.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('recording'));
  updateSettings(); // Sync to content
});

window.addEventListener('click', () => {
  if (recordingShortcutFor) {
    recordingShortcutFor = null;
    updateShortcutButtons();
    document.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('recording'));
  }
});


// --- Language Logic ---
let currentMessages = null;

function applyTranslations(messages) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (messages[key] && messages[key].message) {
      if (el.tagName === 'INPUT' && el.type === 'button') {
        el.value = messages[key].message;
      } else {
        el.textContent = messages[key].message;
      }
    }
  });

  // Update shortcut buttons if they are empty
  updateShortcutButtons();

  // Special logic: The Language tab title should show the localized word for "Language"
  if (messages['tabLanguage'] && messages['tabLanguage'].message) {
    document.getElementById('tab-lang-btn').textContent = messages['tabLanguage'].message;
  }
}

async function loadLanguage(lang) {
  try {
    const response = await fetch(`_locales/${lang}/messages.json`);
    if (response.ok) {
      currentMessages = await response.json();
      applyTranslations(currentMessages);
      
      // Update active state on language buttons
      langBtns.forEach(btn => {
        if (btn.dataset.lang === lang) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    } else {
      console.error('Failed to load language file', lang);
    }
  } catch (err) {
    console.error('Error fetching language', err);
  }
}

langBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    currentLang = lang;
    browser.storage.local.set({ language: lang });
    loadLanguage(lang);
  });
});
