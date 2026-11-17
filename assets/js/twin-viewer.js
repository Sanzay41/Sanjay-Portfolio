/* City digital twin pages: viewer, chapter and scenario controls, simulated dashboard. */
(function () {
  'use strict';
  var root = document.querySelector('.tw-stage');
  if (!root) return;
  var canvas = root.querySelector('canvas'), labels = root.querySelector('.tc-labels'), chip = root.querySelector('.tw-chip'), bar = root.querySelector('.tc-progress i');
  var dash = root.querySelector('.tw-dash'), playBtn = root.querySelector('[data-act="play"]');
  var chBtns = Array.prototype.slice.call(root.querySelectorAll('[data-ch]'));
  var startCh = root.getAttribute('data-chapter') || 'gis', journey = root.getAttribute('data-mode') === 'journey';
  var tw = null, visible = false, userPaused = false, loading = false, CH = null, JOURNEY = null;

  var METRICS = [
    ['temp', 'Temperature', '°C'], ['aqi', 'Air quality index', ''], ['traffic', 'Traffic congestion', '%'],
    ['energy', 'Electricity demand', 'MW'], ['rain', 'Rainfall intensity', 'mm/h'], ['river', 'River level', 'm'],
  ];
  if (dash) {
    dash.innerHTML = '<div class="tw-dash-head"><b>Live dashboard</b><span class="tw-sim">Simulated data</span></div>' +
      '<div class="tw-tiles">' + METRICS.map(function (m) { return '<div class="tw-tile" data-m="' + m[0] + '"><span>' + m[1] + '</span><b><em>–</em> ' + m[2] + '</b><svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points=""/><line class="fc" x1="0" x2="100" y1="0" y2="0"/></svg></div>'; }).join('') + '</div>' +
      '<ul class="tw-alerts" aria-live="polite"></ul>';
  }
  function spark(svg, arr, fcVal) {
    if (!arr || arr.length < 2) return;
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr.concat(fcVal || -Infinity)); if (hi - lo < 1e-6) { hi = lo + 1; }
    var pts = arr.map(function (v, k) { return (k / (arr.length - 1) * 100).toFixed(1) + ',' + (22 - (v - lo) / (hi - lo) * 20).toFixed(1); }).join(' ');
    svg.querySelector('polyline').setAttribute('points', pts);
    var fc = svg.querySelector('.fc');
    if (fcVal) { var y = (22 - (fcVal - lo) / (hi - lo) * 20).toFixed(1); fc.setAttribute('y1', y); fc.setAttribute('y2', y); fc.style.display = ''; } else fc.style.display = 'none';
  }
  function onDash(m) {
    if (!dash) return;
    METRICS.forEach(function (d) {
      var t = dash.querySelector('[data-m="' + d[0] + '"]');
      t.querySelector('em').textContent = m[d[0]];
      t.classList.toggle('focus', m.focus === d[0]);
      t.classList.toggle('warn', (d[0] === 'rain' && m.rain > 30) || (d[0] === 'river' && m.forecast) || (d[0] === 'aqi' && m.aqi > 100));
      spark(t.querySelector('svg'), m.series[d[0]], d[0] === 'river' && m.forecast ? m.riverForecast : 0);
    });
    var html = m.alerts.map(function (a) { return '<li class="' + a.lvl + '">' + a.txt + '</li>'; }).join('');
    if (m.forecast) html = '<li class="fc">ML forecast (simulated): river peak ' + m.riverForecast + ' m in about 3 h</li>' + html;
    var ul = dash.querySelector('.tw-alerts'); if (ul.innerHTML !== html) ul.innerHTML = html;
    root.classList.toggle('show-dash', ['iot', 'ai', 'flood', 'quake', 'fire'].indexOf(m.chapter) > -1);
  }
  function onChapter(c) {
    if (!CH) return;
    chip.textContent = (journey ? 'Step ' + (JOURNEY.indexOf(c) + 1 || '') + ': ' : '') + CH[c].label;
    chBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ch') === c ? 'true' : 'false'); });
    if (bar) bar.style.width = journey ? ((JOURNEY.indexOf(c) + 1) / JOURNEY.length * 100) + '%' : '100%';
    root.classList.remove('cut'); void root.offsetWidth; root.classList.add('cut');
  }
  function setPlay(p) { if (!playBtn) return; playBtn.querySelector('span').textContent = p ? 'Pause' : 'Play'; playBtn.setAttribute('aria-label', p ? 'Pause animation' : 'Play animation'); }
  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

  function start() {
    if (tw || loading) return; loading = true;
    import('./city-twin.js?v=2026-11-17').then(function (m) {
      CH = m.CHAPTERS; JOURNEY = m.JOURNEY;
      var low = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
      tw = m.createCityTwin({ canvas: canvas, labels: labels, quality: low ? 'low' : 'medium', maxDpr: 1.5, chapter: journey ? 'journey' : startCh, onDash: onDash, onChapter: onChapter });
      root.classList.add('is-live');
      var poster = root.querySelector('.tw-poster'); if (poster) poster.style.visibility = 'hidden';
      if (visible && !userPaused) { tw.play(); setPlay(true); } else { tw.setChapter(tw.chapter, true); setPlay(false); }
    }).catch(function (e) { if (window.console) console.warn('Digital twin demo unavailable:', e); root.classList.add('is-static'); loading = false; });
  }
  chBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (!tw) { startCh = b.getAttribute('data-ch'); start(); return; }
      var c = b.getAttribute('data-ch');
      tw.setMode(journey && JOURNEY.indexOf(c) > -1 ? 'journey' : c); tw.setChapter(c, true);
      userPaused = false; tw.resumeLoop(); tw.play(); setPlay(true);
    });
  });
  if (playBtn) playBtn.addEventListener('click', function () {
    if (!tw) { start(); return; }
    if (tw.playing) { tw.pause(); tw.stopLoop(); userPaused = true; setPlay(false); } else { userPaused = false; tw.resumeLoop(); tw.play(); setPlay(true); }
  });
  function halt() { if (tw) tw.stopLoop(); }
  function resume() { if (tw && visible && !document.hidden && !userPaused) { tw.resumeLoop(); tw.play(); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { if (!tw) start(); else resume(); } else halt(); }, { rootMargin: '200px 0px', threshold: 0.01 }).observe(root);
  else { visible = true; start(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else resume(); });
  if (!webgl()) root.classList.add('is-static');
})();
