// 去水印模块：右下角动态检测红色水印 + 背景色填充
// 水印区域（相对坐标）：x 69%-100%, y 88%-100%
const WM_X0 = 0.69, WM_Y0 = 0.88;

function removeWatermark(rgb, width, height) {
  const x0 = Math.floor(width * WM_X0);
  const y0 = Math.floor(height * WM_Y0);
  const wmW = width - x0;
  const wmH = height - y0;

  // Step 1: 在右下角区域内检测红色水印像素的边界框
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < wmH; y++) {
    for (let x = 0; x < wmW; x++) {
      const i = ((y0 + y) * width + (x0 + x)) * 3;
      const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      // 严格红色条件：R 显著高于 G/B，G/B 较低
      if (r > g + 40 && r > b + 40 && r > 160 && g < 120 && b < 120) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 如果没有检测到红色水印，回退到原来的亮度淡化
  if (minX === Infinity) {
    return removeWatermarkLegacy(rgb, width, height, x0, y0);
  }

  // Step 2: 扩展边界框（上下左右各 3px）
  minX = Math.max(0, minX - 3);
  minY = Math.max(0, minY - 3);
  maxX = Math.min(wmW - 1, maxX + 3);
  maxY = Math.min(wmH - 1, maxY + 3);

  // Step 3: 采样 bbox 上方一行的颜色作为背景色
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  const sampleY = Math.max(0, minY - 2);
  for (let x = minX; x <= maxX; x++) {
    const i = ((y0 + sampleY) * width + (x0 + x)) * 3;
    bgR += rgb[i]; bgG += rgb[i + 1]; bgB += rgb[i + 2]; bgCount++;
  }
  bgR = Math.round(bgR / bgCount);
  bgG = Math.round(bgG / bgCount);
  bgB = Math.round(bgB / bgCount);

  // Step 4: 用背景色填充水印区域
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = ((y0 + y) * width + (x0 + x)) * 3;
      rgb[i] = bgR;
      rgb[i + 1] = bgG;
      rgb[i + 2] = bgB;
    }
  }

  return rgb;
}

// 原始亮度淡化方案（备用）
function removeWatermarkLegacy(rgb, width, height, x0, y0) {
  for (let y = y0; y < height; y++) {
    for (let x = x0; x < width; x++) {
      const i = (y * width + x) * 3;
      const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum >= 88 && lum <= 238) {
        const dx = Math.min(x - x0, width - 1 - x);
        const dy = Math.min(y - y0, height - 1 - y);
        const edge = Math.min(1, Math.max(0, Math.min(dx, dy) / 24));
        const k = (0.92 + 0.08 * edge);
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
