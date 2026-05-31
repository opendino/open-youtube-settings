/**
 * YouTube Enhancer Content Script
 * Handles custom video filters, element visibility controls, skip animation hiders, and hotkeys.
 * Optimized for performance and cross-browser compatibility (Chrome/Firefox).
 */

// Cross-browser compatibility layer
globalThis.browser = globalThis.browser || globalThis.chrome;

// State management
let currentBrightness = 100;
let currentBlueLight = 0;
let currentHideHome = false;
let currentHideSidebar = false;
let currentHidePlaylist = true;
let currentAutoHideControls = false;
let currentHidePlayPause = false;
let currentHideSkipAnim = false;
let currentShortcuts = {};
let filtersEnabled = true;

// Create the dynamic style element
const styleElement = document.createElement('style');

/**
 * Ensures the dynamic style element is attached to the document head or document element.
 * Helps prevent styles from being lost during SPA (Single Page Application) page updates.
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

/**
 * Updates the CSS styles in the injected style element based on current extension settings.
 */
function updateDynamicStyles() {
  ensureStyleElement();
  
  let css = '';
  
  if (currentHideHome) {
    css += `
      ytd-browse[page-subtype="home"] #contents,
      ytd-browse[page-subtype="home"] ytd-rich-grid-renderer {
        display: none !important;
      }
      ytd-browse[page-subtype="home"]::before {
        content: "Odaklanma Modu Aktif - Ana sayfa akışı gizlendi.";
        display: block;
        padding: 40px;
        text-align: center;
        font-size: 1.2rem;
        color: #aaa;
      }
    `;
  }

  if (currentHideSidebar) {
    if (currentHidePlaylist) {
      css += `
        ytd-watch-flexy #secondary {
          display: none !important;
        }
        ytd-watch-flexy[flexy] #primary {
          max-width: 100% !important;
        }
      `;
    } else {
      css += `
        ytd-watch-flexy #secondary ytd-watch-next-secondary-results-renderer {
          display: none !important;
        }
        ytd-watch-flexy #secondary ytd-playlist-panel-renderer {
          display: block !important;
        }
      `;
    }
  }

  if (currentAutoHideControls) {
    css += `
      /* Hide control bar and gradient bottom by default, support transition */
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
    `;
  }

  if (currentHidePlayPause) {
    css += `
      /* Hide central play/pause bubble animations */
      .ytp-bezel,
      .ytp-bezel-text,
      .ytp-bezel-icon {
        display: none !important;
      }
    `;
  }

  styleElement.textContent = css;
}

/**
 * Applies custom brightness and blue light filter styles directly to the YouTube video element.
 */
function applyFilters() {
  try {
    const video = document.querySelector('video.html5-main-video');
    if (!video) return;

    let sepiaValue = currentBlueLight / 100;
    let brightnessValue = currentBrightness / 100;
    
    if (!filtersEnabled) {
      sepiaValue = 0;
      brightnessValue = 1;
    }
    
    video.style.filter = `brightness(${brightnessValue}) sepia(${sepiaValue}) hue-rotate(-10deg)`;
  } catch (error) {
    console.error('[YT-Enhancer] Error applying video filters:', error);
  }
}

// Initial settings load from storage
if (browser && browser.storage && browser.storage.local) {
  browser.storage.local.get([
    'brightness', 'bluelight', 'hideHome', 'hideSidebar', 
    'hidePlaylist', 'autoHideControls', 'hidePlayPause', 
    'hideSkipAnim', 'shortcuts'
  ]).then((result) => {
    if (result.brightness !== undefined) currentBrightness = Number(result.brightness);
    if (result.bluelight !== undefined) currentBlueLight = Number(result.bluelight);
    currentHideHome = !!result.hideHome;
    currentHideSidebar = !!result.hideSidebar;
    currentHidePlaylist = result.hidePlaylist !== undefined ? !!result.hidePlaylist : true;
    currentAutoHideControls = !!result.autoHideControls;
    currentHidePlayPause = !!result.hidePlayPause;
    currentHideSkipAnim = !!result.hideSkipAnim;
    if (result.shortcuts) currentShortcuts = result.shortcuts;
    
    applyFilters();
    updateDynamicStyles();
  }).catch((error) => {
    console.error('[YT-Enhancer] Error loading extension options:', error);
  });
}

// Synchronize changes automatically when options are updated in storage
if (browser && browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    
    let changed = false;
    if (changes.brightness) { currentBrightness = Number(changes.brightness.newValue); changed = true; }
    if (changes.bluelight) { currentBlueLight = Number(changes.bluelight.newValue); changed = true; }
    if (changes.hideHome) { currentHideHome = !!changes.hideHome.newValue; changed = true; }
    if (changes.hideSidebar) { currentHideSidebar = !!changes.hideSidebar.newValue; changed = true; }
    if (changes.hidePlaylist) { currentHidePlaylist = !!changes.hidePlaylist.newValue; changed = true; }
    if (changes.autoHideControls) { currentAutoHideControls = !!changes.autoHideControls.newValue; changed = true; }
    if (changes.hidePlayPause) { currentHidePlayPause = !!changes.hidePlayPause.newValue; changed = true; }
    if (changes.hideSkipAnim) { currentHideSkipAnim = !!changes.hideSkipAnim.newValue; changed = true; }
    if (changes.shortcuts) { currentShortcuts = changes.shortcuts.newValue; changed = true; }

    if (changed) {
      applyFilters();
      updateDynamicStyles();
    }
  });
}

// Listen for updates explicitly dispatched from popup
if (browser && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'UPDATE_SETTINGS') {
      currentBrightness = Number(message.brightness);
      currentBlueLight = Number(message.bluelight);
      currentHideHome = !!message.hideHome;
      currentHideSidebar = !!message.hideSidebar;
      currentHidePlaylist = message.hidePlaylist !== undefined ? !!message.hidePlaylist : true;
      currentAutoHideControls = !!message.autoHideControls;
      currentHidePlayPause = !!message.hidePlayPause;
      currentHideSkipAnim = !!message.hideSkipAnim;
      if (message.shortcuts) currentShortcuts = message.shortcuts;
      
      applyFilters();
      updateDynamicStyles();
    }
  });
}

/**
 * Formats a keyboard event into a standardized string combination.
 * @param {KeyboardEvent} e - The keyboard event object.
 * @returns {string|null} The formatted combination string, or null if invalid/modifier-only.
 */
function formatKeyCombo(e) {
  let keys = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  if (e.metaKey) keys.push('Cmd');
  
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  
  let keyName = e.key.toUpperCase();
  if (keyName === ' ') keyName = 'SPACE';
  keys.push(keyName);
  
  return keys.join('+');
}

// Hotkey Keyboard Shortcuts Listener
window.addEventListener('keydown', (e) => {
  // Ignore shortcuts if the user is typing in interactive form elements
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  const combo = formatKeyCombo(e);
  if (!combo) return;

  let changed = false;

  if (currentShortcuts['toggleHome'] === combo) {
    currentHideHome = !currentHideHome;
    changed = true;
  } else if (currentShortcuts['toggleSidebar'] === combo) {
    currentHideSidebar = !currentHideSidebar;
    changed = true;
  } else if (currentShortcuts['toggleControls'] === combo) {
    currentAutoHideControls = !currentAutoHideControls;
    changed = true;
  } else if (currentShortcuts['togglePlayPause'] === combo) {
    currentHidePlayPause = !currentHidePlayPause;
    changed = true;
  } else if (currentShortcuts['toggleSkipAnim'] === combo) {
    currentHideSkipAnim = !currentHideSkipAnim;
    changed = true;
  } else if (currentShortcuts['toggleFilters'] === combo) {
    filtersEnabled = !filtersEnabled;
    applyFilters();
    e.preventDefault();
    return;
  }

  if (changed) {
    e.preventDefault();
    updateDynamicStyles();
    
    // Save updated states to storage to synchronize with the popup UI
    if (browser && browser.storage && browser.storage.local) {
      browser.storage.local.set({
        hideHome: currentHideHome,
        hideSidebar: currentHideSidebar,
        hidePlaylist: currentHidePlaylist,
        autoHideControls: currentAutoHideControls,
        hidePlayPause: currentHidePlayPause,
        hideSkipAnim: currentHideSkipAnim
      }).catch(err => console.error('[YT-Enhancer] Error updating local storage via shortcut:', err));
    }
  }
});

// Detect YouTube SPA page transitions efficiently without heavy body-wide observers
window.addEventListener('yt-navigate-finish', () => {
  applyFilters();
  setupOptimizedObserver();
  updateDynamicStyles();
});

window.addEventListener('yt-page-type-changed', () => {
  applyFilters();
  setupOptimizedObserver();
  updateDynamicStyles();
});

let videoObserver = null;

/**
 * Initializes a highly targeted MutationObserver on the YouTube video player element.
 * Detects and hides double-tap skip overlays dynamically and quickly.
 */
function setupOptimizedObserver() {
  try {
    const player = document.querySelector('.html5-video-player');
    if (!player || player.dataset.hasHideObserver) return;
    
    if (videoObserver) {
      videoObserver.disconnect();
    }
    
    /**
     * Checks if a DOM element or node contains double tap/seek indicators and hides it.
     * @param {Element} el - The DOM element to examine.
     */
    function checkAndHide(el) {
      if (!el || !el.classList) return;
      
      // Completely ignore control bars, chrome overlays, and subtitles for safety/performance
      if (el.classList.contains('ytp-chrome-bottom') || el.closest('.ytp-chrome-bottom') ||
          el.classList.contains('ytp-chrome-top') || el.closest('.ytp-chrome-top') ||
          el.classList.contains('caption-window') || el.closest('.caption-window')) {
        return;
      }

      const text = el.textContent.trim();
      // Regex matches indicators like: "+ 5", "- 10", "< - 5", "+ 15 >", "15s", "10 sn"
      if (/^[<>]*\s*[+-]\s*\d+\s*(s|sn|sec)?\s*[<>]*$/i.test(text) && text !== "") {
        
        // Walk up to hide the complete container rather than just the text label
        let targetToHide = el;
        while (targetToHide.parentElement && 
               !targetToHide.parentElement.classList.contains('ytp-player-content') &&
               !targetToHide.parentElement.classList.contains('html5-video-player')) {
          targetToHide = targetToHide.parentElement;
        }
        
        targetToHide.style.setProperty('display', 'none', 'important');
        targetToHide.style.setProperty('opacity', '0', 'important');
        targetToHide.style.setProperty('visibility', 'hidden', 'important');
      }
    }

    videoObserver = new MutationObserver((mutations) => {
      if (!currentHideSkipAnim) return;

      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              checkAndHide(node);
              const childDivs = node.querySelectorAll('div, span');
              for (let child of childDivs) checkAndHide(child);
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

    // Start targeted observation on the player element
    videoObserver.observe(player, { 
      childList: true, 
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    player.dataset.hasHideObserver = "true";
  } catch (error) {
    console.error('[YT-Enhancer] Error setting up player MutationObserver:', error);
  }
}

// Low-frequency periodic safety checker to ensure styles and observers remain active
setInterval(() => {
  try {
    ensureStyleElement();
    applyFilters();
    setupOptimizedObserver();
  } catch (e) {
    console.error('[YT-Enhancer] Periodic checker error:', e);
  }
}, 2000);

