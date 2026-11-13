/* Homepage background: terrain-to-city loop.
   Plays automatically on every visit, glides in from the right and expands
   toward the left behind the headline. Play/Pause stays available.
   No WebGL (or the engine fails to load): the looping video plays instead.
   Save-Data: the poster image stays, and Play starts the video on request. */
(function () {
  'use strict';
  var root = document.querySelector('.tc-hero');
  if (!root) return;
  var canvas = root.querySelector('canvas'), labels = root.querySelector('.tc-labels'), video = root.querySelector('.tc-video');
  var chip = root.querySelector('.tc-stage'), bar = root.querySelector('.tc-progress i'), btn = root.querySelector('.tc-toggle');
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var tc = null, mode = 'poster', visible = true, userPaused = false, loading = false;
  var START = { shift: 0.46, zoom: 1.5 }, FINAL = { shift: 0.12, zoom: 1.2 };
  /* Wider screens get a closer final view so the landscape reaches the right edge. */
  function fit() { var r = root.getBoundingClientRect(), a = r.width / Math.max(1, r.height); FINAL.zoom = a > 2.2 ? 0.92 : a > 1.9 ? 1.0 : a > 1.6 ? 1.1 : 1.2; START.zoom = FINAL.zoom + 0.3; }
  fit();
  var STAGE_NAMES = ['Natural terrain', 'Satellite imagery', '3D DTM from LiDAR', 'Elevation, hillshade and contours', 'Slope analysis', 'Site grading: cut and fill', 'Road hierarchy', 'Stormwater drainage', 'River and forest buffers', 'Land subdivision', 'Construction', 'Planned city'];

  var wide = function () { return window.innerWidth >= 1040; };
  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function bg() { return getComputedStyle(root).getPropertyValue('--tc-bg').trim() || '#ffffff'; }
  function setLabel(i) { if (chip) chip.textContent = 'Stage ' + (i + 1) + ' of 12: ' + STAGE_NAMES[i]; if (bar) bar.style.width = ((i + 1) / 12 * 100) + '%'; }
  function setBtn(playing) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', playing ? 'false' : 'true');
    btn.setAttribute('aria-label', playing ? 'Pause background animation' : 'Play background animation');
    btn.querySelector('span').textContent = playing ? 'Pause' : 'Play';
  }
  function isPlaying() { return mode === '3d' ? tc && tc.playing : mode === 'video' ? !video.paused : false; }

  /* Entrance: the landscape glides in from the right and widens toward the left. */
  function entrance() {
    if (!wide()) { tc.setView(0, 1.05); return; }
    var t0 = performance.now(), D = 2800;
    tc.setView(START.shift, START.zoom);
    (function step(now) {
      var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      if (tc) tc.setView(START.shift + (FINAL.shift - START.shift) * e, START.zoom + (FINAL.zoom - START.zoom) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function startVideo() {
    if (!video) return;
    mode = 'video';
    if (!video.src) video.src = video.getAttribute('data-src');
    root.classList.add('is-video');
    var p = video.play(); if (p && p.catch) p.catch(function () { setBtn(false); });
    setBtn(true);
    video.addEventListener('timeupdate', function () { setLabel(Math.min(11, Math.floor(video.currentTime / 5))); });
  }

  function start3d() {
    if (tc || loading) return;
    loading = true;
    import('./terrain-city.js?v=2026-11-14').then(function (m) {
      var low = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
      tc = m.createTerrainCity({ canvas: canvas, labels: wide() ? labels : null, mode: 'hero', quality: low ? 'low' : 'medium', maxDpr: 1.5,
        background: bg(), shiftX: wide() ? START.shift : 0, zoom: wide() ? START.zoom : 1.05, pinMinX: 0.52, stageSeconds: 6.5,
        onStage: function (i) { setLabel(i); } });
      mode = '3d';
      tc.setStage(0);
      root.classList.add('is-live');
      entrance();
      if (!userPaused && visible && !document.hidden) { tc.play(); setBtn(true); } else setBtn(false);
      new MutationObserver(function () { if (tc) tc.setBackground(bg()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      window.addEventListener('resize', function () { fit(); if (tc) tc.setView(wide() ? FINAL.shift : 0, wide() ? FINAL.zoom : 1.05); });
    }).catch(function (err) {
      if (window.console) console.warn('Terrain animation unavailable, using video:', err);
      loading = false; startVideo();
    });
  }

  if (btn) btn.addEventListener('click', function () {
    if (mode === 'poster') { userPaused = false; if (webgl()) start3d(); else startVideo(); return; }
    if (isPlaying()) {
      userPaused = true;
      if (mode === '3d') { tc.pause(); tc.stopLoop(); } else video.pause();
      setBtn(false);
    } else {
      userPaused = false;
      if (mode === '3d') { tc.resumeLoop(); tc.play(); } else video.play();
      setBtn(true);
    }
  });

  function resume() { if (userPaused || !visible || document.hidden) return; if (mode === '3d' && tc) { tc.resumeLoop(); tc.play(); } else if (mode === 'video') video.play(); }
  function halt() { if (mode === '3d' && tc) tc.stopLoop(); else if (mode === 'video') video.pause(); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) resume(); else halt(); }, { threshold: 0.05 }).observe(root);
  document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else resume(); });

  setLabel(0);
  if (saveData) { setBtn(false); root.classList.add('is-static'); return; }
  var go = function () {
    var run = function () { if (webgl()) start3d(); else startVideo(); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1200 }); else setTimeout(run, 150);
  };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
