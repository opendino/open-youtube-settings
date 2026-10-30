/**
 * Open Youtube Settings — on-player overlay
 *
 * Playback speed chip and an mpv/uosc-style clip bar that records a marked
 * range straight from the playing video element and downloads it.
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

    /* --- speed chip --- */
    #yte-osc .yte-speed {
      position: absolute;
      right: 12px;
      bottom: 64px;
      pointer-events: auto;
      display: none;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 4px 6px;
      font-size: 12px;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    #yte-osc.yte-speed-on .yte-speed { display: flex; }
    .html5-video-player:not(.ytp-autohide) #yte-osc .yte-speed,
    #yte-osc .yte-speed:hover,
    #yte-osc .yte-speed.yte-tray-open {
      opacity: 1;
      transform: none;
    }
    #yte-osc .yte-speed-value {
      min-width: 52px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    #yte-osc .yte-step { border-radius: 999px; width: 24px; padding: 2px 0; text-align: center; }
    #yte-osc .yte-tray {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      display: none;
      gap: 4px;
      padding: 6px;
      border-radius: 10px;
      white-space: nowrap;
    }
    #yte-osc .yte-speed.yte-tray-open .yte-tray { display: flex; }
    #yte-osc .yte-tray button { font-size: 11px; font-variant-numeric: tabular-nums; }
    #yte-osc .yte-tray button.yte-current { border-color: #ff5a3d; color: #ff8a6d; }

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
  `;

  let root = null;
  let speedWrap = null;
  let speedValueEl = null;
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

  function buildSpeed() {
    speedWrap = document.createElement('div');
    speedWrap.className = 'yte-speed yte-panel';

    const down = document.createElement('button');
    down.className = 'yte-step';
    down.textContent = '−';
    down.addEventListener('click', () => YTE.api.nudgeSpeed(-1));

    speedValueEl = document.createElement('button');
    speedValueEl.className = 'yte-speed-value';
    speedValueEl.addEventListener('click', () => speedWrap.classList.toggle('yte-tray-open'));

    const up = document.createElement('button');
    up.className = 'yte-step';
    up.textContent = '+';
    up.addEventListener('click', () => YTE.api.nudgeSpeed(1));

    speedTray = document.createElement('div');
    speedTray.className = 'yte-tray yte-panel';
    for (const preset of SPEED_PRESETS) {
      const option = document.createElement('button');
      option.dataset.speed = String(preset);
      option.textContent = `${preset}×`;
      option.addEventListener('click', () => {
        YTE.api.setSpeed(preset);
        speedWrap.classList.remove('yte-tray-open');
      });
      speedTray.appendChild(option);
    }

    const reset = document.createElement('button');
    reset.textContent = '⟲';
    reset.title = STR.speedReset;
    reset.addEventListener('click', () => {
      YTE.api.resetSpeed();
      speedWrap.classList.remove('yte-tray-open');
    });
    speedTray.appendChild(reset);

    speedWrap.append(speedTray, down, speedValueEl, up);
    return speedWrap;
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

    root.append(buildSpeed(), buildClip(), toastEl);

    // Keep clicks and keys inside the overlay away from the player.
    for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown', 'keydown', 'wheel']) {
      root.addEventListener(type, (event) => event.stopPropagation());
    }

    return root;
  }

  /** Mounts the overlay inside the watch-page player. */
  function mount() {
    const player = document.querySelector('#movie_player');
    if (!player) return;
    if (!root) build();
    ensureStyles();
    if (root.parentElement !== player) player.appendChild(root);
    sync();
  }

  /* -------------------------------------------------------------- speed */

  function syncSpeed() {
    if (!root) return;
    const enabled = S.speedEnabled && S.speedOverlay;
    root.classList.toggle('yte-speed-on', enabled);
    if (!enabled) return;

    const video = YTE.getVideo();
    const rate = video ? video.playbackRate : S.lastSpeed;
    speedValueEl.textContent = `${rate.toFixed(2)}×`;
    speedValueEl.title = STR.speedLabel;

    for (const option of speedTray.querySelectorAll('button[data-speed]')) {
      option.classList.toggle(
        'yte-current',
        Math.abs(Number(option.dataset.speed) - rate) < 0.001
      );
    }
  }

  /* --------------------------------------------------------------- clip */

  function setClipOpen(open) {
    if (!root) return;
    const allowed = S.clipEnabled && !!document.querySelector('#movie_player');
    root.classList.toggle('yte-clip-open', open && allowed);
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
    if (root && !S.clipEnabled) root.classList.remove('yte-clip-open');
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

  YTE.onChange(() => sync());

  document.addEventListener('ratechange', syncSpeed, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root && root.classList.contains('yte-clip-open')) {
      setClipOpen(false);
    }
  });

  window.addEventListener('yt-navigate-finish', () => {
    clipIn = null;
    clipOut = null;
    setClipOpen(false);
    mount();
  });

  mount();
  setInterval(mount, 2000);
})();
