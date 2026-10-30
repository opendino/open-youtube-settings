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

  /** The watch-page player; reused like YouTube's #movie_player. */
  function watchPlayer() {
    if (player) return player;
    player = el(`
      <div id="movie_player" class="html5-video-player ytp-autohide">
        <div class="html5-video-container">
          <video class="video-stream html5-main-video" playsinline></video>
        </div>
        <div class="ytp-gradient-bottom"></div>
        <div class="ytp-chrome-bottom"><button class="ytp-play-button">play</button></div>
        <div class="ytp-chrome-top"></div>
        <div class="ytp-bezel"><div class="ytp-bezel-icon"></div></div>
      </div>`);
    installPlayerApi(player);
    return player;
  }

  function related(count = 5) {
    let items = '';
    for (let i = 0; i < count; i++) items += `<div class="item">related ${i}</div>`;
    return `<ytd-watch-next-secondary-results-renderer>${items}</ytd-watch-next-secondary-results-renderer>`;
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
    let items = '';
    for (let i = 0; i < 6; i++) items += `<div class="item">home ${i}</div>`;
    return el(`
      <ytd-browse page-subtype="home">
        <div id="contents"><ytd-rich-grid-renderer>${items}</ytd-rich-grid-renderer></div>
      </ytd-browse>`);
  }

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
    return el(`<ytd-browse page-subtype="channels"><h1>Channel ${location.pathname}</h1></ytd-browse>`);
  }

  async function render() {
    const url = new URL(location.href);
    let page;
    if (url.pathname === '/watch') page = renderWatch(url);
    else if (url.pathname.startsWith('/shorts/')) page = renderShorts();
    else if (/^\/(@|c\/|user\/|channel\/)/.test(url.pathname)) page = renderChannel();
    else page = renderHome();

    manager.replaceChildren(page);
    const shorts = page.querySelector('#shorts-player');
    if (shorts) installPlayerApi(shorts);

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
    youtubeRate: () => youtubeRate,
    youtubeMuted: () => youtubeMuted,
    ready: render()
  };
})();
