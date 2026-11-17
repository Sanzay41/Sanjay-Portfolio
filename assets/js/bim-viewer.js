/* BIM & GeoBIM page: build sequence that plays on its own, plus system explorer. */
(function () {
  'use strict';
  var root = document.querySelector('.bim-stage');
  if (!root) return;
  var canvas = root.querySelector('canvas'), labels = root.querySelector('.tc-labels'), chip = root.querySelector('.tc-stage'), bar = root.querySelector('.tc-progress i');
  var playBtn = root.querySelector('[data-act="play"]'), replayBtn = root.querySelector('[data-act="replay"]'), allBtn = root.querySelector('[data-act="all"]');
  var sysBtns = Array.prototype.slice.call(root.querySelectorAll('[data-sys]'));
  var bb = null, visible = false, userPaused = false, selected = new Set(), loading = false;
  /* Safety net: if the page stylesheet has not arrived (old cached CSS), apply the essential layout inline
     so the model always fills the stage instead of rendering at the browser's default 300 x 150. */
  var view = root.querySelector('.bim-view');
  if (getComputedStyle(view).position !== 'relative') {
    root.style.background = '#0f1b2a';
    view.style.cssText = 'position:relative;height:clamp(520px,74vh,780px);overflow:hidden';
    [canvas, root.querySelector('.bim-poster')].forEach(function (el) { if (el) el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover'; });
    labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    var top = root.querySelector('.bim-top'); if (top) top.style.cssText = 'position:absolute;left:0;right:0;top:18px;z-index:3;display:flex;gap:12px;align-items:center';
  }
  var NAMES = ['Existing topography', 'Basement excavation', 'Footings', 'Structural frame', 'Reinforcement', 'Plumbing and fire protection', 'HVAC', 'Electrical system', 'IoT sensors', 'Complete building'];

  function setLabel(i) { chip.textContent = 'Stage ' + (i + 1) + ' of 10: ' + NAMES[i]; bar.style.width = ((i + 1) * 10) + '%'; }
  function setPlay(p) { playBtn.querySelector('span').textContent = p ? 'Pause' : 'Play'; playBtn.setAttribute('aria-label', p ? 'Pause build sequence' : 'Play build sequence'); }
  function syncSys() { sysBtns.forEach(function (b) { b.setAttribute('aria-pressed', selected.has(b.getAttribute('data-sys')) ? 'true' : 'false'); }); }
  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

  function start() {
    if (bb || loading) return; loading = true;
    import('./bim-build.js?v=2026-11-17').then(function (m) {
      var low = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
      bb = m.createBimBuild({ canvas: canvas, labels: labels, quality: low ? 'low' : 'medium', maxDpr: 1.5, stageSeconds: 7, onStage: setLabel });
      root.classList.add('is-live');
      var poster = root.querySelector('.bim-poster'); if (poster) poster.style.visibility = 'hidden';
      bb.setStage(0);
      if (visible && !userPaused) { bb.play(); setPlay(true); } else setPlay(false);
    }).catch(function (e) { if (window.console) console.warn('BIM model unavailable:', e); root.classList.add('is-static'); });
  }
  function explore() {
    if (!bb) return;
    if (selected.size) { bb.explore(selected); chip.textContent = 'Exploring: ' + sysBtns.filter(function (b) { return selected.has(b.getAttribute('data-sys')); }).map(function (b) { return b.textContent.trim(); }).join(', '); bb.pause(); bb.resumeLoop(); setPlay(false); }
    else { bb.explore(null); }
  }
  sysBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-sys');
      if (selected.has(k)) selected.delete(k); else selected.add(k);
      syncSys(); explore();
      if (!selected.size) { bb.setStage(9); setLabel(9); }
    });
  });
  allBtn.addEventListener('click', function () { selected = new Set(sysBtns.map(function (b) { return b.getAttribute('data-sys'); })); syncSys(); explore(); });
  replayBtn.addEventListener('click', function () { selected.clear(); syncSys(); if (!bb) return; bb.explore(null); bb.setStage(0); userPaused = false; bb.resumeLoop(); bb.play(); setPlay(true); });
  playBtn.addEventListener('click', function () {
    if (!bb) { start(); return; }
    if (bb.exploring) { selected.clear(); syncSys(); bb.explore(null); }
    if (bb.playing) { bb.pause(); bb.stopLoop(); userPaused = true; setPlay(false); } else { userPaused = false; bb.resumeLoop(); bb.play(); setPlay(true); }
  });
  function halt() { if (bb) bb.stopLoop(); }
  function resume() { if (!bb || document.hidden || !visible) return; if (bb.exploring || (bb.playing && !userPaused)) bb.resumeLoop(); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (visible) { if (!bb) start(); else resume(); } else halt();
  }, { rootMargin: '200px 0px', threshold: 0.01 }).observe(root);
  else { visible = true; start(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else resume(); });
  if (!webgl()) { root.classList.add('is-static'); }
})();
