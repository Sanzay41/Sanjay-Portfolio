/* Interactive calculators for methods-ahp.html.
   Both reproduce published project calculations; neither invents data. */
(function () {
  'use strict';
  var RI = { 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45 };
  function fmt(x, d) { return x.toFixed(d === undefined ? 3 : d); }

  /* ---------- AHP calculator ---------- */
  var PRESETS = {
    rakam: { names: ['Road', 'River', 'Forest', 'Slope', 'Elevation', 'Infrastructure', 'Settlement'],
      upper: [[1, 2, 1, 2, 1, 2], [1, 1, 2, 1, 1], [1, 1, 0.5, 1 / 3], [1, 2, 1], [1, 0.5], [2]] },
    dharan: { names: ['Forest', 'River', 'Settlement', 'Road', 'Slope', 'DEM'], weights: [0.15, 0.20, 0.15, 0.20, 0.20, 0.10] }
  };
  function parse(v) {
    v = String(v).trim();
    if (v.indexOf('/') > -1) { var p = v.split('/'); return +p[0] / +p[1]; }
    return +v;
  }
  function show(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    var inv = 1 / v;
    if (Math.abs(inv - Math.round(inv)) < 1e-9) return '1/' + Math.round(inv);
    return fmt(v, 3);
  }
  function eigen(A) {
    var n = A.length, w = [], i, j, k;
    for (i = 0; i < n; i++) w.push(1 / n);
    for (k = 0; k < 200; k++) {
      var nw = [], s = 0;
      for (i = 0; i < n; i++) { var r = 0; for (j = 0; j < n; j++) r += A[i][j] * w[j]; nw.push(r); s += r; }
      for (i = 0; i < n; i++) nw[i] /= s;
      w = nw;
    }
    var lam = 0;
    for (i = 0; i < n; i++) { var aw = 0; for (j = 0; j < n; j++) aw += A[i][j] * w[j]; lam += aw / w[i]; }
    return { w: w, lam: lam / n };
  }
  var calc = document.getElementById('ahp-calc');
  if (calc) {
    var tbl = calc.querySelector('.calc-matrix'), out = calc.querySelector('.calc-out'), names = [], A = [];
    function load(key) {
      var p = PRESETS[key], n = p.names.length, i, j;
      names = p.names; A = [];
      for (i = 0; i < n; i++) { A.push([]); for (j = 0; j < n; j++) A[i].push(1); }
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var v = p.upper ? p.upper[i][j - i - 1] : p.weights[i] / p.weights[j];
        A[i][j] = v; A[j][i] = 1 / v;
      }
      render();
    }
    function render() {
      var n = names.length, h = '<thead><tr><th scope="col">Criterion</th>', i, j;
      for (j = 0; j < n; j++) h += '<th scope="col" class="n">' + names[j] + '</th>';
      h += '</tr></thead><tbody>';
      for (i = 0; i < n; i++) {
        h += '<tr><th scope="row">' + names[i] + '</th>';
        for (j = 0; j < n; j++) {
          if (i === j) h += '<td class="n diag">1</td>';
          else if (j > i) h += '<td class="n"><input inputmode="decimal" aria-label="' + names[i] + ' compared with ' + names[j] + '" data-i="' + i + '" data-j="' + j + '" value="' + show(A[i][j]) + '"></td>';
          else h += '<td class="n recip" data-r="' + i + '-' + j + '">' + show(A[i][j]) + '</td>';
        }
        h += '</tr>';
      }
      tbl.innerHTML = h + '</tbody>';
      compute();
    }
    function compute() {
      var n = names.length, e = eigen(A), CI = (e.lam - n) / (n - 1), CR = CI / RI[n];
      var html = '<div class="res"><span>λmax <b>' + fmt(e.lam) + '</b></span><span>CI <b>' + fmt(CI) + '</b></span><span>RI <b>' + RI[n] + '</b></span><span>CR <b>' + fmt(CR) + '</b></span><span class="' + (CR < 0.1 ? 'ok">Consistent (CR &lt; 0.10)' : 'bad">Revise conflicting judgements (CR ≥ 0.10)') + '</span></div>';
      var max = Math.max.apply(null, e.w);
      e.w.forEach(function (w, i) { html += '<div class="wbar"><span>' + names[i] + '</span><i style="width:' + (w / max * 100) + '%"></i><span>' + fmt(w * 100, 1) + '%</span></div>'; });
      out.innerHTML = html;
    }
    tbl.addEventListener('change', function (e) {
      var t = e.target; if (!t.matches('input')) return;
      var v = parse(t.value), i = +t.getAttribute('data-i'), j = +t.getAttribute('data-j');
      if (!(v > 0) || !isFinite(v)) { t.value = show(A[i][j]); return; }
      A[i][j] = v; A[j][i] = 1 / v;
      tbl.querySelector('[data-r="' + j + '-' + i + '"]').textContent = show(1 / v);
      t.value = show(v);
      compute();
    });
    calc.querySelectorAll('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { load(b.getAttribute('data-preset')); }); });
    load('rakam');
  }

  /* ---------- Weighted overlay calculator (Dharan weights) ---------- */
  var wlc = document.getElementById('wlc-calc');
  if (wlc) {
    var C = [['Forest proximity', 0.15], ['River proximity', 0.20], ['Settlement proximity', 0.15], ['Road proximity', 0.20], ['Slope', 0.20], ['Elevation', 0.10]];
    var START = [5, 1, 5, 5, 5, 5], box = wlc.querySelector('.sliders'), res = wlc.querySelector('.calc-out'), mask = wlc.querySelector('.masked');
    box.innerHTML = C.map(function (c, k) {
      return '<label><span>' + c[0] + ' (' + c[1] * 100 + '%)</span><input type="range" min="1" max="5" step="1" value="' + START[k] + '" data-k="' + k + '"><output>' + START[k] + '</output></label>';
    }).join('');
    function update() {
      var s = 0, terms = [];
      box.querySelectorAll('input').forEach(function (inp) {
        var k = +inp.getAttribute('data-k'), v = +inp.value; inp.nextElementSibling.textContent = v;
        s += C[k][1] * v; terms.push(fmt(C[k][1], 2) + '(' + v + ')');
      });
      var line = '<p style="margin:0 0 6px">SI = ' + terms.join(' + ') + ' = <b>' + fmt(s, 2) + '</b></p>';
      res.innerHTML = line + (mask.checked
        ? '<p class="bad" style="margin:0">Excluded: masks are applied after the overlay, so this cell is removed whatever its score.</p>'
        : '<p style="margin:0" class="muted">Index on the 1–5 scale before masking.' + (terms.join() === START.map(function (v, k) { return fmt(C[k][1], 2) + '(' + v + ')'; }).join() ? ' In the Dharan model this riverbank example falls in the High class, which is why masks follow the overlay.' : '') + '</p>');
    }
    box.addEventListener('input', update); mask.addEventListener('change', update);
    wlc.querySelector('[data-reset]').addEventListener('click', function () {
      box.querySelectorAll('input').forEach(function (inp, k) { inp.value = START[k]; }); mask.checked = false; update();
    });
    update();
  }
})();
