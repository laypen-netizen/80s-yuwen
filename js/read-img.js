(function () {
  'use strict';
  const library = window.Yuwen;
  const volume = library.getVolume(new URLSearchParams(location.search).get('v'));
  const total = volume.pages;
  const $ = id => document.getElementById(id);
  const img = $('pageImg');
  const viewer = $('viewer');
  const overlay = $('overlay');
  const message = $('msg');
  const readingStatus = $('readerStatus');
  const retryButton = $('retryButton');
  const slider = $('pageSlider');
  const pageInput = $('pageInput');
  const prevButton = $('btnPrev');
  const nextButton = $('btnNext');
  const volumeSelect = $('volumeSelect');
  const cache = new Map();
  let currentPage = 0;
  let requestId = 0;
  let state = 'idle';
  let swipeStart = null;

  $('vTitle').textContent = volume.title;
  $('vSub').textContent = volume.grade;
  document.title = `${volume.title} · ${volume.grade} · 80年代小学语文课本`;
  slider.max = total;
  pageInput.max = total;
  $('pageInfo').textContent = `/ ${total} 页`;
  for (const v of window.VOLUMES) {
    const option = document.createElement('option');
    option.value = v.n;
    option.textContent = `${v.title} · ${v.grade}`;
    volumeSelect.appendChild(option);
  }
  volumeSelect.value = volume.n;

  function applyFit(mode) {
    viewer.dataset.fit = mode;
    $('btnFitWidth').setAttribute('aria-pressed', String(mode === 'width'));
    $('btnFitPage').setAttribute('aria-pressed', String(mode === 'page'));
    library.saveFit(mode);
  }

  function updateControls() {
    slider.value = currentPage;
    slider.setAttribute('aria-valuetext', `第 ${currentPage} 页，共 ${total} 页`);
    pageInput.value = currentPage;
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === total;
  }

  function loadImage(page) {
    if (cache.has(page)) return cache.get(page);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => finish(false), 20000);
      function finish(ok) {
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        if (ok && image.naturalWidth > 0) resolve(image);
        else reject(new Error('Page image unavailable'));
      }
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = library.pageUrl(volume, page);
    });
    cache.set(page, promise);
    promise.catch(() => {
      if (cache.get(page) === promise) cache.delete(page);
    });
    return promise;
  }

  function prefetch(page) {
    // Keep only nearby pages and avoid speculative downloads on constrained networks.
    for (const key of cache.keys()) if (Math.abs(key - page) > 2) cache.delete(key);
    const connection = navigator.connection;
    if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType))) return;
    for (const n of [page + 1, page - 1]) {
      if (n >= 1 && n <= total) loadImage(n).catch(() => {});
    }
  }

  async function showPage(value, force = false) {
    const page = library.clampPage(value, total);
    if (page === currentPage && state !== 'error' && !force) return;
    currentPage = page;
    const id = ++requestId;
    state = 'loading';
    updateControls();
    history.replaceState(null, '', `#p=${page}`);
    viewer.scrollTop = 0;
    viewer.setAttribute('aria-busy', 'true');
    img.hidden = true;
    overlay.hidden = false;
    retryButton.hidden = true;
    message.textContent = `正在加载第 ${page} 页…`;
    readingStatus.textContent = message.textContent;
    // Prune on every request, including rapid slider navigation.
    for (const key of cache.keys()) if (Math.abs(key - page) > 2) cache.delete(key);
    try {
      const loaded = await loadImage(page);
      if (id !== requestId) return;
      img.src = loaded.src;
      img.alt = `${volume.title}，${volume.grade}，第 ${page} 页，共 ${total} 页`;
      img.hidden = false;
      overlay.hidden = true;
      viewer.setAttribute('aria-busy', 'false');
      state = 'ready';
      library.saveProgress(volume, page);
      message.textContent = `第 ${page} 页已加载`;
      readingStatus.textContent = `${volume.title}，第 ${page} 页，共 ${total} 页，已加载`;
      if (document.activeElement === retryButton) viewer.focus();
      prefetch(page);
    } catch {
      if (id !== requestId) return;
      state = 'error';
      viewer.setAttribute('aria-busy', 'false');
      message.textContent = `第 ${page} 页未能加载，请检查网络后重试。`;
      readingStatus.textContent = message.textContent;
      retryButton.hidden = false;
    }
  }

  prevButton.addEventListener('click', () => showPage(currentPage - 1));
  nextButton.addEventListener('click', () => showPage(currentPage + 1));
  retryButton.addEventListener('click', () => showPage(currentPage, true));
  $('btnFitWidth').addEventListener('click', () => applyFit('width'));
  $('btnFitPage').addEventListener('click', () => applyFit('page'));
  slider.addEventListener('input', () => {
    slider.setAttribute('aria-valuetext', `第 ${slider.value} 页，共 ${total} 页`);
  });
  slider.addEventListener('change', () => showPage(slider.value));
  $('pageJump').addEventListener('submit', event => {
    event.preventDefault();
    if (pageInput.checkValidity()) showPage(pageInput.value);
  });
  volumeSelect.addEventListener('change', () => {
    location.href = `read.html?v=${volumeSelect.value}`;
  });
  window.addEventListener('hashchange', () => {
    const page = library.hashPage(location.hash, total);
    if (page !== null) showPage(page);
  });
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    viewer.focus();
  });

  document.addEventListener('keydown', event => {
    const target = event.target;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)))) return;
    const pages = { ArrowRight: currentPage + 1, ' ': currentPage + 1,
      ArrowLeft: currentPage - 1, Home: 1, End: total };
    if (Object.hasOwn(pages, event.key)) {
      event.preventDefault();
      showPage(pages[event.key]);
    }
  });

  viewer.addEventListener('touchstart', event => {
    swipeStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  viewer.addEventListener('touchmove', event => {
    if (event.touches.length > 1) swipeStart = null;
  }, { passive: true });
  viewer.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
  viewer.addEventListener('touchend', event => {
    const start = swipeStart;
    swipeStart = null;
    if (!start || event.changedTouches.length !== 1 || event.touches.length !== 0 ||
        (window.visualViewport && window.visualViewport.scale > 1)) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showPage(currentPage + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  applyFit(library.getFit());
  showPage(library.hashPage(location.hash, total) || library.readProgress()[volume.n] || 1);
})();
