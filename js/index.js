(function () {
  'use strict';
  const library = window.Yuwen;
  const grid = document.getElementById('grid');
  const filters = document.getElementById('gradeFilters');
  const status = document.getElementById('catalogStatus');
  let selectedGrade = '全部';

  const grades = [...new Set(window.VOLUMES.map(v => v.grade.split(' ')[0]))];
  document.getElementById('volumeCount').textContent = window.VOLUMES.length;
  document.getElementById('totalPages').textContent = window.VOLUMES.reduce((sum, v) => sum + v.pages, 0);

  function createCard(volume, progress) {
    const page = progress[volume.n];
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `read.html?v=${volume.n}${page ? '#p=' + page : ''}`;
    card.setAttribute('aria-label', `${volume.title}，${volume.grade}，${volume.pages}页${page ? '，继续第' + page + '页' : ''}`);
    const wrap = document.createElement('div');
    wrap.className = 'cover-wrap';
    const img = document.createElement('img');
    img.className = 'cover';
    img.src = library.coverUrl(volume, true);
    img.alt = '';
    img.width = 231;
    img.height = 320;
    img.loading = 'lazy';
    img.decoding = 'async';
    wrap.appendChild(img);
    const title = document.createElement('h4');
    title.textContent = volume.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = volume.grade.split(' ')[1];
    const pages = document.createElement('div');
    pages.className = 'pages';
    pages.textContent = `${volume.pages} 页`;
    card.append(wrap, title, meta, pages);
    if (page) {
      const badge = document.createElement('span');
      badge.className = 'resume';
      badge.textContent = `读到 ${page} 页`;
      card.appendChild(badge);
    }
    return card;
  }

  function render() {
    grid.dataset.filtered = String(selectedGrade !== '全部');
    const progress = library.readProgress();
    const fragment = document.createDocumentFragment();
    let count = 0;
    for (const grade of grades) {
      if (selectedGrade !== '全部' && selectedGrade !== grade) continue;
      const group = document.createElement('section');
      group.className = 'grade-group';
      const title = document.createElement('h3');
      title.className = 'grade-title';
      title.textContent = grade;
      title.id = `grade-${grades.indexOf(grade) + 1}`;
      group.setAttribute('aria-labelledby', title.id);
      const books = document.createElement('div');
      books.className = 'grade-books';
      for (const volume of window.VOLUMES.filter(v => v.grade.startsWith(grade + ' '))) {
        books.appendChild(createCard(volume, progress));
        count++;
      }
      group.append(title, books);
      fragment.appendChild(group);
    }
    grid.replaceChildren(fragment);
    status.textContent = `${selectedGrade}，显示 ${count} 册课本`;
    const latest = library.latestReading();
    const link = document.getElementById('continueReading');
    const note = document.getElementById('resumeNote');
    link.hidden = !latest;
    note.hidden = !latest;
    if (latest) {
      link.href = `read.html?v=${latest.volume.n}#p=${latest.page}`;
      link.textContent = `继续阅读 · ${latest.volume.title}`;
      note.textContent = `上次读到${latest.volume.grade} · 第 ${latest.page} 页`;
    }
  }

  for (const grade of ['全部', ...grades]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-filter';
    button.textContent = grade;
    button.setAttribute('aria-pressed', String(grade === selectedGrade));
    button.addEventListener('click', () => {
      selectedGrade = grade;
      for (const item of filters.children) item.setAttribute('aria-pressed', String(item === button));
      render();
    });
    filters.appendChild(button);
  }

  // Refresh progress after returning through the back/forward cache or another tab.
  window.addEventListener('pageshow', render);
  window.addEventListener('storage', render);
  render();
})();
