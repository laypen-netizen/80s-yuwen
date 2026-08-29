// 全量高清转换：渲染 → 0.5x → Real-ESRGAN 超分4x → 去水印 → 锐化 → WebP q88
// 用法: node convert-hd.js <pdfPath> <outDir> [numSessions] [force]
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
const { SR } = require('/Users/huangliping/WorkBuddy/80s-yuwen/tools/sr');
const { removeWatermark } = require('/Users/huangliping/WorkBuddy/80s-yuwen/tools/watermark');

const MODEL = '/Users/huangliping/WorkBuddy/80s-yuwen/tools/models/realesrgan-x4plus.onnx';

async function main() {
  const pdfPath = process.argv[2];
  const outDir = process.argv[3];
  const numSessions = parseInt(process.argv[4] || '2', 10);
  const force = process.argv[5] === 'force';
  fs.mkdirSync(outDir, { recursive: true });

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const sr = new SR(MODEL, numSessions);
  await sr.init();

  const t0 = Date.now();
  let done = 0, skip = 0, fail = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const out = path.join(outDir, String(i).padStart(4, '0') + '.webp');
    if (!force && fs.existsSync(out) && fs.statSync(out).size > 10000) { skip++; continue; }
    try {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const png = canvas.toBuffer('image/png');
      page.cleanup();

      const half = await sharp(png).resize(Math.round(vp.width / 2), Math.round(vp.height / 2), { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
      const res = await sr.upscaleImage(half.data, half.info.width, half.info.height);
      let rgb = res.data;
      rgb = removeWatermark(Buffer.from(rgb), res.width, res.height);
      await sharp(rgb, { raw: { width: res.width, height: res.height, channels: 3 } })
        .sharpen({ sigma: 1.1, m1: 0.6, m2: 0.4, x1: 1.5, y2: 8, y3: 8 })
        .linear(1.1, -10)
        .webp({ quality: 88 })
        .toFile(out);
      done++;
      if (done % 5 === 0 || done + skip === doc.numPages) {
        const secs = ((Date.now() - t0) / 1000).toFixed(0);
        const avg = ((Date.now() - t0) / (done + skip || 1) / 1000).toFixed(1);
        console.log(`${path.basename(pdfPath)}: ${done + skip}/${doc.numPages} (done ${done}, skip ${skip}, fail ${fail}), avg ${avg}s/page, ${secs}s`);
      }
    } catch (e) {
      fail++;
      console.error(`page ${i} FAIL:`, e.message);
    }
  }
  console.log(`DONE ${path.basename(pdfPath)}: done ${done}, skip ${skip}, fail ${fail}, total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await sr.release();
  await doc.destroy();
  process.exit(fail > 0 ? 2 : 0);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
