/**
 * Open Youtube Settings — on-player overlay
 *
 * Speed, clip and crop buttons in YouTube's control bar, the speed preset
 * tray, a drag-to-select crop and an mpv/uosc-style clip bar that records a
 * marked range straight from the playing video element and downloads it.
 * Relies on the shared state published by content.js.
 */

(function () {
  const YTE = globalThis.__YTE__;
  if (!YTE) {
    console.error('[YT-Enhancer] Core content script missing; overlay disabled.');
    return;
  }

  const S = YTE.settings;
  const STR = YTE.strings;

  const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const OVERLAY_CSS = `
    #yte-osc {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 61;
      font-family: 'Inter', 'Roboto', system-ui, sans-serif;
      color: #e8eaf0;
    }
    #yte-osc * { box-sizing: border-box; }

    #yte-osc .yte-panel {
      background: rgba(15, 17, 21, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    #yte-osc button {
      font: inherit;
      color: #e8eaf0;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      padding: 4px 8px;
      cursor: pointer;
      line-height: 1.4;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    #yte-osc button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 90, 61, 0.7);
    }
    #yte-osc button:disabled { opacity: 0.45; cursor: default; }
    #yte-osc button.yte-primary {
      background: linear-gradient(90deg, #ff5a3d, #ff7a2f);
      border-color: transparent;
      font-weight: 600;
    }

    /* --- speed tray, opened from the speed button in the control bar --- */
    #yte-osc .yte-speed-tray {
      position: absolute;
      pointer-events: auto;
      display: none;
      align-items: center;
      gap: 4px;
      padding: 6px;
      border-radius: 10px;
      font-size: 11px;
      white-space: nowrap;
    }
    #yte-osc.yte-tray-open .yte-speed-tray { display: flex; }
    #yte-osc .yte-speed-tray button { font-variant-numeric: tabular-nums; }
    #yte-osc .yte-step { border-radius: 999px; width: 24px; padding: 2px 0; text-align: center; }
    #yte-osc .yte-speed-tray button.yte-current { border-color: #ff5a3d; color: #ff8a6d; }

    /* --- clip bar --- */
    #yte-osc .yte-clip {
      position: absolute;
      left: 50%;
      bottom: 62px;
      width: min(760px, calc(100% - 24px));
      transform: translateX(-50%);
      pointer-events: auto;
      display: none;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      font-size: 12px;
    }
    #yte-osc.yte-clip-open .yte-clip { display: flex; }

    #yte-osc .yte-track {
      position: relative;
      height: 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.16);
      cursor: pointer;
    }
    #yte-osc .yte-range {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 0;
      border-radius: 4px;
      background: linear-gradient(90deg, #ff5a3d, #ff7a2f);
    }
    #yte-osc .yte-head {
      position: absolute;
      top: -4px;
      width: 2px;
      height: 16px;
      margin-left: -1px;
      background: #fff;
      border-radius: 1px;
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
    }
    #yte-osc .yte-mark {
      position: absolute;
      top: -6px;
      width: 3px;
      height: 20px;
      margin-left: -1px;
      background: #ffd7cc;
      border-radius: 1px;
      display: none;
    }
    #yte-osc .yte-mark.yte-set { display: block; }

    #yte-osc .yte-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    #yte-osc .yte-times {
      font-variant-numeric: tabular-nums;
      color: rgba(232, 234, 240, 0.78);
      margin-right: auto;
    }
    #yte-osc .yte-times b { color: #ff8a6d; font-weight: 600; }

    #yte-osc .yte-toast {
      position: absolute;
      left: 50%;
      top: 16px;
      transform: translateX(-50%);
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }
    #yte-osc .yte-toast.yte-visible { opacity: 1; }

    #yte-osc.yte-recording .yte-clip { border-color: rgba(255, 90, 61, 0.85); }

    /* --- crop selection: a tinted layer the user drags a box on --- */
    #yte-osc .yte-crop-layer {
      position: absolute;
      inset: 0;
      display: none;
      overflow: hidden;
      pointer-events: auto;
      cursor: crosshair;
      background: rgba(0, 0, 0, 0.4);
      touch-action: none;
    }
    #yte-osc.yte-cropping .yte-crop-layer { display: block; }
    #yte-osc .yte-crop-layer.yte-dragging { background: transparent; }
    #yte-osc .yte-crop-rect {
      position: absolute;
      display: none;
      border: 2px solid #fff;
      box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.4);
    }
    #yte-osc .yte-crop-layer.yte-dragging .yte-crop-rect { display: block; }
    #yte-osc .yte-crop-hint {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 6px 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      white-space: nowrap;
      cursor: default;
    }
    #yte-osc .yte-crop-layer.yte-dragging .yte-crop-hint { display: none; }

    /* --- buttons in YouTube's control bar --- */
    .ytp-button.yte-ctl {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: top;
    }
    .ytp-button.yte-ctl[hidden] { display: none; }
    .ytp-button.yte-ctl-speed {
      width: auto;
      min-width: 48px;
      padding: 0 6px;
      color: #fff;
      font: 500 13px 'Roboto', 'Arial', sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .ytp-button.yte-ctl-clip svg,
    .ytp-button.yte-ctl-crop svg { width: 24px; height: 24px; fill: #fff; }
    .ytp-button.yte-ctl-clip[aria-pressed='true'] svg,
    .ytp-button.yte-ctl-crop[aria-pressed='true'] svg { fill: #ff7a5c; }
  `;

  /** Crop marks, in the line weight of YouTube's own control icons. */
  const CROP_ICON = 'M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z';

  /** Scissors, in the line weight of YouTube's own control icons. */
  const CLIP_ICON = 'M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z';

  /** A control-bar icon built from path data (no HTML parsing on the page). */
  function svgIcon(d) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
    return svg;
  }

  let root = null;
  let speedButton = null;
  let clipButton = null;
  let cropButton = null;
  let speedTray = null;
  let clipWrap = null;
  let trackEl = null;
  let rangeEl = null;
  let headEl = null;
  let markInEl = null;
  let markOutEl = null;
  let timesEl = null;
  let toastEl = null;
  let btnIn = null;
  let btnOut = null;
  let btnPreview = null;
  let btnSave = null;
  let btnClose = null;

  let clipIn = null;
  let clipOut = null;
  let recording = false;
  let rafHandle = null;
  let toastTimer = null;

  /* ------------------------------------------------------------- helpers */

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function once(target, type) {
    return new Promise((resolve) => target.addEventListener(type, resolve, { once: true }));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? `${h}:` : '') + `${mm}:${String(s).padStart(2, '0')}`;
  }

  function formatPrecise(seconds) {
    if (!Number.isFinite(seconds)) return '--';
    const cs = Math.floor((seconds % 1) * 100);
    return `${formatTime(seconds)}.${String(cs).padStart(2, '0')}`;
  }

  function showToast(message, duration = 2600) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('yte-visible');
    clearTimeout(toastTimer);
    if (duration > 0) {
      toastTimer = setTimeout(() => toastEl.classList.remove('yte-visible'), duration);
    }
  }

  /* ----------------------------------------------------------- DOM build */

  function ensureStyles() {
    if (document.getElementById('yte-osc-style')) return;
    const style = document.createElement('style');
    style.id = 'yte-osc-style';
    style.textContent = OVERLAY_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /** Keeps a click on our controls from reaching YouTube's player. */
  function isolate(node) {
    for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown']) {
      node.addEventListener(type, (event) => event.stopPropagation());
    }
  }

  function buildControls() {
    speedButton = document.createElement('button');
    speedButton.className = 'ytp-button yte-ctl yte-ctl-speed';
    speedButton.addEventListener('click', () => setTrayOpen(!root.classList.contains('yte-tray-open')));
    isolate(speedButton);

    clipButton = document.createElement('button');
    clipButton.className = 'ytp-button yte-ctl yte-ctl-clip';
    clipButton.append(svgIcon(CLIP_ICON));
    clipButton.setAttribute('aria-pressed', 'false');
    clipButton.addEventListener('click', () => YTE.api.toggleClipBar());
    isolate(clipButton);

    cropButton = document.createElement('button');
    cropButton.className = 'ytp-button yte-ctl yte-ctl-crop';
    cropButton.append(svgIcon(CROP_ICON));
    cropButton.setAttribute('aria-pressed', 'false');
    cropButton.addEventListener('click', () => YTE.api.toggleCrop());
    isolate(cropButton);
  }

  function buildSpeedTray() {
    speedTray = document.createElement('div');
    speedTray.className = 'yte-speed-tray yte-panel';

    const down = document.createElement('button');
    down.className = 'yte-step';
    down.textContent = '−';
    down.addEventListener('click', () => YTE.api.nudgeSpeed(-1));
    speedTray.appendChild(down);

    for (const preset of SPEED_PRESETS) {
      const option = document.createElement('button');
      option.dataset.speed = String(preset);
      option.textContent = `${preset}×`;
      option.addEventListener('click', () => {
        YTE.api.setSpeed(preset);
        setTrayOpen(false);
      });
      speedTray.appendChild(option);
    }

    const up = document.createElement('button');
    up.className = 'yte-step';
    up.textContent = '+';
    up.addEventListener('click', () => YTE.api.nudgeSpeed(1));
    speedTray.appendChild(up);

    const reset = document.createElement('button');
    reset.className = 'yte-reset';
    reset.textContent = '⟲';
    reset.addEventListener('click', () => {
      YTE.api.resetSpeed();
      setTrayOpen(false);
    });
    speedTray.appendChild(reset);
    return speedTray;
  }

  function buildClip() {
    clipWrap = document.createElement('div');
    clipWrap.className = 'yte-clip yte-panel';

    trackEl = document.createElement('div');
    trackEl.className = 'yte-track';
    rangeEl = document.createElement('div');
    rangeEl.className = 'yte-range';
    markInEl = document.createElement('div');
    markInEl.className = 'yte-mark';
    markOutEl = document.createElement('div');
    markOutEl.className = 'yte-mark';
    headEl = document.createElement('div');
    headEl.className = 'yte-head';
    trackEl.append(rangeEl, markInEl, markOutEl, headEl);

    trackEl.addEventListener('click', (event) => {
      const video = YTE.getVideo();
      if (!video || !Number.isFinite(video.duration)) return;
      const rect = trackEl.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      video.currentTime = ratio * video.duration;
    });

    const row = document.createElement('div');
    row.className = 'yte-row';

    timesEl = document.createElement('div');
    timesEl.className = 'yte-times';

    btnIn = document.createElement('button');
    btnIn.addEventListener('click', markIn);

    btnOut = document.createElement('button');
    btnOut.addEventListener('click', markOut);

    btnPreview = document.createElement('button');
    btnPreview.addEventListener('click', previewClip);

    btnSave = document.createElement('button');
    btnSave.className = 'yte-primary';
    btnSave.addEventListener('click', saveClip);

    btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.addEventListener('click', () => setClipOpen(false));

    row.append(timesEl, btnIn, btnOut, btnPreview, btnSave, btnClose);
    clipWrap.append(trackEl, row);
    return clipWrap;
  }

  function build() {
    ensureStyles();

    root = document.createElement('div');
    root.id = 'yte-osc';

    toastEl = document.createElement('div');
    toastEl.className = 'yte-toast yte-panel';

    root.append(buildSpeedTray(), buildClip(), buildCropLayer(), toastEl);
    buildControls();

    // Keep clicks and keys inside the overlay away from the player.
    for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown', 'keydown', 'wheel']) {
      root.addEventListener(type, (event) => event.stopPropagation());
    }

    return root;
  }

  /**
   * Puts the speed, clip and crop buttons just before YouTube's settings
   * button, or at the start of the right-hand controls if the layout has none.
   */
  function mountControls(player) {
    const settings = player.querySelector('.ytp-right-controls .ytp-settings-button');
    const host = settings ? settings.parentElement : player.querySelector('.ytp-right-controls');
    if (!host) return;
    let before = settings || host.firstChild;
    for (const button of [cropButton, clipButton, speedButton]) {
      if (button.parentElement !== host || button.nextSibling !== before) host.insertBefore(button, before);
      before = button;
    }
  }

  /** Mounts the overlay and the control-bar buttons in the watch-page player. */
  function mount() {
    const player = document.querySelector('#movie_player');
    if (!player) return;
    if (!root) build();
    ensureStyles();
    if (root.parentElement !== player) player.appendChild(root);
    mountControls(player);
    sync();
  }

  /* -------------------------------------------------------------- speed */

  function syncSpeed() {
    if (!root) return;
    const enabled = S.enabled && S.speedEnabled && S.speedOverlay;
    speedButton.hidden = !enabled;
    if (!enabled) {
      setTrayOpen(false);
      return;
    }

    const video = YTE.getVideo();
    const rate = video ? video.playbackRate : S.lastSpeed;
    speedButton.textContent = `${rate.toFixed(2)}×`;
    speedButton.title = STR.speedLabel;
    speedButton.setAttribute('aria-label', STR.speedLabel);
    speedTray.querySelector('.yte-reset').title = STR.speedReset;

    for (const option of speedTray.querySelectorAll('button[data-speed]')) {
      option.classList.toggle(
        'yte-current',
        Math.abs(Number(option.dataset.speed) - rate) < 0.001
      );
    }
  }

  /** Opens the preset tray just above the speed button. */
  function setTrayOpen(open) {
    if (!root) return;
    const player = root.parentElement;
    const show = open && !speedButton.hidden && !!player;
    root.classList.toggle('yte-tray-open', show);
    if (player) player.classList.toggle('yte-menu-open', show);
    if (!show) return;
    const box = player.getBoundingClientRect();
    const anchor = speedButton.getBoundingClientRect();
    speedTray.style.bottom = `${Math.round(box.bottom - anchor.top) + 8}px`;
    speedTray.style.right = `${Math.max(8, Math.round(box.right - anchor.right))}px`;
  }

  /* --------------------------------------------------------------- clip */

  function setClipOpen(open) {
    if (!root) return;
    const allowed = S.enabled && S.clipEnabled && !!document.querySelector('#movie_player');
    root.classList.toggle('yte-clip-open', open && allowed);
    clipButton.setAttribute('aria-pressed', String(open && allowed));
    if (open && allowed) {
      startRaf();
    } else {
      stopRaf();
    }
    sync();
  }

  function markIn() {
    const video = YTE.getVideo();
    if (!video) return;
    clipIn = video.currentTime;
    if (clipOut !== null && clipOut <= clipIn) clipOut = null;
    sync();
  }

  function markOut() {
    const video = YTE.getVideo();
    if (!video) return;
    clipOut = video.currentTime;
    if (clipIn !== null && clipIn >= clipOut) clipIn = null;
    sync();
  }

  async function previewClip() {
    const video = YTE.getVideo();
    if (!video || clipIn === null) return;
    video.currentTime = clipIn;
    try {
      await video.play();
    } catch (error) {
      console.error('[YT-Enhancer] Preview playback failed:', error);
    }
  }

  function syncClip() {
    if (!root) return;

    btnIn.textContent = `[ ${STR.clipSetIn}`;
    btnOut.textContent = `${STR.clipSetOut} ]`;
    btnPreview.textContent = `▶ ${STR.clipPreview}`;
    btnSave.textContent = `⏺ ${STR.clipSave}`;
    btnClose.title = STR.clipClose;
    clipButton.hidden = !S.enabled || !S.clipEnabled;
    clipButton.title = STR.clipTitle;
    clipButton.setAttribute('aria-label', STR.clipTitle);

    const hasRange = clipIn !== null && clipOut !== null && clipOut - clipIn >= 0.2;
    btnSave.disabled = recording || !hasRange;
    btnPreview.disabled = recording || clipIn === null;

    const length = hasRange ? clipOut - clipIn : 0;
    timesEl.innerHTML = '';
    const label = document.createElement('span');
    label.textContent =
      `${STR.clipTitle}  ` +
      `${clipIn === null ? '--' : formatPrecise(clipIn)} → ` +
      `${clipOut === null ? '--' : formatPrecise(clipOut)}`;
    timesEl.appendChild(label);
    if (hasRange) {
      const duration = document.createElement('b');
      duration.textContent = `  (${length.toFixed(2)}s)`;
      timesEl.appendChild(duration);
    }

    markInEl.classList.toggle('yte-set', clipIn !== null);
    markOutEl.classList.toggle('yte-set', clipOut !== null);
  }

  function startRaf() {
    if (rafHandle !== null) return;
    const step = () => {
      rafHandle = null;
      if (!root || !root.classList.contains('yte-clip-open')) return;

      const video = YTE.getVideo();
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        const d = video.duration;
        headEl.style.left = `${(video.currentTime / d) * 100}%`;
        if (clipIn !== null) markInEl.style.left = `${(clipIn / d) * 100}%`;
        if (clipOut !== null) markOutEl.style.left = `${(clipOut / d) * 100}%`;
        if (clipIn !== null && clipOut !== null && clipOut > clipIn) {
          rangeEl.style.left = `${(clipIn / d) * 100}%`;
          rangeEl.style.width = `${((clipOut - clipIn) / d) * 100}%`;
        } else {
          rangeEl.style.width = '0';
        }
      }
      rafHandle = requestAnimationFrame(step);
    };
    rafHandle = requestAnimationFrame(step);
  }

  function stopRaf() {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  /* --------------------------------------------------------------- crop */

  /**
   * Crops to an area the user drags out over the video, like a screenshot
   * tool. The video keeps playing; the area is scaled up to fit or fill the
   * player and the rest is clipped away. It is kept as fractions of the video
   * box, so it survives resizes, theater mode and fullscreen, and it ends
   * with the video.
   */
  let crop = null;
  let cropSelecting = false;
  let cropLayer = null;
  let cropRect = null;
  let cropHintText = null;
  let cropCancel = null;
  let cropDrag = null;
  let cropStyle = null;
  let cropObserver = null;
  let cropWatched = [];

  function cropAvailable() {
    return S.enabled && S.cropTool;
  }

  /** Boxes smaller than this (in px) are taken for a stray click. */
  const MIN_CROP = 16;

  function buildCropLayer() {
    cropLayer = document.createElement('div');
    cropLayer.className = 'yte-crop-layer';

    cropRect = document.createElement('div');
    cropRect.className = 'yte-crop-rect';

    const hint = document.createElement('div');
    hint.className = 'yte-crop-hint yte-panel';
    cropHintText = document.createElement('span');
    cropCancel = document.createElement('button');
    cropCancel.textContent = '✕';
    cropCancel.addEventListener('click', () => setCropSelecting(false));
    hint.append(cropHintText, cropCancel);
    cropLayer.append(cropRect, hint);

    cropLayer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || hint.contains(event.target)) return;
      event.preventDefault();
      const at = layerPoint(event);
      cropDrag = { x0: at.x, y0: at.y, x1: at.x, y1: at.y };
      cropLayer.setPointerCapture(event.pointerId);
      drawCropRect();
    });
    cropLayer.addEventListener('pointermove', (event) => {
      if (!cropDrag) return;
      const at = layerPoint(event);
      cropDrag.x1 = at.x;
      cropDrag.y1 = at.y;
      drawCropRect();
    });
    const finish = () => {
      if (!cropDrag) return;
      const box = dragBox();
      cropDrag = null;
      drawCropRect();
      if (box.w >= MIN_CROP && box.h >= MIN_CROP) applySelection(box);
    };
    cropLayer.addEventListener('pointerup', finish);
    cropLayer.addEventListener('pointercancel', () => {
      cropDrag = null;
      drawCropRect();
    });
    return cropLayer;
  }

  /** A pointer position inside the player, kept within its edges. */
  function layerPoint(event) {
    const r = cropLayer.getBoundingClientRect();
    return {
      x: Math.min(r.width, Math.max(0, event.clientX - r.left)),
      y: Math.min(r.height, Math.max(0, event.clientY - r.top))
    };
  }

  function dragBox() {
    return {
      x: Math.min(cropDrag.x0, cropDrag.x1),
      y: Math.min(cropDrag.y0, cropDrag.y1),
      w: Math.abs(cropDrag.x1 - cropDrag.x0),
      h: Math.abs(cropDrag.y1 - cropDrag.y0)
    };
  }

  function drawCropRect() {
    cropLayer.classList.toggle('yte-dragging', !!cropDrag);
    if (!cropDrag) return;
    const box = dragBox();
    Object.assign(cropRect.style, {
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.w}px`,
      height: `${box.h}px`
    });
  }

  /** Where YouTube laid the video out in the player, before any crop. */
  function videoBox(video, player) {
    let x = 0;
    let y = 0;
    for (let node = video; node && node !== player; node = node.offsetParent) {
      x += node.offsetLeft;
      y += node.offsetTop;
      if (!player.contains(node.offsetParent)) break;
    }
    return { x, y, w: video.offsetWidth, h: video.offsetHeight };
  }

  /** Turns a box drawn in the player into fractions of the video box. */
  function applySelection(box) {
    const player = root.parentElement;
    const video = YTE.getVideo();
    if (!player || !video) return;
    const v = videoBox(video, player);
    const left = Math.max(box.x, v.x);
    const top = Math.max(box.y, v.y);
    const right = Math.min(box.x + box.w, v.x + v.w);
    const bottom = Math.min(box.y + box.h, v.y + v.h);
    if (right - left < MIN_CROP || bottom - top < MIN_CROP) return;
    crop = {
      x: (left - v.x) / v.w,
      y: (top - v.y) / v.h,
      w: (right - left) / v.w,
      h: (bottom - top) / v.h
    };
    setCropSelecting(false);
  }

  function setCropSelecting(on) {
    if (!root) return;
    cropSelecting = on && cropAvailable();
    cropDrag = null;
    drawCropRect();
    root.classList.toggle('yte-cropping', cropSelecting);
    if (cropSelecting) setTrayOpen(false);
    applyCrop();
  }

  /**
   * Scales the video so the chosen area is centred in the player, fitting
   * inside it or filling it, and clips away everything outside the area and
   * the player. Recomputed whenever YouTube lays the video out again.
   */
  function applyCrop() {
    if (!cropStyle) {
      cropStyle = document.createElement('style');
      cropStyle.id = 'yte-crop-style';
      (document.head || document.documentElement).appendChild(cropStyle);
    }
    const player = root && root.parentElement;
    const video = YTE.getVideo();
    const active = !!(crop && cropAvailable() && player && video && !cropSelecting);
    syncCropButton();
    watchCropLayout(active ? [player, video] : []);
    if (!active) {
      cropStyle.textContent = '';
      return;
    }

    const W = player.clientWidth;
    const H = player.clientHeight;
    const v = videoBox(video, player);
    if (!W || !H || !v.w || !v.h) return;
    const area = { x: crop.x * v.w, y: crop.y * v.h, w: crop.w * v.w, h: crop.h * v.h };
    const fits = [W / area.w, H / area.h];
    const scale = S.cropFit === 'cover' ? Math.max(...fits) : Math.min(...fits);
    const tx = W / 2 - v.x - scale * (area.x + area.w / 2);
    const ty = H / 2 - v.y - scale * (area.y + area.h / 2);

    // The part of the area that lands inside the player, in the video's own
    // (untransformed) coordinates, which is what clip-path works in.
    const left = Math.max(area.x, (0 - v.x - tx) / scale);
    const top = Math.max(area.y, (0 - v.y - ty) / scale);
    const right = Math.min(area.x + area.w, (W - v.x - tx) / scale);
    const bottom = Math.min(area.y + area.h, (H - v.y - ty) / scale);
    const px = (n) => `${n.toFixed(2)}px`;

    // The bars beside a fitted area are black, whatever the page theme.
    cropStyle.textContent =
      `#movie_player{background:#000!important;}` +
      `#movie_player video.html5-main-video{` +
      `transform-origin:0 0!important;` +
      `transform:translate(${px(tx)},${px(ty)}) scale(${scale.toFixed(4)})!important;` +
      `clip-path:inset(${px(top)} ${px(v.w - right)} ${px(v.h - bottom)} ${px(left)})!important;}`;
  }

  /** Re-crops when the player or the video changes size. */
  function watchCropLayout(nodes) {
    if (typeof ResizeObserver === 'undefined') return;
    if (nodes.length === cropWatched.length && nodes.every((node, i) => node === cropWatched[i])) return;
    if (!cropObserver) cropObserver = new ResizeObserver(() => applyCrop());
    cropObserver.disconnect();
    cropWatched = nodes;
    for (const node of nodes) cropObserver.observe(node);
  }

  function syncCropButton() {
    if (!cropButton) return;
    cropButton.hidden = !cropAvailable();
    const on = !!crop || cropSelecting;
    cropButton.setAttribute('aria-pressed', String(on));
    const label = crop ? STR.cropRemove : STR.cropTitle;
    cropButton.title = label;
    cropButton.setAttribute('aria-label', label);
    cropHintText.textContent = STR.cropSelectHint;
    cropCancel.title = STR.clipClose;
  }

  /** Starts a selection, or ends the crop (or the selection) in progress. */
  function toggleCrop() {
    mount();
    if (!root || !cropAvailable()) return;
    if (crop || cropSelecting) {
      crop = null;
      setCropSelecting(false);
    } else {
      setCropSelecting(true);
    }
  }

  /** Picks the best container MediaRecorder supports here. */
  function pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return null;
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const candidate of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(candidate)) return candidate;
      } catch (error) {
        /* keep trying */
      }
    }
    return null;
  }

  function captureStream(video) {
    try {
      if (typeof video.captureStream === 'function') return video.captureStream();
      if (typeof video.mozCaptureStream === 'function') return video.mozCaptureStream();
    } catch (error) {
      console.error('[YT-Enhancer] captureStream() failed:', error);
    }
    return null;
  }

  function clipFileName(mimeType) {
    const id = new URLSearchParams(location.search).get('v') || 'clip';
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    return `yt-${id}-${Math.floor(clipIn)}-${Math.floor(clipOut)}.${extension}`;
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /**
   * Records the marked range in real time off the playing video element and
   * hands the result to the browser's downloader.
   */
  async function saveClip() {
    if (recording) return;

    const video = YTE.getVideo();
    if (!video || clipIn === null || clipOut === null || clipOut - clipIn < 0.2) {
      showToast(STR.clipNoRange);
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      showToast(STR.clipFailed);
      return;
    }

    const restore = {
      time: video.currentTime,
      rate: video.playbackRate,
      paused: video.paused
    };

    recording = true;
    root.classList.add('yte-recording');
    syncClip();

    try {
      YTE.api.holdSpeed(true);
      video.playbackRate = 1;
      video.currentTime = clipIn;
      await Promise.race([once(video, 'seeked'), delay(3000)]);
      await video.play();

      const stream = captureStream(video);
      if (!stream) throw new Error('captureStream() is unavailable for this video');

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000
      });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };

      const stopped = once(recorder, 'stop');
      recorder.start(250);

      await new Promise((resolve) => {
        const watch = () => {
          if (!recording || video.ended || video.currentTime >= clipOut) return resolve();
          showToast(`${STR.clipRecording} ${(clipOut - video.currentTime).toFixed(1)}s`, 0);
          requestAnimationFrame(watch);
        };
        watch();
      });

      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      if (!blob.size) throw new Error('Recorder produced no data');

      downloadBlob(blob, clipFileName(mimeType));
      showToast(STR.clipSaved);
    } catch (error) {
      console.error('[YT-Enhancer] Clip capture failed:', error);
      showToast(STR.clipFailed);
    } finally {
      recording = false;
      root.classList.remove('yte-recording');
      try {
        video.playbackRate = restore.rate;
        video.currentTime = restore.time;
        if (restore.paused) video.pause();
      } catch (error) {
        console.error('[YT-Enhancer] Error restoring playback state:', error);
      }
      YTE.api.holdSpeed(false);
      syncClip();
    }
  }

  /* ----------------------------------------------------------------- glue */

  function sync() {
    syncSpeed();
    syncClip();
    if (root && root.classList.contains('yte-clip-open') && !(S.enabled && S.clipEnabled)) setClipOpen(false);
    if (root && !cropAvailable() && (crop || cropSelecting)) {
      crop = null;
      setCropSelecting(false);
    }
    if (root) applyCrop();
  }

  YTE.api.toggleClipBar = () => {
    mount();
    if (!root) return;
    setClipOpen(!root.classList.contains('yte-clip-open'));
  };
  YTE.api.markClipIn = () => {
    mount();
    setClipOpen(true);
    markIn();
  };
  YTE.api.markClipOut = () => {
    mount();
    setClipOpen(true);
    markOut();
  };
  YTE.api.saveClip = saveClip;
  /** A short notice on the player, for changes made by a shortcut. */
  YTE.api.toast = (message) => {
    mount();
    showToast(message, 1400);
  };
  YTE.api.toggleCrop = toggleCrop;

  YTE.onChange(() => sync());

  document.addEventListener('ratechange', syncSpeed, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !root) return;
    if (cropSelecting) setCropSelecting(false);
    else if (root.classList.contains('yte-tray-open')) setTrayOpen(false);
    else if (root.classList.contains('yte-clip-open')) setClipOpen(false);
  });

  // A click anywhere but the tray and its button closes the tray.
  document.addEventListener(
    'click',
    (event) => {
      if (!root || !root.classList.contains('yte-tray-open')) return;
      if (speedTray.contains(event.target) || speedButton.contains(event.target)) return;
      setTrayOpen(false);
    },
    true
  );

  window.addEventListener('yt-navigate-finish', () => {
    clipIn = null;
    clipOut = null;
    setClipOpen(false);
    setTrayOpen(false);
    crop = null;
    setCropSelecting(false);
    mount();
  });

  mount();
  setInterval(mount, 2000);
})();
