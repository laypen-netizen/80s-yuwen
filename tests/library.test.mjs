import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function library(values = {}, unavailable = false) {
  const saved = new Map(Object.entries(values));
  const context = vm.createContext({ window: {}, localStorage: {
    getItem(key) { if (unavailable) throw Error('blocked'); return saved.get(key) ?? null; },
    setItem(key, value) { if (unavailable) throw Error('blocked'); saved.set(key, value); },
  } });
  for (const file of ['volumes', 'library']) vm.runInContext(readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), context);
  return { api: context.window.Yuwen, volumes: context.window.VOLUMES, saved };
}

test('旧进度继续可用，非法和越界值不会生成错误链接', () => {
  const { api } = library({ 'yw80-progress-v1': '{"1":12,"2":999,"3":"23","4":-8,"5":3.9,"99":42}' });
  assert.equal(JSON.stringify(api.readProgress()), '{"1":12,"2":59,"4":1,"5":3}');
  assert.equal(api.latestReading(), null);
});

test('损坏、null、数组和受限存储仍可阅读并安全保存', () => {
  for (const value of ['null', '[]', '{bad json', '42', '"string"']) {
    const { api, volumes } = library({ 'yw80-progress-v1': value });
    assert.equal(JSON.stringify(api.readProgress()), '{}');
    api.saveProgress(volumes[0], 8);
    assert.equal(api.latestReading().page, 8);
  }
  const { api, volumes } = library({}, true);
  assert.equal(JSON.stringify(api.readProgress()), '{}');
  assert.doesNotThrow(() => api.saveProgress(volumes[0], 8));
  assert.doesNotThrow(() => api.saveFit('width'));
  assert.equal(api.getFit(), 'page');
});

test('最后阅读记录和每册旧进度一致，并保留其他册数', () => {
  const { api, volumes } = library({ 'yw80-progress-v1': '{"1":22}' });
  api.saveProgress(volumes[11], 75);
  assert.equal(api.readProgress()[1], 22);
  assert.equal(api.latestReading().volume.n, 12);
  assert.equal(api.latestReading().page, 75);
  assert.equal(api.pageUrl(volumes[11], 75), 'pages/v12/0075.webp?v=4');
});

test('链接参数严格选择册数，页码可边界修正', () => {
  const { api } = library();
  assert.equal(api.getVolume('12').n, 12);
  for (const value of ['1foo', '99', '-2', '2.5', null]) assert.equal(api.getVolume(value).n, 1);
  assert.equal(api.hashPage('#p=999', 61), 61);
  assert.equal(api.hashPage('#p=0', 61), 1);
  assert.equal(api.hashPage('#p=20', 61), 20);
  assert.equal(api.hashPage('#p=20oops', 61), null);
});
