pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdf.worker.min.js';

const params = new URLSearchParams(location.search);
const volN = Math.min(12, Math.max(1, parseInt(params.get('v') || '1', 10) || 1));
const vol = VOLUMES.find(v => v.n === volN) || VOLUMES[0];

document.getElementById('vTitle').textContent = `第${vol.n}册`;
document.getElementById('vSub').textContent = vol.grade;
document.title = `第${vol.n}册 · ${vol.grade} · 80年代小学语文课本`;

const canvas = document.getElementById('pageCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const msg = document.getElementById('msg');
const pageInfo = document.getElementById('pageInfo');
const slider = document.getElementById('pageSlider');
const viewer = document.getElementById('viewer');
const btnFitWidth = document.getElementById('btnFitWidth');
const btnFitPage = document.getElementById('btnFitPage');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');

const DPR = Math.min(window.devicePixelRatio || 1, 2);
const STORE_KEY = 'yw80-progress-v1';

let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;          // custom zoom: css px per PDF point
let fitMode = 'width';    // 'width' | 'page' | 'custom'
let renderTask = null;
let lastLoadUrl = null;

// ---------- 进度记忆 ----------
function loadProgress() {
  try {
    const m = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const p = m[vol.n];
    return (typeof p === 'number' && p >= 1) ? Math.floor(p) : null;
  } catch { return null; }
}
function saveProgress(n) {
  try {
    const m = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    m[vol.n] = n;
    localStorage.setItem(STORE_KEY, JSON.stringify(m));
  } catch { /* 无痕模式等场景静默降级 */ }
}

// ---------- URL hash（#p=N 分享 / 恢复） ----------
function parseHashPage() {
  const m = location.hash.match(/^#p=(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}
function syncHash(n) {
  history.replaceState(null, '', '#p=' + n);
}

// ---------- 加载状态 ----------
function showMessage(html) { msg.innerHTML = html; overlay.classList.remove('hidden'); }
function hideMessage() { overlay.classList.add('hidden'); }

// ---------- 预取缓存（离屏渲染下一页） ----------
let prefetch = { num: 0, canvas: null, cssScale: -1 };
function invalidatePrefetch() { prefetch = { num: 0, canvas: null, cssScale: -1 }; }

async function prefetchNext(num) {
  if (!pdfDoc || num + 1 > pdfDoc.numPages) return;
  const target = num + 1;
  try {
    const page = await pdfDoc.getPage(target);
    const s = computeScale(page, fitMode);
    const viewport = page.getViewport({ scale: s });
    const c = document.createElement('canvas');
    c.width = Math.floor(viewport.width * DPR);
    c.height = Math.floor(viewport.height * DPR);
    await page.render({
      canvasContext: c.getContext('2d'),
      viewport,
      transform: DPR !== 1 ? [DPR, 0, 0, DPR, 0, 0] : null,
    }).promise;
    prefetch = { num: target, canvas: c, cssScale: s };
  } catch { /* 预取失败不打扰主流程 */ }
}

// ---------- 渲染 ----------
function computeScale(page, mode) {
  const vp = page.getViewport({ scale: 1 });
  const containerW = viewer.clientWidth - 24;
  const containerH = viewer.clientHeight - 24;
  if (mode === 'width') return containerW / vp.width;
  if (mode === 'page') return Math.min(containerW / vp.width, containerH / vp.height);
  return scale;
}

function blit(c) {
  canvas.width = c.width;
  canvas.height = c.height;
  canvas.style.width = Math.floor(c.width / DPR) + 'px';
  canvas.style.height = Math.floor(c.height / DPR) + 'px';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(c, 0, 0);
  fadeIn();
}

function fadeIn() {
  canvas.style.animation = 'none';
  void canvas.offsetWidth;
  canvas.style.animation = '';
  canvas.classList.remove('page-in');
  void canvas.offsetWidth;
  canvas.classList.add('page-in');
}

async function renderPage(num, opts = {}) {
  if (!pdfDoc) return;
  num = Math.min(pdfDoc.numPages, Math.max(1, num));
  currentPage = num;
  slider.value = num;
  pageInfo.textContent = `${num} / ${pdfDoc.numPages}`;
  if (!opts.fromHash) syncHash(num);
  saveProgress(num);

  // 命中预取缓存：直接位图拷贝，秒翻
  if (prefetch.num === num && prefetch.canvas) {
    blit(prefetch.canvas);
    prefetchNext(num);
    return;
  }

  showMessage('渲染中…');
  try {
    const page = await pdfDoc.getPage(num);
    const s = computeScale(page, fitMode);
    const viewport = page.getViewport({ scale: s });
    canvas.width = Math.floor(viewport.width * DPR);
    canvas.height = Math.floor(viewport.height * DPR);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';
    if (renderTask) renderTask.cancel();
    renderTask = page.render({
      canvasContext: ctx,
      viewport,
      transform: DPR !== 1 ? [DPR, 0, 0, DPR, 0, 0] : null,
    });
    await renderTask.promise;
    hideMessage();
    fadeIn();
    prefetchNext(num);
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return;
    console.error(e);
    showMessage('渲染失败：' + (e.message || e));
  }
}

// ---------- PDF 加载（含进度与重试） ----------
async function loadPdf() {
  const url = `./pdfs/${vol.file}`;
  lastLoadUrl = url;
  showMessage('正在加载课本扫描件…');
  const task = pdfjsLib.getDocument({ url });
  task.onProgress = (d) => {
    if (d.total > 0) showMessage(`正在加载… ${Math.round((d.loaded / d.total) * 100)}%`);
  };
  try {
    pdfDoc = await task.promise;
    slider.max = pdfDoc.numPages;
    // 优先级：hash 分享页 > 上次阅读进度 > 第 1 页
    const start = Math.min(pdfDoc.numPages, Math.max(1, parseHashPage() || loadProgress() || 1));
    hideMessage();
    await renderPage(start);
  } catch (e) {
    console.error(e);
    showMessage(`加载失败：${e.message || e}<br><button id="btnRetry" class="retry">重试</button>`);
    document.getElementById('btnRetry')?.addEventListener('click', loadPdf);
  }
}

// ---------- 翻页 ----------
function prevPage() { if (currentPage > 1) renderPage(currentPage - 1); }
function nextPage() { if (pdfDoc && currentPage < pdfDoc.numPages) renderPage(currentPage + 1); }

btnPrev.addEventListener('click', prevPage);
btnNext.addEventListener('click', nextPage);
document.getElementById('tapLeft').addEventListener('click', prevPage);
document.getElementById('tapRight').addEventListener('click', nextPage);

// ---------- 滑块 ----------
slider.addEventListener('input', () => {
  pageInfo.textContent = `${slider.value} / ${pdfDoc ? pdfDoc.numPages : '-'}`;
});
slider.addEventListener('change', () => renderPage(parseInt(slider.value, 10)));

// ---------- 缩放 ----------
function setCustomScale(mult) {
  fitMode = 'custom';
  scale = Math.min(6, Math.max(0.3, scale * mult));
  invalidatePrefetch();
  renderPage(currentPage);
}
document.getElementById('btnZoomIn').addEventListener('click', () => setCustomScale(1.2));
document.getElementById('btnZoomOut').addEventListener('click', () => setCustomScale(1 / 1.2));
function setFit(mode) {
  fitMode = mode;
  btnFitWidth.classList.toggle('active', mode === 'width');
  btnFitPage.classList.toggle('active', mode === 'page');
  invalidatePrefetch();
  renderPage(currentPage);
}
btnFitWidth.addEventListener('click', () => setFit('width'));
btnFitPage.addEventListener('click', () => setFit('page'));

// ---------- 键盘（输入控件聚焦时让位原生行为） ----------
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable)) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevPage(); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); nextPage(); }
  else if (e.key === 'Home') { e.preventDefault(); renderPage(1); }
  else if (e.key === 'End') { e.preventDefault(); renderPage(pdfDoc ? pdfDoc.numPages : 1); }
});

// ---------- 触摸滑动翻页（双指交给原生 pinch 缩放） ----------
let touchStartX = 0, touchStartY = 0;
viewer.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].screenX;
  touchStartY = e.touches[0].screenY;
}, { passive: true });
viewer.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.screenX - touchStartX;
  const dy = t.screenY - touchStartY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx > 0) prevPage(); else nextPage();
  }
}, { passive: true });

// ---------- hash 后退/前进 ----------
window.addEventListener('hashchange', () => {
  const p = parseHashPage();
  if (p && pdfDoc && p !== currentPage) renderPage(p, { fromHash: true });
});

// ---------- 窗口尺寸变化（仅自适应模式重排） ----------
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (fitMode === 'custom') return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { invalidatePrefetch(); renderPage(currentPage); }, 150);
});

loadPdf();
