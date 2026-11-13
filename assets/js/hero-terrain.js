/* Homepage background: terrain-to-city loop.
   Loads three.js only after the page has rendered, pauses when the hero is
   off-screen or the tab is hidden, and never autoplays for reduced motion,
   Save-Data or devices without WebGL (the poster image stays instead). */
(function () {
  'use strict';
  var root = document.querySelector('.tc-hero');
  if (!root) return;
  var canvas = root.querySelector('canvas'), labels = root.querySelector('.tc-labels'), poster = root.querySelector('.tc-poster');
  var chip = root.querySelector('.tc-stage'), bar = root.querySelector('.tc-progress i'), btn = root.querySelector('.tc-toggle');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var tc = null, visible = true, userPaused = false, loading = false;

  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function bg() { return getComputedStyle(root).getPropertyValue('--tc-bg').trim() || '#ffffff'; }
  function setLabel(i, st) { if (chip) chip.textContent = 'Stage ' + (i + 1) + ' of 12: ' + st.label; if (bar) bar.style.width = ((i + 1) / 12 * 100) + '%'; }
  function setBtn(playing) { if (!btn) return; btn.setAttribute('aria-pressed', playing ? 'false' : 'true'); btn.setAttribute('aria-label', playing ? 'Pause background animation' : 'Play background animation'); btn.querySelector('span').textContent = playing ? 'Pause' : 'Play'; }

  function start(autoplay) {
    if (tc || loading) return;
    loading = true;
    import('./terrain-city.js').then(function (m) {
      var low = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
      var wide = window.innerWidth >= 1040;
      tc = m.createTerrainCity({ canvas: canvas, labels: wide ? labels : null, mode: 'hero', quality: low ? 'low' : 'medium', maxDpr: 1.5,
        background: bg(), shiftX: wide ? 0.26 : 0, zoom: wide ? 1.32 : 1.05, pinMinX: 0.56, stageSeconds: 6.5, onStage: setLabel });
      tc.setStage(0);
      root.classList.add('is-live');
      if (autoplay && !userPaused) { tc.play(); setBtn(true); } else setBtn(false);
      new MutationObserver(function () { if (tc) tc.setBackground(bg()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      window.addEventListener('resize', function () { if (tc) tc.setShift(window.innerWidth >= 1040 ? 0.26 : 0); });
    }).catch(function () { root.classList.add('is-static'); loading = false; });
  }

  if (btn) btn.addEventListener('click', function () {
    if (!tc) { userPaused = false; start(true); return; }
    if (tc.playing) { tc.pause(); tc.stopLoop(); userPaused = true; setBtn(false); } else { userPaused = false; tc.resumeLoop(); tc.play(); setBtn(true); }
  });

  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (!tc) return;
    if (!visible) tc.stopLoop(); else if (!userPaused && !reduce) { tc.resumeLoop(); tc.play(); }
  }, { threshold: 0.05 }).observe(root);
  document.addEventListener('visibilitychange', function () { if (!tc) return; if (document.hidden) tc.stopLoop(); else if (visible && !userPaused && !reduce) { tc.resumeLoop(); tc.play(); } });

  if (reduce || saveData || !webgl()) { root.classList.add('is-static'); setBtn(false); return; }
  var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(function () { start(true); }, { timeout: 1500 }); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
