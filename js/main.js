/* Страница: контакты из CONFIG, анимации появления, живое фото в первом экране,
   3D-декор, галерея, наклон карточек, видео. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var CFG = window.CONFIG || {};
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- контакты ---------- */
  $$('[data-cfg]').forEach(function (el) { var v = CFG[el.getAttribute('data-cfg')]; if (v) el.textContent = v; });
  function waLink(text) {
    var num = String(CFG.whatsapp || '').replace(/\D/g, '');
    return num ? 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '') : '';
  }
  var links = { telegram: CFG.telegram, whatsapp: waLink('Здравствуйте! Хочу записаться на маникюр.'), instagram: CFG.instagram, phone: CFG.phone ? 'tel:' + CFG.phone : '' };
  $$('[data-link]').forEach(function (a) {
    var v = links[a.getAttribute('data-link')];
    if (v) { a.href = v; if (/^http/.test(v)) { a.target = '_blank'; a.rel = 'noopener'; } }
    else a.addEventListener('click', function (e) { e.preventDefault(); showToast('Ссылка ещё не добавлена — впишите её в js/config.js'); });
  });
  $('#yr').textContent = new Date().getFullYear();
  window.addEventListener('nail-choice', function (e) {
    var wa = $('[data-link="whatsapp"]');
    if (CFG.whatsapp) wa.href = waLink('Здравствуйте! Хочу записаться. Примерила на сайте: ' + e.detail + '.');
  });
  $('#copyChoice').addEventListener('click', function () {
    var t = 'Хочу записаться. Примерила на сайте: ' + $('#choiceTxt').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { showToast('Скопировано — вставьте в сообщение'); }, function () { showToast(t); });
  });
  function showToast(txt) { var t = $('#toast'); t.textContent = txt; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  /* ---------- заголовок по словам ---------- */
  var h1 = $('#h1'), wi = 0;
  (function split(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/([ \t\n]+)/).forEach(function (part) {
          if (!part) return;
          if (/^[ \t\n]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var s = document.createElement('span'); s.style.setProperty('--i', wi++); s.textContent = part; w.appendChild(s); frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) split(n);
    });
  })(h1);

  /* ---------- появление ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;
  $$('.rv').forEach(function (el) { if (!el.closest('.hero')) { if (io) io.observe(el); else el.classList.add('in'); } });

  /* ---------- навигация ---------- */
  var nav = $('#nav');
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var t = $(id); if (!t) return; e.preventDefault();
      if (a.hasAttribute('data-upload') && window.Studio) Studio.upload();
      window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (id === '#studio' ? 70 : 0), behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- примерочная ---------- */
  if (window.Studio) Studio.init();
  $$('[data-try]').forEach(function (b) {
    b.addEventListener('click', function () {
      Studio.pick(b.dataset.try);
      var t = $('#studio'); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
    });
  });

  /* ---------- живое фото в первом экране ---------- */
  var hero = null, heroSeq = ['red', 'cat', 'chrome', 'art', 'lavbow', 'nude', 'black', 'ombre', 'glitter', 'bordo'], heroI = -1;
  (function initHero() {
    var m = (window.NAIL_MODELS || [])[0];
    if (!m) return;
    try { hero = new NailFX($('#heroFx')); } catch (e) { document.documentElement.classList.add('no-webgl'); return; }
    var img = new Image();
    img.onload = function () {
      hero.setImage(img, m.w, m.h, m.nails);
      $('#heroFrame').classList.add('live');
    };
    img.src = m.src;
  })();
  function heroNext() {
    if (!hero || document.hidden) return;
    heroI = (heroI + 1) % heroSeq.length;
    var d = NailDesigns.byId(heroSeq[heroI]);
    hero.setDesign(d, true);
    var nm = $('#heroName'); nm.classList.add('swap');
    setTimeout(function () { nm.textContent = d.name; nm.classList.remove('swap'); }, 250);
  }
  var heroTimer = null;
  function heroPlay(on) {
    if (!hero) return;
    hero.run(on);
    clearInterval(heroTimer);
    if (on) heroTimer = setInterval(heroNext, 3400);
  }

  /* ---------- 3D-декор ---------- */
  var decor = null;
  try { if (window.Decor && !reduce) decor = Decor.init($('#decor'), $('#heroFrame')); } catch (e) { decor = null; }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { heroPlay(e.isIntersecting); if (decor) decor.run(e.isIntersecting); });
    }).observe($('#hero'));
  }

  window.addEventListener('pointermove', function (e) {
    var nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
    if (decor) decor.pointer(nx, ny);
    if (hero && e.pointerType !== 'touch') {
      var r = $('#heroFrame').getBoundingClientRect();
      if (r.bottom > 0) hero.setLight(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.4, 1.4), clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.2, 1.2));
    }
  }, { passive: true });

  /* ---------- горизонтальная галерея ---------- */
  var works = $('#works'), track = $('#track'), wprog = $('#wprog');
  function dist() { return Math.max(0, track.scrollWidth - innerWidth); }
  function setupWorks() {
    track.style.transform = '';
    if (innerWidth >= 900) { works.classList.add('pinned'); works.style.height = (dist() + innerHeight) + 'px'; }
    else { works.classList.remove('pinned'); works.style.height = ''; }
    onScroll();
  }
  function onScroll() {
    nav.classList.toggle('stuck', window.scrollY > 30);
    if (works.classList.contains('pinned')) {
      var d = dist(), p = clamp(-works.getBoundingClientRect().top / Math.max(1, d), 0, 1);
      track.style.transform = 'translate3d(' + (-p * d).toFixed(1) + 'px,0,0)';
      wprog.style.width = (p * 100).toFixed(1) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', setupWorks);
  window.addEventListener('load', setupWorks);
  setupWorks();

  /* ---------- 3D-наклон ---------- */
  $$('.tilt').forEach(function (el) {
    if (!finePointer) return;
    var max = el.classList.contains('scard') ? 6 : el.classList.contains('frame') ? 7 : el.classList.contains('phone') ? 12 : 10;
    var target = el.classList.contains('card') ? $('.card-in', el) : el, raf = 0;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.remove('rest'); cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        target.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
        target.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
        $$('.glare', el).forEach(function (g) { g.style.setProperty('--gx', (x * 100) + '%'); g.style.setProperty('--gy', (y * 100) + '%'); });
      });
    });
    el.addEventListener('pointerleave', function () {
      el.classList.add('rest');
      target.style.setProperty('--ry', el.classList.contains('phone') ? '-8deg' : el.classList.contains('frame') ? '-6deg' : '0deg');
      target.style.setProperty('--rx', el.classList.contains('frame') ? '2deg' : '0deg');
    });
  });

  /* ---------- видео ---------- */
  var vid = $('#vid'), vt = $('#vidToggle'), manual = false;
  if (vid && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (manual) return;
        if (e.isIntersecting) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); } else vid.pause();
      });
    }, { threshold: 0.35 }).observe(vid);
  }
  vt.addEventListener('click', function () { manual = true; if (vid.paused) vid.play(); else vid.pause(); });
  vid.addEventListener('pause', function () { vt.classList.add('paused'); });
  vid.addEventListener('play', function () { vt.classList.remove('paused'); });

  /* ---------- старт ---------- */
  var bar = $('#loaderBar'), prog = 0;
  var pt = setInterval(function () { prog = Math.min(92, prog + (100 - prog) * 0.12); bar.style.width = prog + '%'; }, 80);
  function start() {
    var l = $('#loader'); if (l.classList.contains('done')) return;
    clearInterval(pt); bar.style.width = '100%';
    setTimeout(function () {
      l.classList.add('done');
      $$('.hero .rv').forEach(function (el) { el.classList.add('in'); });
      h1.classList.add('in');
      setTimeout(heroNext, 1300);
    }, 250);
  }
  if (document.readyState === 'complete') setTimeout(start, 300); else window.addEventListener('load', function () { setTimeout(start, 300); });
  setTimeout(start, 4000);
})();
