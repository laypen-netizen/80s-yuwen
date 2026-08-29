// 全量高清转换：PDF scale=2 渲染 → 去水印 → 锐化 → WebP q88
// 用法: node convert-hd.js <pdfPath> <outDir> [startPage] [endPage] [force]
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Module = require('module');
const napiCanvas = require('/Users/huangliping/.workbuddy/binaries/node/workspace/node_modules/@napi-rs/canvas');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'canvas') return napiCanvas;
  return origLoad.apply(this, arguments);
};
const { createCanvas } = napiCanvas;
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { removeWatermark } = require(path.join(__dirname, 'watermark.js'));

const RENDER_SCALE = 2;

async function main() {
  const pdfPath = process.argv[2];
  const outDir = process.argv[3];
  const startPage = parseInt(process.argv[4] || '1', 10);
  const endPage = parseInt(process.argv[5] || '0', 10); // 0 = all pages
  const force = process.argv[6] === 'force' || process.argv[5] === 'force' || process.argv[4] === 'force';
  fs.mkdirSync(outDir, { recursive: true });

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const lastPage = endPage > 0 ? Math.min(endPage, doc.numPages) : doc.numPages;

  const t0 = Date.now();
  let done = 0, skip = 0, fail = 0;
  for (let i = startPage; i <= lastPage; i++) {
    const out = path.join(outDir, String(i).padStart(4, '0') + '.webp');
    if (!force && fs.existsSync(out) && fs.statSync(out).size > 10000) { skip++; continue; }
    try {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: RENDER_SCALE });
      const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const png = canvas.toBuffer('image/png');
      await page.cleanup();

      // PNG → flatten 去 alpha → raw RGB → 去水印 → 锐化 → 输出 WebP
      const raw = await sharp(png).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
      const rgb = removeWatermark(raw.data, raw.info.width, raw.info.height);
      await sharp(rgb, { raw: { width: raw.info.width, height: raw.info.height, channels: 3 } })
        .sharpen({ sigma: 1.1, m1: 0.6, m2: 0.4, x1: 1.5, y2: 8, y3: 8 })
        .linear(1.1, -10)
        .webp({ quality: 88 })
        .toFile(out);
      done++;
      if (done % 5 === 0 || i === lastPage) {
        const secs = ((Date.now() - t0) / 1000).toFixed(0);
        const avg = ((Date.now() - t0) / (done + skip || 1) / 1000).toFixed(1);
        console.log(`${path.basename(pdfPath)} p${startPage}-${lastPage}: ${done + skip}/${lastPage - startPage + 1} (done ${done}, skip ${skip}, fail ${fail}), avg ${avg}s/page, ${secs}s`);
      }
    } catch (e) {
      fail++;
      console.error(`page ${i} FAIL:`, e.message);
    }
  }
  console.log(`DONE ${path.basename(pdfPath)} p${startPage}-${lastPage}: done ${done}, skip ${skip}, fail ${fail}, total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await doc.destroy();
  process.exit(fail > 0 ? 2 : 0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
