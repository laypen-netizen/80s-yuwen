// Real-ESRGAN 分块超分模块（固定 224x224 输入模型，多 session 并行 tiles）
const ort = require('onnxruntime-node');
const sharp = require('sharp');

const TILE = 224;
const OVERLAP = 16;

class SR {
  constructor(modelPath, numSessions = 4) {
    this.modelPath = modelPath;
    this.numSessions = numSessions;
    this.sessions = [];
  }
  async init() {
    for (let i = 0; i < this.numSessions; i++) {
      this.sessions.push(await ort.InferenceSession.create(this.modelPath, { numThreads: 1 }));
    }
  }
  async release() {
    for (const s of this.sessions) await s.release();
  }
  // 整图超分：buf(RGB raw) -> {data, width, height}
  async upscaleImage(buf, width, height) {
    const step = TILE - OVERLAP;
    const cols = Math.max(1, Math.ceil((width - OVERLAP) / step));
    const rows = Math.max(1, Math.ceil((height - OVERLAP) / step));
    const outW = width * 4, outH = height * 4;
    const out = Buffer.alloc(outW * outH * 3);
    const weight = Buffer.alloc(outW * outH);
    const tiles = [];
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        tiles.push({
          x0: Math.min(rx * step, width - TILE),
          y0: Math.min(ry * step, height - TILE),
        });
      }
    }
    // 多 session 并行（每 session 依次处理自己队列中的 tile）
    const queue = [...tiles];
    let idx = 0;
    const worker = async (session) => {
      while (true) {
        const i = idx++;
        if (i >= queue.length) break;
        const t = queue[i];
        const crop = await sharp(buf, { raw: { width, height, channels: 3 } })
          .extract({ left: t.x0, top: t.y0, width: TILE, height: TILE })
          .raw().toBuffer();
        const input = new ort.Tensor('float32', this._preprocess(crop), [1, 3, TILE, TILE]);
        const feeds = {};
        feeds[session.inputNames[0]] = input;
        const outputs = await session.run(feeds);
        const od = outputs[session.outputNames[0]].data;
        const tileOut = TILE * 4; // 896
        for (let ty = 0; ty < tileOut; ty++) {
          const wy = this._tri(ty, tileOut);
          for (let tx = 0; tx < tileOut; tx++) {
            const wx = this._tri(tx, tileOut);
            const ox = t.x0 * 4 + tx, oy = t.y0 * 4 + ty;
            for (let ch = 0; ch < 3; ch++) {
              const v = Math.min(1, Math.max(-1, od[ch * tileOut * tileOut + ty * tileOut + tx]));
              out[(oy * outW + ox) * 3 + ch] += (v + 1) / 2 * 255 * wx * wy;
            }
            weight[oy * outW + ox] += wx * wy * 255;
          }
        }
      }
    };
    await Promise.all(this.sessions.map(worker));
    const rgb = Buffer.alloc(outW * outH * 3);
    for (let i = 0; i < outW * outH; i++) {
      const wgt = weight[i] / 255 || 1;
      rgb[i * 3] = Math.round(out[i * 3] / wgt);
      rgb[i * 3 + 1] = Math.round(out[i * 3 + 1] / wgt);
      rgb[i * 3 + 2] = Math.round(out[i * 3 + 2] / wgt);
    }
    return { data: rgb, width: outW, height: outH };
  }
  _preprocess(rgb) {
    const data = new Float32Array(3 * TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = (y * TILE + x) * 3;
        data[y * TILE + x] = (rgb[i] / 255) * 2 - 1;
        data[TILE * TILE + y * TILE + x] = (rgb[i + 1] / 255) * 2 - 1;
        data[2 * TILE * TILE + y * TILE + x] = (rgb[i + 2] / 255) * 2 - 1;
      }
    }
    return data;
  }
  _tri(t, n) {
    if (n <= 1) return 1;
    const c = (n - 1) / 2;
    return 1 - Math.abs(t - c) / c;
  }
}

module.exports = { SR, TILE, OVERLAP };
