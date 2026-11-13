(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* ---------- theme switcher (light is the default) ---------- */
  var toggle = $('.theme-toggle');
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function syncToggle() {
    if (!toggle) return;
    var dark = currentTheme() === 'dark';
    toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.title = dark ? 'Light theme' : 'Dark theme';
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0D1B26' : '#FFFFFF');
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable: theme lasts for this page only */ }
      syncToggle();
    });
  }
  syncToggle();

  /* ---------- mobile navigation ---------- */
  var burger = $('.burger'), menu = $('.menu');
  function closeMenu() { if (!menu) return; menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); burger.focus(); } });
  }

  /* ---------- hero map plate ---------- */
  var plate = $('.plate');
  if (plate) {
    var slides = $$('.slide', plate), dots = $$('.pager [data-i]', plate), cap = $('.hero-cap', plate), pp = $('.pp', plate);
    var idx = 0, timer = null, playing = !reduce;
    function show(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === idx); s.setAttribute('aria-hidden', k === idx ? 'false' : 'true'); });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', k === idx ? 'true' : 'false'); });
      if (cap) {
        var s = slides[idx];
        cap.innerHTML = '<b>' + s.getAttribute('data-title') + '</b><span>' + s.getAttribute('data-sub') + '</span>';
      }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() { stop(); timer = setInterval(function () { show(idx + 1); }, 7000); }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.getAttribute('data-i')); if (playing) start(); }); });
    if (pp) {
      var label = function () { pp.textContent = playing ? 'Pause' : 'Play'; pp.setAttribute('aria-label', playing ? 'Pause map slideshow' : 'Play map slideshow'); };
      label();
      pp.addEventListener('click', function () { playing = !playing; label(); if (playing) start(); else stop(); });
    }
    show(0);
    if (playing) start();
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (playing) start(); });
  }

  /* ---------- lightbox ---------- */
  var dlg = document.createElement('dialog');
  dlg.className = 'lb';
  dlg.setAttribute('aria-label', 'Enlarged map');
  dlg.innerHTML = '<button class="close" type="button">Close</button><figure><img alt=""><figcaption></figcaption></figure>';
  document.body.appendChild(dlg);
  var lbImg = $('img', dlg), lbCap = $('figcaption', dlg), lastFocus = null;
  function openLb(src, alt, capHtml) {
    lbImg.src = src; lbImg.alt = alt || ''; lbCap.innerHTML = capHtml || '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeLb() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  $('.close', dlg).addEventListener('click', closeLb);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeLb(); });
  dlg.addEventListener('close', function () { lbImg.removeAttribute('src'); if (lastFocus) lastFocus.focus(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-full]');
    if (!b || !b.getAttribute('data-full')) return;
    lastFocus = b;
    var fig = b.closest('figure'), capEl = fig ? $('figcaption', fig) : null, im = $('img', b);
    openLb(b.getAttribute('data-full'), im ? im.alt : '', capEl ? capEl.innerHTML : '');
  });

  /* ---------- gallery filters ---------- */
  $$('[data-filter-group]').forEach(function (g) {
    var btns = $$('button', g), host = document.getElementById(g.getAttribute('data-filter-group'));
    var items = host ? $$('.sheet[data-cat]', host) : [];
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        var c = b.getAttribute('data-c');
        items.forEach(function (it) { it.hidden = !(c === 'all' || it.getAttribute('data-cat').split(' ').indexOf(c) > -1); });
      });
    });
  });

  /* ---------- before/after compare ---------- */
  $$('.cmp').forEach(function (c) {
    var r = $('input', c), top = $('.top', c), h = $('.handle', c);
    function set(v) { top.style.clipPath = 'inset(0 ' + (100 - v) + '% 0 0)'; h.style.left = v + '%'; r.setAttribute('aria-valuetext', v + '% showing the left map'); }
    r.addEventListener('input', function () { set(+r.value); });
    set(+r.value);
  });

  /* ---------- land-cover timeline viewer ----------
     Class areas come from the model output tables embedded in each page as JSON. */
  $$('.tv').forEach(function (tv) {
    var data = JSON.parse($('script[type="application/json"]', tv).textContent);
    var yearsEl = $('.tv-years', tv), img = $('.tv-img', tv), title = $('.tv-title', tv), status = $('.tv-status', tv),
        bar = $('.bar', tv), list = $('.legend-list', tv), cap = $('.tv-cap', tv), full = $('.tv-full', tv);
    data.classes.forEach(function (c) {
      var s = document.createElement('span'); s.style.background = c.color; s.setAttribute('data-k', c.key); bar.appendChild(s);
      var li = document.createElement('li');
      li.innerHTML = '<i style="background:' + c.color + '"></i><span>' + c.name + '</span><span class="v" data-k="' + c.key + '"></span>';
      list.appendChild(li);
    });
    function fmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 1 }); }
    function sel(i) {
      var s = data.states[i], total = 0;
      data.classes.forEach(function (c) { total += s.ha[c.key]; });
      $$('button', yearsEl).forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      img.src = s.src; img.alt = data.alt + ' ' + s.label.toLowerCase();
      title.textContent = s.label; status.textContent = s.status;
      full.setAttribute('data-full', s.full);
      full.setAttribute('aria-label', 'Enlarge map: ' + s.label);
      cap.innerHTML = '<b>' + s.label + '.</b> ' + s.status + '. ' + data.note;
      data.classes.forEach(function (c) {
        var pct = s.ha[c.key] / total * 100;
        $('span[data-k="' + c.key + '"]', bar).style.width = pct + '%';
        $('.v[data-k="' + c.key + '"]', list).innerHTML = fmt(s.ha[c.key]) + ' ha<span class="p">' + pct.toFixed(1) + '%</span>';
      });
    }
    data.states.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.innerHTML = s.short + '<small>' + s.tag + '</small>';
      b.addEventListener('click', function () { sel(i); });
      yearsEl.appendChild(b);
    });
    sel(0);
  });

  /* ---------- GeoBIM layer toggles ---------- */
  $$('.layer-toggles input').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var el = document.getElementById(cb.getAttribute('data-layer'));
      if (el) el.style.opacity = cb.checked ? 1 : 0.08;
    });
  });

  /* ---------- contact form: accessible client-side validation ----------
     Netlify Forms handles delivery and redirects to thanks.html. */
  var form = $('form[name="contact"]');
  if (form) {
    var status = $('.form-status', form);
    var fields = $$('[data-validate]', form);
    function check(field) {
      var input = $('input,textarea', field), ok = input.checkValidity();
      if (ok && input.name === 'message' && input.value.trim().length < 20) ok = false;
      field.classList.toggle('invalid', !ok);
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      return ok;
    }
    fields.forEach(function (f) {
      var input = $('input,textarea', f);
      input.addEventListener('blur', function () { if (input.value) check(f); });
      input.addEventListener('input', function () { if (f.classList.contains('invalid')) check(f); });
    });
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', function (e) {
      var firstBad = null;
      fields.forEach(function (f) { if (!check(f) && !firstBad) firstBad = f; });
      if (firstBad) {
        e.preventDefault();
        status.className = 'form-status error show';
        status.textContent = 'Check the highlighted fields, then send the message again.';
        $('input,textarea', firstBad).focus();
        return;
      }
      var btn = $('button[type="submit"]', form);
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    });
    if (!navigator.onLine) {
      status.className = 'form-status error show';
      status.textContent = 'You appear to be offline. The form needs a connection to send; you can also email sanzay41@gmail.com directly.';
    }
  }

  /* Restore the submit button if the visitor returns with the back button (page restored from cache). */
  window.addEventListener('pageshow', function (e) {
    var btn = $('form[name="contact"] button[type="submit"]');
    if (e.persisted && btn) { btn.disabled = false; btn.textContent = 'Send message'; }
  });

  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
})();
