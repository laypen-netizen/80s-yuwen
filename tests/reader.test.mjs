import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createReader({ hash = '', progress = '{}', saveData = false } = {}) {
  const elements = new Map();
  class Element {
    constructor() { this.events = {}; this.attrs = {}; this.dataset = {}; this.hidden = false; this.value = ''; this.children = []; }
    addEventListener(name, handler) { this.events[name] = handler; }
    setAttribute(name, value) { this.attrs[name] = value; }
    appendChild(child) { this.children.push(child); }
    checkValidity() { return Number(this.value) >= 1 && Number(this.value) <= Number(this.max); }
    focus() { document.activeElement = this; }
    fire(name, event = {}) { return this.events[name]?.(event); }
  }
  const document = new Element();
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  document.createElement = () => new Element();
  document.querySelector = () => document.getElementById('skipLink');
  const saved = new Map([['yw80-progress-v1', progress]]);
  const requests = [];
  class Image {
    set src(url) { this.url = url; requests.push(this); }
    get src() { return this.url; }
    succeed() { this.naturalWidth = 1200; this.onload?.(); }
    fail() { this.naturalWidth = 0; this.onerror?.(); }
  }
  const window = new Element();
  const location = { search: '?v=1', hash };
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({ window, document, location, Image, URLSearchParams,
    navigator: { connection: { saveData } },
    history: { replaceState(_state, _title, value) { location.hash = value; } },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    setTimeout: handler => { timers.set(++timerId, handler); return timerId; },
    clearTimeout: id => timers.delete(id),
  });
  for (const file of ['volumes', 'library', 'read-img']) vm.runInContext(readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), context);
  return { $: id => document.getElementById(id), document, window, requests, saved, location, timers };
}
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('链接页码优先于旧进度，成功加载后才保存', async () => {
  const r = createReader({ hash: '#p=8', progress: '{"1":4}' });
  assert.match(r.requests[0].src, /0008\.webp/);
  assert.equal(JSON.parse(r.saved.get('yw80-progress-v1'))[1], 4);
  r.requests[0].succeed();
  await settle();
  assert.equal(JSON.parse(r.saved.get('yw80-progress-v1'))[1], 8);
  assert.equal(r.$('overlay').hidden, true);
  assert.equal(r.$('viewer').attrs['aria-busy'], 'false');
});

test('失败页可重试，不把失败当成已读，也不复用失败预加载', async () => {
  const r = createReader();
  r.requests[0].fail();
  await settle();
  assert.equal(r.$('retryButton').hidden, false);
  assert.equal(JSON.parse(r.saved.get('yw80-progress-v1'))[1], undefined);
  r.$('retryButton').fire('click');
  assert.equal(r.requests.length, 2);
  r.requests[1].succeed();
  await settle();
  assert.equal(r.$('retryButton').hidden, true);
  const preloaded = r.requests.find(image => /0002\.webp/.test(image.src));
  preloaded.fail();
  await settle();
  r.$('btnNext').fire('click');
  assert.equal(r.requests.filter(image => /0002\.webp/.test(image.src)).length, 2);
});

test('快速翻页时过期响应不能覆盖新页面或进度', async () => {
  const r = createReader({ saveData: true });
  r.$('btnNext').fire('click');
  r.requests[1].succeed();
  await settle();
  r.requests[0].succeed();
  await settle();
  assert.match(r.$('pageImg').src, /0002\.webp/);
  assert.equal(JSON.parse(r.saved.get('yw80-progress-v1'))[1], 2);
  assert.equal(r.requests.length, 2);
});

test('滑块只在确认选择时加载，Hash 变化和跳页保持同步', async () => {
  const r = createReader({ saveData: true });
  r.$('pageSlider').value = '20';
  r.$('pageSlider').fire('input');
  assert.equal(r.requests.length, 1);
  r.$('pageSlider').fire('change');
  assert.match(r.requests[1].src, /0020\.webp/);
  r.location.hash = '#p=61';
  r.window.fire('hashchange');
  assert.equal(r.$('btnNext').disabled, true);
  r.requests[2].succeed();
  await settle();
  r.$('pageInput').value = '13';
  r.$('pageJump').fire('submit', { preventDefault() {} });
  assert.equal(r.location.hash, '#p=13');
  r.location.hash = '#viewer';
  r.window.fire('hashchange');
  assert.equal(r.$('pageInput').value, 13);
  r.$('skipLink').fire('click', { preventDefault() {} });
  assert.equal(r.document.activeElement, r.$('viewer'));
});

test('按钮空格、表单输入和双指缩放不会误触翻页', () => {
  const r = createReader();
  r.document.fire('keydown', { key: ' ', target: { tagName: 'BUTTON' } });
  r.document.fire('keydown', { key: 'ArrowRight', target: { tagName: 'INPUT' } });
  assert.equal(r.requests.length, 1);
  r.$('viewer').fire('touchstart', { touches: [{ clientX: 200, clientY: 100 }, { clientX: 210, clientY: 100 }] });
  r.$('viewer').fire('touchend', { touches: [], changedTouches: [{ clientX: 50, clientY: 100 }] });
  assert.equal(r.requests.length, 1);
  r.document.fire('keydown', { key: 'ArrowRight', target: { tagName: 'MAIN' }, preventDefault() {} });
  assert.equal(r.requests.length, 2);
});

test('超时给出可操作的恢复入口，迟到图片不会改变错误状态', async () => {
  const r = createReader();
  const image = r.requests[0];
  [...r.timers.values()][0]();
  await settle();
  assert.equal(r.$('retryButton').hidden, false);
  image.succeed();
  await settle();
  assert.equal(r.$('retryButton').hidden, false);
  assert.equal(r.$('pageImg').src, undefined);
});
