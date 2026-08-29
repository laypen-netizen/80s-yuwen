import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function readWebpDimensions(url) {
  const bytes = readFileSync(url);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (type === "VP8 ") {
      assert.equal(bytes.toString("hex", data + 3, data + 6), "9d012a");
      return {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff,
      };
    }

    offset = data + size + (size % 2);
  }

  assert.fail("WebP 文件缺少可识别的 VP8 尺寸信息");
}

test("首页正文使用统一的长文排版系统", () => {
  assert.match(html, /--prose-serif\s*:/);
  assert.match(html, /<div class="about prose">/);
  assert.match(html, /<div class="about-columns">/);
  assert.match(html, /\.about-columns\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(html, /\.about-columns\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.doesNotMatch(html, /\.about\s+\.two-col/);
});

test("大引用的引号包围引文本身，而不是出处", () => {
  assert.match(html, /<span class="quote-copy">[^<]+<\/span>\s*<cite>/s);
  assert.match(html, /\.quote-copy::before/);
  assert.match(html, /\.quote-copy::after/);
  assert.doesNotMatch(html, /\.big-quote blockquote::after/);
});

test("情怀区使用明确的桌面与移动端阅读顺序", () => {
  assert.match(html, /grid-template-areas:\s*"copy image"\s*"copy quote"/);
  assert.match(html, /grid-template-areas:\s*"image"\s*"copy"\s*"quote"/);
  assert.match(html, /\.memory-img\s*\{[^}]*height:\s*auto[^}]*aspect-ratio:\s*3\s*\/\s*2/s);
  assert.match(html, /\.memory-heading-section/);
  assert.match(html, /\.memory-wrap\s*\{\s*padding:\s*0 16px 36px;/);
  assert.match(html, /\.memory\s*\{[^}]*padding:\s*24px 20px 22px;/s);
  assert.match(html, /@media \(max-width: 480px\)\s*\{[\s\S]*\.memory-heading-section\s*\{\s*padding-bottom:\s*12px;\s*\}/);
  assert.match(html, /\.memory\s*\{\s*padding:\s*22px 18px 20px;\s*\}/);
  assert.doesNotMatch(html, /style="padding-bottom:\s*8px;?"/);
});

test("首页使用新版响应式教室插画资源", () => {
  assert.match(html, /src="images\/classroom-v2-1200\.webp"/);
  assert.match(html, /srcset="images\/classroom-v2-800\.webp 800w, images\/classroom-v2-1200\.webp 1200w"/);
  assert.match(html, /sizes="\(max-width: 480px\) calc\(100vw - 72px\), \(max-width: 640px\) calc\(100vw - 76px\), \(max-width: 960px\) calc\(46vw - 64\.4px\), 378px"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /alt="阳光照进摆满木课桌的旧式教室插画"/);
  assert.doesNotMatch(html, /src="images\/classroom\.webp"/);

  for (const [filename, expected] of [
    ["classroom-v2-800.webp", { width: 800, height: 533 }],
    ["classroom-v2-1200.webp", { width: 1200, height: 800 }],
  ]) {
    const url = new URL(`../images/${filename}`, import.meta.url);
    assert.equal(existsSync(url), true, `${filename} 应存在`);
    assert.deepEqual(readWebpDimensions(url), expected);
  }
});
