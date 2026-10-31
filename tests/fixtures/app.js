/**
 * A small stand-in for YouTube's single-page app. It renders the DOM shapes
 * the extension relies on (watch page, home feed, Shorts, channel pages),
 * keeps one player element alive across navigations like YouTube does, and
 * fires `yt-navigate-finish` after each in-app navigation.
 *
 * Tests drive it through `window.__fx`.
 */
(function () {
  const manager = document.getElementById('page-manager');
  let videoUrl = null;
  let player = null;

  async function videoSource() {
    if (!videoUrl) {
      const blob = await fetch('/__fixture/sample.webm').then((r) => r.blob());
      videoUrl = URL.createObjectURL(blob);
    }
    return videoUrl;
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /**
   * YouTube's player keeps its own idea of the playback rate. Its menu and
   * Shift+< / Shift+> step from that value (clamped to 0.25–2), and it writes
   * it back onto the element whenever a new video or an ad break ends.
   */
  let youtubeRate = 1;

  /**
   * Mute works the same way: YouTube keeps its own mute state and writes it
   * onto the element every time it loads an ad or a video, which undoes any
   * mute set directly on the element.
   */
  let youtubeMuted = false;

  function installPlayerApi(node) {
    node.setPlaybackRate = (rate) => {
      youtubeRate = Math.min(2, Math.max(0.25, Number(rate)));
      const video = node.querySelector('video');
      if (video) video.playbackRate = youtubeRate;
    };
    node.getPlaybackRate = () => youtubeRate;
    node.mute = () => {
      youtubeMuted = true;
      const video = node.querySelector('video');
      if (video) video.muted = true;
    };
    node.unMute = () => {
      youtubeMuted = false;
      const video = node.querySelector('video');
      if (video) video.muted = false;
    };
    node.isMuted = () => youtubeMuted;
  }

  function restoreYoutubeRate() {
    const video = document.querySelector('#movie_player video');
    if (video) video.playbackRate = youtubeRate;
  }

  /** YouTube loading an ad or a video applies its own mute state. */
  function applyYoutubeMute() {
    const video = document.querySelector('#movie_player video');
    if (video) video.muted = youtubeMuted;
  }

  /**
   * YouTube writes the video's size and position inline and rewrites them
   * whenever the player changes size (theater mode, fullscreen, window).
   */
  const playerResize = new ResizeObserver((entries) => {
    for (const entry of entries) layoutVideo(entry.target);
  });

  function layoutVideo(node) {
    const video = node.querySelector('video');
    if (!video) return;
    Object.assign(video.style, {
      width: `${node.clientWidth}px`,
      height: `${node.clientHeight}px`,
      left: '0px',
      top: '0px'
    });
  }

  /** The watch-page player; reused like YouTube's #movie_player. */
  function watchPlayer() {
    if (player) return player;
    player = el(`
      <div id="movie_player" class="html5-video-player ytp-autohide">
        <div class="html5-video-container">
          <video class="video-stream html5-main-video" playsinline></video>
        </div>
        <div class="ytp-gradient-bottom"></div>
        <div class="ytp-chrome-bottom">
          <div class="ytp-chrome-controls">
            <div class="ytp-left-controls"><button class="ytp-play-button ytp-button">play</button></div>
            <div class="ytp-right-controls">
              <div class="ytp-right-controls-left">
                <button class="ytp-subtitles-button ytp-button">cc</button>
                <button class="ytp-button ytp-settings-button">settings</button>
              </div>
              <div class="ytp-right-controls-right"><button class="ytp-fullscreen-button ytp-button">full</button></div>
            </div>
          </div>
        </div>
        <div class="ytp-chrome-top"></div>
        <div class="ytp-bezel"><div class="ytp-bezel-icon"></div></div>
      </div>`);
    installPlayerApi(player);
    playerResize.observe(player);
    return player;
  }

  /**
   * Channels on the fixture cards. "Blocked Co" is the one tests block; the
   * watch-page list and the end screen only print names, like YouTube does.
   */
  const CHANNELS = [
    { name: 'Channel A', handle: '@channela', id: 'UCaaaaaaaaaaaaaaaaaaaaaa' },
    { name: 'Blocked Co', handle: '@blockedco', id: 'UCbbbbbbbbbbbbbbbbbbbbbb' },
    { name: 'Channel C', handle: '@channelc', id: 'UCcccccccccccccccccccccc' }
  ];

  /** A view-model lockup; `avatar` adds the channel link home cards carry. */
  function lockup(videoId, channel, { avatar = false } = {}) {
    return `
      <yt-lockup-view-model class="lockup" data-video="${videoId}">
        <a class="thumb" href="/watch?v=${videoId}"><yt-thumbnail-view-model class="thumbnail"></yt-thumbnail-view-model></a>
        ${avatar ? `<a class="avatar" href="/${channel.handle}"></a>` : ''}
        <h3><a href="/watch?v=${videoId}">Video ${videoId}</a></h3>
        <yt-content-metadata-view-model>
          <div class="ytContentMetadataViewModelMetadataRow"><span>${channel.name}</span></div>
          <div class="ytContentMetadataViewModelMetadataRow"><span>1M views</span><span> • </span><span>1 day ago</span></div>
        </yt-content-metadata-view-model>
      </yt-lockup-view-model>`;
  }

  function related() {
    const items = CHANNELS.map((c, i) => lockup(`rel${i}`, c)).join('');
    return `<ytd-watch-next-secondary-results-renderer><div id="items">${items}</div></ytd-watch-next-secondary-results-renderer>`;
  }

  /** Shorts cards carry no channel at all. */
  function shortsLockup(id) {
    return `<ytm-shorts-lockup-view-model-v2><ytm-shorts-lockup-view-model><a href="/shorts/${id}">Short ${id}</a><span>2M views</span></ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2>`;
  }

  function shortsShelf() {
    return `<ytd-rich-section-renderer><ytd-rich-shelf-renderer is-shorts>${shortsLockup('s1')}</ytd-rich-shelf-renderer></ytd-rich-section-renderer>`;
  }

  function panel(target, expanded) {
    const visibility = expanded
      ? 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED'
      : 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN';
    return `<ytd-engagement-panel-section-list-renderer target-id="${target}" visibility="${visibility}">
      panel ${target}</ytd-engagement-panel-section-list-renderer>`;
  }

  function renderWatch(url) {
    const list = url.searchParams.get('list');
    const page = el(`
      <ytd-watch-flexy video-id="${url.searchParams.get('v') || ''}">
        <div id="columns">
          <div id="primary">
            <div id="primary-inner">
              <div id="player"></div>
              <ytd-watch-metadata><h1>Fixture video</h1></ytd-watch-metadata>
              <div id="below"><ytd-comments>comments</ytd-comments></div>
            </div>
          </div>
          <div id="secondary">
            <div id="secondary-inner">
              <div id="panels">
                ${panel('engagement-panel-ads', true)}
                ${panel('engagement-panel-structured-description', false)}
                ${panel('engagement-panel-macro-markers-description-chapters', false)}
              </div>
              ${list ? `<ytd-playlist-panel-renderer id="playlist">playlist ${list}</ytd-playlist-panel-renderer>` : ''}
              <div id="related">${related()}</div>
            </div>
          </div>
        </div>
      </ytd-watch-flexy>`);
    page.querySelector('#player').appendChild(watchPlayer());
    return page;
  }

  function renderHome() {
    const items = CHANNELS.map(
      (c, i) => `<ytd-rich-item-renderer>${lockup(`home${i}`, c, { avatar: true })}</ytd-rich-item-renderer>`
    ).join('');
    // A single Short also turns up as a grid item of its own.
    const loneShort = `<ytd-rich-item-renderer>${shortsLockup('s2')}</ytd-rich-item-renderer>`;
    return el(`
      <ytd-browse page-subtype="home">
        <div id="contents"><ytd-rich-grid-renderer>${items}${loneShort}${shortsShelf()}</ytd-rich-grid-renderer></div>
      </ytd-browse>`);
  }

  function renderSearch() {
    const items = CHANNELS.map(
      (c, i) => `
        <ytd-video-renderer>
          <a id="thumbnail" href="/watch?v=search${i}"><ytd-thumbnail></ytd-thumbnail></a>
          <a id="channel-thumbnail" href="/channel/${c.id}"></a>
          <h3><a href="/watch?v=search${i}">Search result ${i}</a></h3>
          <ytd-channel-name style="position: relative; z-index: 100;"><div id="text-container"><yt-formatted-string id="text"><a href="/${c.handle}">${c.name}</a></yt-formatted-string></div></ytd-channel-name>
        </ytd-video-renderer>`
    ).join('');
    // Search mixes in a grid of Shorts and Shorts as plain results.
    const shorts = `
      <grid-shelf-view-model>${shortsLockup('s3')}${shortsLockup('s4')}</grid-shelf-view-model>
      <ytd-video-renderer>
        <a id="thumbnail" href="/shorts/s5"><ytd-thumbnail></ytd-thumbnail></a>
        <h3><a href="/shorts/s5">A short result</a></h3>
      </ytd-video-renderer>`;
    return el(`
      <ytd-search><ytd-section-list-renderer><ytd-item-section-renderer><div id="contents">${items}${shorts}</div></ytd-item-section-renderer></ytd-section-list-renderer></ytd-search>`);
  }

  function renderSubscriptions() {
    const items = CHANNELS.map(
      (c, i) => `<ytd-rich-item-renderer>${lockup(`sub${i}`, c, { avatar: true })}</ytd-rich-item-renderer>`
    ).join('');
    return el(`<ytd-browse page-subtype="subscriptions"><div id="contents">${items}</div></ytd-browse>`);
  }

  /** The grid of suggestions YouTube lays over the player when a video ends. */
  function showEndscreen() {
    const wall = el(`<div class="ytp-endscreen-content"></div>`);
    CHANNELS.forEach((c, i) => {
      wall.appendChild(
        el(`
          <a class="ytp-videowall-still" href="https://www.youtube.com/watch?v=end${i}"
             style="position: absolute; left: ${i * 200}px; top: 0; width: 190px; height: 110px;">
            <div class="ytp-videowall-still-image"></div>
            <span class="ytp-videowall-still-info-title">End ${i}</span>
            <span class="ytp-videowall-still-info-author">${c.name} • 100K views</span>
          </a>`)
      );
    });
    document.querySelector('#movie_player').appendChild(wall);
  }

  /**
   * Home and search open an inline preview over a thumbnail the pointer rests
   * on. Like YouTube's, it is one element at the end of ytd-app, outside the
   * card, padded 12px around the thumbnail-sized video, and it stays until
   * the pointer leaves the thumbnail's area.
   */
  const preview = el(`<ytd-video-preview hidden><div class="preview-video"></div></ytd-video-preview>`);
  document.querySelector('ytd-app').appendChild(preview);
  let previewed = null;

  function closePreview() {
    previewed = null;
    preview.hidden = true;
  }

  document.addEventListener('mouseover', (event) => {
    const thumb = event.target.closest && event.target.closest('ytd-rich-item-renderer a.thumb, ytd-video-renderer a#thumbnail');
    if (!thumb || thumb === previewed) return;
    previewed = thumb;
    const r = thumb.getBoundingClientRect();
    Object.assign(preview.style, {
      left: `${r.left + scrollX - 12}px`,
      top: `${r.top + scrollY - 12}px`,
      width: `${r.width}px`,
      height: `${r.height}px`
    });
    preview.hidden = false;
  });

  document.addEventListener('mousemove', (event) => {
    if (!previewed) return;
    const r = previewed.getBoundingClientRect();
    const inside = event.clientX >= r.left && event.clientX < r.right && event.clientY >= r.top && event.clientY < r.bottom;
    if (!inside) closePreview();
  });

  function renderShorts() {
    return el(`
      <ytd-shorts>
        <ytd-reel-video-renderer is-active>
          <div id="shorts-player" class="html5-video-player">
            <div class="html5-video-container">
              <video class="video-stream html5-main-video" muted playsinline loop></video>
            </div>
          </div>
        </ytd-reel-video-renderer>
      </ytd-shorts>`);
  }

  function renderChannel() {
    return el(`<ytd-browse page-subtype="channels"><h1>Channel ${location.pathname}</h1>
      <yt-tab-shape tab-title="Videos">Videos</yt-tab-shape><yt-tab-shape tab-title="Shorts">Shorts</yt-tab-shape>
      <ytd-reel-shelf-renderer>${shortsLockup('s6')}</ytd-reel-shelf-renderer></ytd-browse>`);
  }

  async function render() {
    const url = new URL(location.href);
    let page;
    if (url.pathname === '/watch') page = renderWatch(url);
    else if (url.pathname === '/results') page = renderSearch();
    else if (url.pathname === '/feed/subscriptions') page = renderSubscriptions();
    else if (url.pathname.startsWith('/shorts/')) page = renderShorts();
    else if (/^\/(@|c\/|user\/|channel\/)/.test(url.pathname)) page = renderChannel();
    else page = renderHome();

    closePreview();
    manager.replaceChildren(page);
    const shorts = page.querySelector('#shorts-player');
    if (shorts) {
      installPlayerApi(shorts);
      playerResize.observe(shorts);
    }

    const video = page.querySelector('video');
    if (video) {
      // A new src runs the media load algorithm, which resets playbackRate to
      // defaultPlaybackRate; YouTube then writes its own rate back.
      video.src = await videoSource();
      await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
      if (!document.querySelector('#movie_player.ad-showing')) video.playbackRate = youtubeRate;
      if (video.closest('#movie_player')) video.muted = youtubeMuted;
      await video.play().catch(() => {});
    }
  }

  /**
   * Ad break: YouTube flags the player and loads the ad, applying its own mute
   * state; at the end it restores its own rate and mute state.
   */
  function startAd() {
    document.querySelector('#movie_player').classList.add('ad-showing');
    applyYoutubeMute();
  }

  /** The next ad of the same break (an ad pod): loaded like any other. */
  function nextAdInBreak() {
    applyYoutubeMute();
  }

  function endAd() {
    document.querySelector('#movie_player').classList.remove('ad-showing');
    restoreYoutubeRate();
    applyYoutubeMute();
  }

  /** YouTube's own volume button. */
  function youtubeToggleMute() {
    const node = document.querySelector('#movie_player');
    if (node.isMuted()) node.unMute();
    else node.mute();
  }

  /**
   * In-app navigation. With `{ ad: true }` the new video opens on an ad break,
   * as it did on the live site, and `yt-navigate-finish` fires mid-ad.
   */
  async function navigate(path, options = {}) {
    history.pushState({}, '', path);
    if (options.ad) startAd();
    await render();
    document.dispatchEvent(new CustomEvent('yt-navigate-finish', { bubbles: true }));
  }

  /** Opens or closes an engagement panel by flipping `visibility`. */
  function setPanel(target, expanded) {
    const node = document.querySelector(
      `ytd-engagement-panel-section-list-renderer[target-id="${target}"]`
    );
    node.setAttribute(
      'visibility',
      expanded ? 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED' : 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN'
    );
  }

  /** YouTube's speed menu. */
  function youtubeSetRate(rate) {
    document.querySelector('#movie_player').setPlaybackRate(rate);
  }

  /** YouTube's Shift+> / Shift+< shortcuts step from its own rate. */
  function youtubeStep(direction) {
    const node = document.querySelector('#movie_player');
    node.setPlaybackRate(node.getPlaybackRate() + direction * 0.25);
  }

  window.__fx = {
    navigate,
    setPanel,
    youtubeSetRate,
    youtubeStep,
    startAd,
    nextAdInBreak,
    endAd,
    youtubeToggleMute,
    showEndscreen,
    youtubeRate: () => youtubeRate,
    youtubeMuted: () => youtubeMuted,
    ready: render()
  };
})();
