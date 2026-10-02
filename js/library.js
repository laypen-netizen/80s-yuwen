(function () {
  'use strict';
  const PROGRESS_KEY = 'yw80-progress-v1';
  const LAST_READ_KEY = 'yw80-last-read-v1';
  const FIT_KEY = 'yw80-fit-v1';

  function getVolume(value) {
    return window.VOLUMES.find(v => v.n === Number(value)) || window.VOLUMES[0];
  }

  function clampPage(value, total) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(total, Math.floor(n))) : 1;
  }

  function readObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function readProgress() {
    const saved = readObject(PROGRESS_KEY);
    const result = {};
    for (const v of window.VOLUMES) {
      if (typeof saved[v.n] === 'number' && Number.isFinite(saved[v.n])) {
        result[v.n] = clampPage(saved[v.n], v.pages);
      }
    }
    return result;
  }

  function saveProgress(volume, page) {
    const progress = readProgress();
    const reading = { volume: volume.n, page: clampPage(page, volume.pages) };
    progress[volume.n] = reading.page;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      localStorage.setItem(LAST_READ_KEY, JSON.stringify(reading));
    } catch { /* Reading also works when browser storage is unavailable. */ }
  }

  function latestReading() {
    const last = readObject(LAST_READ_KEY);
    const v = window.VOLUMES.find(v => v.n === last.volume);
    const page = readProgress()[last.volume];
    return v && page ? { volume: v, page } : null;
  }

  function hashPage(hash, total) {
    const match = /^#p=(\d+)$/.exec(hash);
    return match ? clampPage(match[1], total) : null;
  }

  function getFit() {
    try { return localStorage.getItem(FIT_KEY) === 'width' ? 'width' : 'page'; }
    catch { return 'page'; }
  }

  function saveFit(mode) {
    try { localStorage.setItem(FIT_KEY, mode); } catch { /* Optional preference. */ }
  }

  function coverUrl(volume, thumbnail = false) {
    const id = String(volume.n).padStart(2, '0');
    return thumbnail ? `covers/thumb-v${id}.webp?v=3` : `covers/v${id}.jpg?v=3`;
  }

  function pageUrl(volume, page) {
    const id = String(volume.n).padStart(2, '0');
    const number = String(clampPage(page, volume.pages)).padStart(4, '0');
    return `pages/v${id}/${number}.webp?v=4`;
  }

  window.Yuwen = Object.freeze({ getVolume, clampPage, readProgress, saveProgress,
    latestReading, hashPage, getFit, saveFit, coverUrl, pageUrl });
})();
