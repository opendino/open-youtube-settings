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

function applyAllSettings() {
  applyFilters();
  updateDynamicStyles();
}

function loadSettingsFromStorage() {
  return browser.storage.local
    .get([
      'brightness',
      'bluelight',
      'hideHome',
      'hideSidebar',
      'hidePlaylist',
      'autoHideControls',
      'hidePlayPause',
      'hideSkipAnim',
      'shortcuts'
    ])
    .then((result) => {
      if (result.brightness !== undefined) currentBrightness = result.brightness;
      if (result.bluelight !== undefined) currentBlueLight = result.bluelight;
      currentHideHome = result.hideHome || false;
      currentHideSidebar = result.hideSidebar || false;
      currentHidePlaylist = result.hidePlaylist !== undefined ? result.hidePlaylist : true;
      currentAutoHideControls = result.autoHideControls || false;
      currentHidePlayPause = result.hidePlayPause || false;
      currentHideSkipAnim = result.hideSkipAnim || false;
      if (result.shortcuts) currentShortcuts = result.shortcuts;
    });
}

// Inject a style element to control visibility via CSS
const styleElement = document.createElement('style');
document.head.appendChild(styleElement);

function updateDynamicStyles() {
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
      /* Paneli ve gölgeyi varsayılan olarak gizle, ancak hover algılayabilmesi için pointer-events açık kalsın */
      .ytp-chrome-bottom, 
      .ytp-gradient-bottom {
        opacity: 0 !important;
        transition: opacity 0.3s ease-in-out !important;
      }
      
      /* SADECE fare imleci panelin bulunduğu gizli alana (alt kısma) geldiğinde göster */
      .ytp-chrome-bottom:hover,
      .ytp-gradient-bottom:hover {
        opacity: 1 !important;
      }

      /* Ses değiştirirken veya ayarlar menüsü açıkken paneli görünür tut */
      .ytp-volume-panel-active .ytp-chrome-bottom,
      .ytp-settings-menu-opened .ytp-chrome-bottom {
        opacity: 1 !important;
      }
    `;
  }

  if (currentHidePlayPause) {
    css += `
      /* Oynat/Durdur ortadaki animasyon kutusu ve ikonları */
      .ytp-bezel,
      .ytp-bezel-text,
      .ytp-bezel-icon {
        display: none !important;
      }
    `;
  }

  styleElement.textContent = css;
}

function applyFilters() {
  const video = document.querySelector('video.html5-main-video');
  if (!video) return;

  let sepiaValue = currentBlueLight / 100;
  let brightnessValue = currentBrightness / 100;
  
  if (!filtersEnabled) {
    sepiaValue = 0;
    brightnessValue = 1;
  }
  
  video.style.filter = `brightness(${brightnessValue}) sepia(${sepiaValue}) hue-rotate(-10deg)`;
}

// Initial load from storage
loadSettingsFromStorage().then(() => {
  applyAllSettings();
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_SETTINGS') {
    currentBrightness = message.brightness;
    currentBlueLight = message.bluelight;
    currentHideHome = message.hideHome;
    currentHideSidebar = message.hideSidebar;
    currentHidePlaylist = message.hidePlaylist !== undefined ? message.hidePlaylist : true;
    currentAutoHideControls = message.autoHideControls;
    currentHidePlayPause = message.hidePlayPause;
    currentHideSkipAnim = message.hideSkipAnim;
    if (message.shortcuts) currentShortcuts = message.shortcuts;
    
    applyAllSettings();
  }
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  if (changes.brightness) currentBrightness = changes.brightness.newValue;
  if (changes.bluelight) currentBlueLight = changes.bluelight.newValue;
  if (changes.hideHome) currentHideHome = changes.hideHome.newValue;
  if (changes.hideSidebar) currentHideSidebar = changes.hideSidebar.newValue;
  if (changes.hidePlaylist) currentHidePlaylist = changes.hidePlaylist.newValue;
  if (changes.autoHideControls) currentAutoHideControls = changes.autoHideControls.newValue;
  if (changes.hidePlayPause) currentHidePlayPause = changes.hidePlayPause.newValue;
  if (changes.hideSkipAnim) currentHideSkipAnim = changes.hideSkipAnim.newValue;
  if (changes.shortcuts) currentShortcuts = changes.shortcuts.newValue || {};

  applyAllSettings();
});

// Shortcut formatting and listening
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

window.addEventListener('keydown', (e) => {
  // Ignore if typing in an input
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
    // filtersEnabled is just local state for now, don't need to sync to popup 
    // unless we want a toggle in popup, but there is no toggle in popup for it.
    e.preventDefault();
    return;
  }

  if (changed) {
    e.preventDefault();
    updateDynamicStyles();
    
    // Sync state so popup displays correctly when opened
    browser.storage.local.set({
      hideHome: currentHideHome,
      hideSidebar: currentHideSidebar,
      hidePlaylist: currentHidePlaylist,
      autoHideControls: currentAutoHideControls,
      hidePlayPause: currentHidePlayPause,
      hideSkipAnim: currentHideSkipAnim
    });
  }
});

// Performansı artırmak için SPA (Sayfa Değişimi) dedektörünü yavaşlatıyoruz (Debounce)
let filterTimeout;
const spaObserver = new MutationObserver(() => {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    applyFilters();
    setupOptimizedObserver();
  }, 500);
});
spaObserver.observe(document.body, { childList: true, subtree: true });

let videoObserver = null;
function setupOptimizedObserver() {
  const player = document.querySelector('.html5-video-player');
  if (!player || player.dataset.hasHideObserver) return;
  
  if (videoObserver) videoObserver.disconnect();
  
  function checkAndHide(el) {
    if (!el || !el.classList) return;
    
    // Alt/üst panelleri ve altyazıları kesinlikle yoksay (performans ve güvenlik için)
    if (el.classList.contains('ytp-chrome-bottom') || el.closest('.ytp-chrome-bottom') ||
        el.classList.contains('ytp-chrome-top') || el.closest('.ytp-chrome-top') ||
        el.classList.contains('caption-window') || el.closest('.caption-window')) {
      return;
    }

    const text = el.textContent.trim();
    // Metin imzası: "+ 5", "- 10", "< - 5", "+ 15 >" veya "15s", "15 sn" gibi türevleri
    if (/^[<>]*\s*[+-]\s*\d+\s*(s|sn|sec)?\s*[<>]*$/i.test(text) && text !== "") {
      
      // Sadece yazıyı değil, tüm animasyon kutusunu (SVG ikonlar ve arka plan dahil) gizlemek için en üst kapsayıcıyı bul
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

  // Oynatıcıyı dinle: yeni element eklendiğinde, yazı değiştiğinde veya class/style değiştiğinde tetiklenir
  videoObserver.observe(player, { 
    childList: true, 
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  player.dataset.hasHideObserver = "true";
}

setInterval(() => {
  applyFilters();
  setupOptimizedObserver();
}, 2000);

function syncAndReapply() {
  loadSettingsFromStorage().then(() => {
    applyAllSettings();
    setupOptimizedObserver();
  });
}

window.addEventListener('focus', syncAndReapply);
window.addEventListener('pageshow', syncAndReapply);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncAndReapply();
});
window.addEventListener('yt-navigate-finish', syncAndReapply);
