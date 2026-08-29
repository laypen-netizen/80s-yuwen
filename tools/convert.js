const fs = require('fs');
const path = require('path');
const Module = require('module');
const napiCanvas = require('@napi-rs/canvas');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'canvas') return napiCanvas;
  return origLoad.apply(this, arguments);
};
const { createCanvas } = napiCanvas;
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

// 用法: node convert.js <pdfPath> <outDir> [targetWidth]
const [,, pdfPath, outDir, widthArg] = process.argv;
const TARGET_W = parseInt(widthArg || '1400', 10);

async function main() {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  fs.mkdirSync(outDir, { recursive: true });
  let totalBytes = 0;
  const t0 = Date.now();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = TARGET_W / vp1.width;
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const buf = await canvas.encode('webp', 80);
    const out = path.join(outDir, String(i).padStart(4, '0') + '.webp');
    fs.writeFileSync(out, buf);
    totalBytes += buf.length;
    page.cleanup();
    if (i % 10 === 0 || i === doc.numPages) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${path.basename(pdfPath)}: ${i}/${doc.numPages} pages, avg ${(totalBytes / i / 1024).toFixed(0)}KB/page, ${secs}s`);
    }
  }
  console.log(`DONE ${path.basename(pdfPath)}: ${doc.numPages} pages, total ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
  await doc.destroy();
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
