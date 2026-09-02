#!/usr/bin/env node
/**
 * 批量重压 webp：q88 → q78，覆盖原文件（原子写入）
 * 用法: node recompress.js <file> [<file>...]
 */
'use strict';
const sharp = require('/Users/huangliping/.workbuddy/binaries/node/workspace/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) { console.error('no files'); process.exit(1); }

let done = 0, total = files.length;
function processFile(f) {
  return sharp(f)
    .webp({ quality: 78 })
    .toBuffer()
    .then(buf => {
      const tmp = f + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, f);
      done++;
      console.log(`[${done}/${total}] ${f} -> ${(buf.length/1024).toFixed(0)}KB`);
    })
    .catch(e => { console.error('ERR', f, e.message); done++; });
}

(async () => {
  // 控制并发 4
  const conc = 4;
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const f = files[idx++];
      await processFile(f);
    }
  }
  await Promise.all(Array.from({length: Math.min(conc, files.length)}, worker));
  console.log('ALL DONE', done + '/' + total);
})();
