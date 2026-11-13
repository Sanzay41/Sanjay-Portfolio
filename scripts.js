(function () {
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // ---- Illustrative cellular automata land-cover demo (invented terrain, not project data) ----
  var COLS = 72, ROWS = 44, CELL = 10;
  var WATER = 0, FOREST = 1, CROP = 2, BUILT = 3, BARREN = 4;
  var canvas = document.getElementById('map');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stat = document.getElementById('stat');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.years button'));

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = rng(41);

  function elev(x, y) {
    return 0.5 + 0.25 * Math.sin(x * 0.11 + 1.3) + 0.2 * Math.sin(y * 0.17 + 0.4) +
      0.15 * Math.sin((x + y) * 0.07 + 2) + 0.1 * Math.sin(x * 0.31 - y * 0.23);
  }

  function makeBase() {
    var g = [], x, y;
    for (y = 0; y < ROWS; y++) {
      g[y] = [];
      for (x = 0; x < COLS; x++) {
        var e = elev(x, y), c;
        if (e > 0.62) c = FOREST; else c = CROP;
        if (e < 0.3 && rand() > 0.45) c = BARREN;
        var river = ROWS * 0.58 + Math.sin(x * 0.12) * 6;
        if (Math.abs(y - river) < 1.5) c = WATER;
        if (Math.pow((x - 13) / 5, 2) + Math.pow((y - 9) / 3.2, 2) < 1) c = WATER;
        g[y][x] = c;
      }
    }
    [[44, 27, 2.6], [18, 33, 1.6], [58, 13, 1.8], [30, 17, 1.3]].forEach(function (s) {
      for (var yy = 0; yy < ROWS; yy++) for (var xx = 0; xx < COLS; xx++) {
        var d = Math.hypot(xx - s[0], yy - s[1]);
        if (d < s[2] && g[yy][xx] !== WATER && rand() > 0.25) g[yy][xx] = BUILT;
      }
    });
    return g;
  }

  function count(g, x, y, k) {
    var n = 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS && g[yy][xx] === k) n++;
    }
    return n;
  }

  function evolve(g, rounds) {
    for (var r = 0; r < rounds; r++) {
      var next = g.map(function (row) { return row.slice(); });
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        var c = g[y][x], nb = count(g, x, y, BUILT);
        if (c === CROP) {
          var p = 0.004 + 0.085 * nb;
          if (rand() < Math.min(p, 0.6)) next[y][x] = BUILT;
        } else if (c === FOREST && count(g, x, y, CROP) >= 4 && rand() < 0.02) {
          next[y][x] = CROP;
        } else if (c === BARREN && count(g, x, y, CROP) >= 2 && rand() < 0.05) {
          next[y][x] = CROP;
        }
      }
      g = next;
    }
    return g;
  }

  var base = makeBase();
  var g2025 = evolve(base, 3);
  var g2050 = evolve(g2025, 6);
  var states = [base, g2025, g2050];
  var labels = ['2015', '2025', '2050'];
  var current = 0;

  function colors() {
    var s = getComputedStyle(document.documentElement);
    function v(n) { return s.getPropertyValue(n).trim(); }
    return [v('--c-water'), v('--c-forest'), v('--c-crop'), v('--c-built'), v('--c-barren')];
  }

  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = COLS * CELL * dpr;
    canvas.height = ROWS * CELL * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var pal = colors(), g = states[current], built = 0, x, y;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      ctx.fillStyle = pal[g[y][x]];
      ctx.fillRect(x * CELL, y * CELL, CELL + 0.5, CELL + 0.5);
      if (g[y][x] === BUILT) built++;
    }
    var pct = Math.round(built / (COLS * ROWS) * 100);
    stat.textContent = 'Built-up area: ' + pct + '% of the map';
    canvas.setAttribute('aria-label', 'Simulated land-cover map for ' + labels[current] + '. Built-up area covers ' + pct + ' percent.');
  }

  function select(i) {
    current = i;
    buttons.forEach(function (b, k) { b.setAttribute('aria-checked', k === i ? 'true' : 'false'); });
    draw();
  }

  var timer = null;
  function stopAuto() { if (timer) { clearTimeout(timer); timer = null; } }
  buttons.forEach(function (b, i) {
    b.addEventListener('click', function () { stopAuto(); select(i); });
  });

  draw();
  select(0);

  // One-time play from 2015 to 2050 on load, unless the visitor prefers reduced motion.
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    timer = setTimeout(function () {
      select(1);
      timer = setTimeout(function () { select(2); timer = null; }, 1300);
    }, 1400);
  }

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var redraw = function () { draw(); };
    if (mq.addEventListener) mq.addEventListener('change', redraw); else if (mq.addListener) mq.addListener(redraw);
  }
})();
