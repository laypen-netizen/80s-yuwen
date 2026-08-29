const grid = document.getElementById('grid');

// 按学年分组：一年级上/下 … 六年级上/下
const groups = [];
for (let i = 0; i < VOLUMES.length; i += 2) {
  const a = VOLUMES[i];
  const b = VOLUMES[i + 1];
  const gradeName = a.grade.split(' ')[0];
  groups.push({ name: gradeName, vols: [a, b] });
}

for (const g of groups) {
  const h2 = document.createElement('h2');
  h2.className = 'grade-title';
  h2.textContent = g.name;
  grid.appendChild(h2);
  for (const v of g.vols) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `read.html?v=${v.n}`;
    const img = document.createElement('img');
    img.className = 'cover';
    img.src = `covers/v${String(v.n).padStart(2, '0')}.jpg`;
    img.alt = `第${v.n}册封面`;
    img.loading = 'lazy';
    img.width = 320;
    img.height = 427;
    const h3 = document.createElement('h3');
    h3.textContent = `第${v.n}册`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = v.grade;
    // 恢复上次阅读进度提示
    try {
      const m = JSON.parse(localStorage.getItem('yw80-progress-v1') || '{}');
      const p = m[v.n];
      if (typeof p === 'number' && p > 1) {
        const badge = document.createElement('span');
        badge.className = 'resume';
        badge.textContent = `续读 P${p}`;
        a.appendChild(badge);
      }
    } catch { /* 忽略 */ }
    a.append(img, h3, meta);
    grid.appendChild(a);
  }
}
