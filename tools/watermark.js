// 去水印模块：右下角固定区域灰度淡化（保守方案，正文黑字保留）
// 水印区域（相对坐标）：x 69%-100%, y 88%-100%
const WM_X0 = 0.69, WM_Y0 = 0.88;

function removeWatermark(rgb, width, height) {
  const x0 = Math.floor(width * WM_X0);
  const y0 = Math.floor(height * WM_Y0);
  for (let y = y0; y < height; y++) {
    for (let x = x0; x < width; x++) {
      const i = (y * width + x) * 3;
      const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum >= 88 && lum <= 238) {
        // 淡入淡出边缘：靠近区域边界的像素淡化力度减弱
        const dx = Math.min(x - x0, width - 1 - x);
        const dy = Math.min(y - y0, height - 1 - y);
        const edge = Math.min(1, Math.max(0, Math.min(dx, dy) / 24));
        const k = (0.92 + 0.08 * edge); // 内部强淡化，边缘渐弱
        const target = 240;
        const f = (target - lum) * k;
        const nr = Math.round(Math.min(255, r + f * (r / (lum || 1))));
        const ng = Math.round(Math.min(255, g + f * (g / (lum || 1))));
        const nb = Math.round(Math.min(255, b + f * (b / (lum || 1))));
        rgb[i] = nr; rgb[i + 1] = ng; rgb[i + 2] = nb;
      }
    }
  }
  return rgb;
}

module.exports = { removeWatermark, WM_X0, WM_Y0 };
