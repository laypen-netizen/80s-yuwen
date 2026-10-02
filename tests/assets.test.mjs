import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../js/volumes.js', import.meta.url), 'utf8'), context);
const volumes = context.window.VOLUMES;

test('十二册元数据与全部扫描件对应，854页文件可读', () => {
  assert.equal(new Set(volumes.map(v => v.n)).size, 12);
  assert.equal(volumes.reduce((sum, v) => sum + v.pages, 0), 854);
  for (const v of volumes) {
    const id = String(v.n).padStart(2, '0');
    const directory = new URL(`../pages/v${id}/`, import.meta.url);
    assert.equal(readdirSync(directory).filter(name => name.endsWith('.webp')).length, v.pages);
    for (let p = 1; p <= v.pages; p++) {
      const bytes = readFileSync(new URL(`${String(p).padStart(4, '0')}.webp`, directory));
      assert.ok(bytes.length > 1024);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
    for (const cover of [`v${id}.jpg`, `thumb-v${id}.webp`]) {
      assert.ok(readFileSync(new URL(`../covers/${cover}`, import.meta.url)).length > 1024);
    }
  }
});

test('HTML 引用的同源脚本和样式存在，且没有内联脚本或样式', () => {
  for (const page of ['index.html', 'read.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<style\b|\sstyle=|\son\w+=/i);
    assert.doesNotMatch(html, /unsafe-inline/);
    for (const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
      if (/^https?:/.test(match[1])) continue;
      const path = match[1].split(/[?#]/)[0];
      assert.ok(readFileSync(new URL(`../${path}`, import.meta.url)).length > 0, path);
    }
  }
});
