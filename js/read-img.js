(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var volN = Math.min(12, Math.max(1, parseInt(params.get('v') || '1', 10) || 1));
  var vol = window.VOLUMES.find(function (v) { return v.n === volN; }) || window.VOLUMES[0];
  var TOTAL = vol.pages || 61;
  var IMG_BASE = 'pages/v' + String(vol.n).padStart(2, '0') + '/';
  var IMG_VER = '?v=3';
  var COVER_URL = 'covers/v' + String(vol.n).padStart(2, '0') + '.jpg?v=2';
  var STORE_KEY = 'yw80-progress-v1';

  document.getElementById('vTitle').textContent = '第' + vol.n + '册';
  document.getElementById('vSub').textContent = vol.grade;
  document.title = '第' + vol.n + '册 · ' + vol.grade + ' · 80年代小学语文课本';

  var img = document.getElementById('pageImg');
  var viewer = document.getElementById('viewer');
  var overlay = document.getElementById('overlay');
  var msgEl = document.getElementById('msg');
  var placeholder = document.getElementById('coverPlaceholder');
  var pageInfo = document.getElementById('pageInfo');
  var slider = document.getElementById('pageSlider');
  var btnFitWidth = document.getElementById('btnFitWidth');
  var btnFitPage = document.getElementById('btnFitPage');
  var btnPrev = document.getElementById('btnPrev');
  var btnNext = document.getElementById('btnNext');

  var currentPage = 1;
  var fitMode = 'width';
  var firstLoad = false;
  var cache = {};

  function pageUrl(p) {
    return IMG_BASE + String(p).padStart(4, '0') + '.webp' + IMG_VER;
  }

  function loadProgress() {
    try {
      var m = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      var p = m[vol.n];
      return (typeof p === 'number') ? Math.max(1, Math.min(TOTAL, Math.floor(p))) : null;
    } catch (e) { return null; }
  }
  function saveProgress(n) {
    try {
      var m = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      m[vol.n] = n;
      localStorage.setItem(STORE_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  function parseHashPage() {
    var m = location.hash.match(/^#p=(\d+)$/);
    return m ? Math.max(1, Math.min(TOTAL, parseInt(m[1], 10))) : null;
  }
  function syncHash(n) {
    history.replaceState(null, '', '#p=' + n);
  }

  function updateUI(n) {
    pageInfo.textContent = n + ' / ' + TOTAL;
    slider.value = n;
    slider.max = TOTAL;
    syncHash(n);
    saveProgress(n);
  }

  function applyFit() {
    if (fitMode === 'width') {
      img.style.width = '100%';
      img.style.height = 'auto';
    } else {
      img.style.width = 'auto';
      img.style.height = '100%';
    }
  }

  function setPlaceholderVisible(show) {
    if (show) {
      placeholder.hidden = false;
      placeholder.classList.remove('hidden');
    } else {
      placeholder.classList.add('hidden');
    }
  }

  function showPage(n) {
    if (n < 1) n = 1;
    if (n > TOTAL) n = TOTAL;
    if (n === currentPage && firstLoad) return;
    currentPage = n;
    updateUI(n);

    var url = pageUrl(n);

    // If already cached/loaded, swap immediately
    if (cache[n] && cache[n].complete) {
      img.src = url;
      img.classList.remove('page-in');
      void img.offsetWidth;
      img.classList.add('page-in');
      overlay.classList.add('hidden');
      setPlaceholderVisible(false);
      return;
    }

    // Show placeholder while loading
    overlay.classList.remove('hidden');
    msgEl.textContent = '加载第 ' + n + ' 页…';
    placeholder.src = COVER_URL;
    setPlaceholderVisible(true);
    img.style.opacity = '0';

    img.onload = function () {
      img.onload = null;
      img.onerror = null;
      overlay.classList.add('hidden');
      setPlaceholderVisible(false);
      img.style.opacity = '1';
      img.classList.remove('page-in');
      void img.offsetWidth;
      img.classList.add('page-in');
      if (!firstLoad) firstLoad = true;
    };
    img.onerror = function () {
      img.onerror = null;
      img.onload = null;
      msgEl.textContent = '第 ' + n + ' 页加载失败，点击重试';
      overlay.classList.remove('hidden');
      setPlaceholderVisible(false);
    };
    img.src = url;

    // Prefetch neighbours
    [n + 1, n + 2, n - 1].forEach(function (p) {
      if (p < 1 || p > TOTAL || cache[p]) return;
      var pre = new Image();
      pre.src = pageUrl(p);
      cache[p] = pre;
    });
  }

  // Keyboard
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      showPage(currentPage + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showPage(currentPage - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      showPage(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      showPage(TOTAL);
    }
  });

  // Swipe
  var sx = 0, sy = 0;
  viewer.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  viewer.addEventListener('touchend', function (e) {
    if (e.changedTouches.length > 1) return;
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      showPage(dx < 0 ? currentPage + 1 : currentPage - 1);
    }
  }, { passive: true });

  // Tap zones
  document.getElementById('tapLeft').addEventListener('click', function () { showPage(currentPage - 1); });
  document.getElementById('tapRight').addEventListener('click', function () { showPage(currentPage + 1); });

  // Buttons
  btnPrev.addEventListener('click', function () { showPage(currentPage - 1); });
  btnNext.addEventListener('click', function () { showPage(currentPage + 1); });
  btnFitWidth.addEventListener('click', function () { fitMode = 'width'; applyFit(); });
  btnFitPage.addEventListener('click', function () { fitMode = 'page'; applyFit(); });
  slider.addEventListener('input', function () { showPage(parseInt(slider.value, 10)); });
  window.addEventListener('resize', function () { applyFit(); });

  // Init
  var startPage = parseHashPage() || loadProgress() || 1;
  showPage(startPage);
  applyFit();
})();
