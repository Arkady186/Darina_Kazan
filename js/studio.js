/* Примерочная: загрузка фото, автопоиск/ручная разметка ногтей, выбор дизайна, формы, длины. */
(function (global) {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ND = global.NailDesigns, SVGNS = 'http://www.w3.org/2000/svg';
  var MAXSIDE = 1400;

  var S = {
    fx: null, model: null, design: ND.byId('french'), shape: 0, len: 1, matte: 0,
    edit: false, split: false, sel: -1, ready: false
  };

  function lenLabel(l) { return l < 1.12 ? 'как на фото' : l < 1.45 ? 'средние' : l < 1.8 ? 'длинные' : 'XL'; }

  /* ---------- статус ---------- */
  var stT = 0;
  function status(txt, kind, ms) {
    var el = $('#status'); clearTimeout(stT);
    if (!txt) { el.classList.remove('on'); return; }
    el.innerHTML = (kind === 'busy' ? '<i class="spin"></i>' : kind === 'ok' ? '<i class="ok">✓</i>' : kind === 'warn' ? '<i class="warn">!</i>' : '') + '<span>' + txt + '</span>';
    el.className = 'status on ' + (kind || '');
    if (ms) stT = setTimeout(function () { el.classList.remove('on'); }, ms);
  }
  function toast(txt) {
    var t = $('#toast'); t.textContent = txt; t.classList.add('on');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  /* ---------- UI: дизайны и формы ---------- */
  function buildDesigns() {
    var box = $('#designs'); box.innerHTML = '';
    var groups = {};
    ND.DESIGNS.forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
    Object.keys(groups).forEach(function (g) {
      var h = document.createElement('div'); h.className = 'dgroup'; h.innerHTML = '<span class="dgroup-l">' + g + '</span>';
      var row = document.createElement('div'); row.className = 'drow';
      groups[g].forEach(function (d) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'dbtn' + (d === S.design ? ' on' : '');
        b.dataset.id = d.id; b.title = d.name;
        b.innerHTML = '<img alt="" width="48" height="78"><span>' + d.name + '</span>' + (d.work ? '<em>фото</em>' : '');
        b.addEventListener('click', function () { pick(d.id); });
        row.appendChild(b);
      });
      h.appendChild(row); box.appendChild(h);
    });
    refreshIcons();
  }
  function refreshIcons() {
    $$('.dbtn').forEach(function (b) { b.querySelector('img').src = ND.icon(ND.byId(b.dataset.id), S.shape, 0.75); });
  }
  function buildShapes() {
    var box = $('#shapes');
    ND.SHAPES.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn' + (s.id === S.shape ? ' on' : '');
      b.innerHTML = '<svg viewBox="0 0 40 64" aria-hidden="true"><path d="' + ND.shapePath(s.id, 20, 56, 20, 4) + '"/></svg><span>' + s.name + '</span>';
      b.addEventListener('click', function () { setShape(s.id); });
      box.appendChild(b);
    });
  }

  function pick(id, quiet) {
    var d = ND.byId(id); S.design = d;
    $$('.dbtn').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); });
    $('#curDesign').textContent = d.name;
    if (S.fx) S.fx.setDesign(d, true);
    updateChoice();
    if (!quiet) { var on = $('.dbtn.on'); if (on && on.scrollIntoView && window.innerWidth < 900) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
  }
  function setShape(s) {
    S.shape = s; $$('.sbtn').forEach(function (b, i) { b.classList.toggle('on', i === s); });
    $('#curShape').textContent = ND.SHAPES[s].name;
    if (S.fx) S.fx.setShape(s);
    refreshIcons(); updateChoice();
  }
  function setLen(l) {
    S.len = l; $('#len').value = l; $('#curLen').textContent = lenLabel(l);
    if (S.fx) S.fx.setLength(l); updateChoice();
  }
  function updateChoice() {
    var txt = S.design.name + ', форма «' + ND.SHAPES[S.shape].name.toLowerCase() + '», длина: ' + lenLabel(S.len) + (S.matte ? ', матовое' : ', глянец');
    S.choice = txt;
  }

  /* ---------- загрузка ---------- */
  function fitCanvas(img, w, h) {
    var k = Math.min(1, MAXSIDE / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function setStageAspect(w, h) {
    $('#editLayer').setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    fitStage();
  }
  function fitStage() {
    if (!S.model) return;
    var stage = $('#stage'), si = $('#stageIn');
    var maxW = stage.clientWidth, maxH = innerWidth < 860 ? Math.min(innerHeight * 0.68, 620) : Math.min(innerHeight * 0.76, 860);
    var k = Math.min(maxW / S.model.w, maxH / S.model.h);
    si.style.width = Math.round(S.model.w * k) + 'px'; si.style.height = Math.round(S.model.h * k) + 'px';
    if (S.edit) renderEdit();
  }
  function show(src, w, h, nails, isDemo, id) {
    S.model = { src: src, w: w, h: h, nails: nails, demo: isDemo, id: id };
    setStageAspect(w, h);
    S.fx.setImage(src, w, h, nails);
    S.fx.setShape(S.shape); S.fx.setLength(S.len); S.fx.setMatte(S.matte);
    S.fx.setDesign(null, false);
    $$('.demo').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); });
    if (nails.length) setTimeout(function () { S.fx.setDesign(S.design, true); }, 350);
    if (S.edit) renderEdit();
  }
  function loadDemo(i) {
    var m = global.NAIL_MODELS[i]; if (!m) return;
    exitEdit(true);
    var img = new Image();
    img.onload = function () {
      setLen(1);
      show(img, m.w, m.h, m.nails.map(function (n) { return { f: n.f, b: n.b.slice(), t: n.t.slice(), w: n.w }; }), true, m.id);
      status('Демо-фото: ' + m.title.toLowerCase() + '. Загрузите своё, чтобы примерить на себе', '', 3200);
    };
    img.src = m.src;
  }
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast('Нужен файл с фотографией'); return; }
    exitEdit(true);
    status('Открываю фото…', 'busy');
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var c = fitCanvas(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      setLen(1.2);
      show(c, c.width, c.height, [], false, 'user');
      document.getElementById('stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      autoDetect(c);
    };
    img.onerror = function () { status('Не получилось открыть это фото. Попробуйте JPG или PNG', 'warn', 4000); };
    img.src = url;
  }
  function autoDetect(c) {
    if (!global.HandDetect) { manualStart(); return; }
    var slow = setTimeout(function () { status('Загружаю нейросеть (только в первый раз)…', 'busy'); }, 700);
    status('Ищу ногти на фото…', 'busy');
    HandDetect.detect(c).then(function (nails) {
      clearTimeout(slow);
      if (!nails.length) { status('Руку не нашла автоматически: отметьте ногти вручную', 'warn', 5000); manualStart(); return; }
      S.model.nails = nails; S.fx.setNails(nails); S.fx.setDesign(null, false);
      setTimeout(function () { S.fx.setDesign(S.design, true); }, 120);
      status('Нашла ногтей: ' + nails.length + '. Если метки не на месте, нажмите «Поправить разметку»', 'ok', 5200);
    }).catch(function () {
      clearTimeout(slow);
      status('Автопоиск недоступен (нужен интернет): нажмите на каждый ноготь', 'warn', 6000);
      manualStart();
    });
  }
  function manualStart() { enterEdit(); }

  /* ---------- до/после ---------- */
  var splitX = 0.5;
  function setSplitMode(on) {
    S.split = on; $('#toggleSplit').classList.toggle('on', on);
    $('#splitLine').classList.toggle('on', on);
    applySplit();
  }
  function applySplit() {
    if (!S.fx) return;
    if (S.edit) { S.fx.setSplit(0); return; }
    S.fx.setSplit(S.split ? splitX : 1);
    $('#splitLine').style.left = (splitX * 100) + '%';
  }

  /* ---------- редактирование разметки ---------- */
  function enterEdit() {
    if (!S.model) return;
    S.edit = true; S.sel = -1;
    $('#stage').classList.add('editing'); $('#editNails').classList.add('on');
    applySplit(); renderEdit();
  }
  function exitEdit(silent) {
    if (!S.edit) return;
    S.edit = false; S.sel = -1;
    $('#stage').classList.remove('editing'); $('#editNails').classList.remove('on');
    $('#editLayer').innerHTML = '';
    if (S.model) {
      S.model.nails.forEach(function (n, i) { if (n.f == null) n.f = i % 5; });
      S.fx.setNails(S.model.nails);
      if (!silent && S.model.nails.length) { S.fx.setDesign(null, false); setTimeout(function () { S.fx.setDesign(S.design, true); }, 60); }
    }
    applySplit();
  }
  function unit() { var r = $('#editLayer').getBoundingClientRect(); return S.model ? S.model.w / Math.max(1, r.width) : 1; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e;
  }
  function renderEdit() {
    var svg = $('#editLayer'); svg.innerHTML = '';
    if (!S.edit || !S.model) return;
    var u = unit(), nails = S.model.nails;
    nails.forEach(function (n, i) {
      var dx = n.t[0] - n.b[0], dy = n.t[1] - n.b[1], L = Math.hypot(dx, dy) || 1;
      var ux = dx / L, uy = dy / L, px = -uy, py = ux;
      var pts = ND.outline(L, n.w, 0, 24).map(function (p) { return (n.b[0] + px * p[0] + ux * p[1]).toFixed(1) + ',' + (n.b[1] + py * p[0] + uy * p[1]).toFixed(1); }).join(' ');
      var g = el('g', { 'class': 'enail' + (i === S.sel ? ' sel' : '') }, svg);
      el('polygon', { points: pts, 'class': 'ebody', 'data-i': i, 'data-h': 'body', 'stroke-width': 1.6 * u }, g);
      el('line', { x1: n.b[0], y1: n.b[1], x2: n.t[0], y2: n.t[1], 'class': 'eaxis', 'stroke-width': 1 * u, 'stroke-dasharray': (4 * u) + ' ' + (4 * u) }, g);
      var wx = n.b[0] + ux * L * 0.5 + px * n.w / 2, wy = n.b[1] + uy * L * 0.5 + py * n.w / 2;
      el('circle', { cx: n.b[0], cy: n.b[1], r: 8 * u, 'class': 'eh eb', 'data-i': i, 'data-h': 'b', 'stroke-width': 2 * u }, g);
      el('circle', { cx: n.t[0], cy: n.t[1], r: 8 * u, 'class': 'eh et', 'data-i': i, 'data-h': 't', 'stroke-width': 2.5 * u }, g);
      el('rect', { x: wx - 6 * u, y: wy - 6 * u, width: 12 * u, height: 12 * u, transform: 'rotate(45 ' + wx + ' ' + wy + ')', 'class': 'eh ew', 'data-i': i, 'data-h': 'w', 'stroke-width': 2 * u }, g);
      /* увеличенные невидимые зоны для пальца */
      [['b', n.b[0], n.b[1]], ['t', n.t[0], n.t[1]], ['w', wx, wy]].forEach(function (h) {
        el('circle', { cx: h[1], cy: h[2], r: 20 * u, 'class': 'ehit', 'data-i': i, 'data-h': h[0] }, g);
      });
    });
    $('#delNail').disabled = S.sel < 0;
    $('#editHint').innerHTML = nails.length
      ? 'Тяните <b class="k1">●</b> основание и <b class="k2">○</b> кончик, <b class="k3">◆</b> — ширина. Нажмите на ноготь без метки, чтобы добавить.'
      : 'Нажмите на каждый ноготь на фото — появится метка. Потом подгоните точки.';
  }
  function toImg(e) {
    var r = $('#editLayer').getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * S.model.w, (e.clientY - r.top) / r.height * S.model.h];
  }
  function addNail(p) {
    var nails = S.model.nails; if (nails.length >= 10) { toast('Максимум 10 ногтей'); return; }
    var w, ux = 0, uy = -1;
    if (nails.length) {
      var ws = nails.map(function (n) { return n.w; }).sort(function (a, b) { return a - b; });
      w = ws[Math.floor(ws.length / 2)];
      var sx = 0, sy = 0;
      nails.forEach(function (n) { var dx = n.t[0] - n.b[0], dy = n.t[1] - n.b[1], l = Math.hypot(dx, dy) || 1; sx += dx / l; sy += dy / l; });
      var l2 = Math.hypot(sx, sy) || 1; ux = sx / l2; uy = sy / l2;
    } else w = Math.min(S.model.w, S.model.h) * 0.075;
    var L = w * 1.15;
    nails.push({ f: null, b: [p[0] - ux * L / 2, p[1] - uy * L / 2], t: [p[0] + ux * L / 2, p[1] + uy * L / 2], w: w });
    S.sel = nails.length - 1;
    renderEdit();
  }
  (function editEvents() {
    var svg = $('#editLayer'), drag = null;
    svg.addEventListener('pointerdown', function (e) {
      if (!S.edit) return;
      e.preventDefault();
      var t = e.target, i = t.getAttribute('data-i'), h = t.getAttribute('data-h'), p = toImg(e);
      if (i == null) { addNail(p); return; }
      i = +i; S.sel = i;
      var n = S.model.nails[i];
      drag = { i: i, h: h, p0: p, b0: n.b.slice(), t0: n.t.slice(), id: e.pointerId };
      svg.setPointerCapture(e.pointerId);
      renderEdit();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var p = toImg(e), n = S.model.nails[drag.i], dx = p[0] - drag.p0[0], dy = p[1] - drag.p0[1];
      if (drag.h === 'b') n.b = [drag.b0[0] + dx, drag.b0[1] + dy];
      else if (drag.h === 't') n.t = [drag.t0[0] + dx, drag.t0[1] + dy];
      else if (drag.h === 'body') { n.b = [drag.b0[0] + dx, drag.b0[1] + dy]; n.t = [drag.t0[0] + dx, drag.t0[1] + dy]; }
      else if (drag.h === 'w') {
        var ax = n.t[0] - n.b[0], ay = n.t[1] - n.b[1], L = Math.hypot(ax, ay) || 1;
        var d = Math.abs((p[0] - n.b[0]) * (-ay / L) + (p[1] - n.b[1]) * (ax / L));
        n.w = Math.max(6, d * 2);
      }
      renderEdit();
    });
    function up(e) { if (drag && e.pointerId === drag.id) drag = null; }
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    window.addEventListener('resize', fitStage);
  })();

  /* ---------- свет и до/после ---------- */
  function stageEvents() {
    var si = $('#stageIn'), line = $('#splitLine'), dragS = false;
    si.addEventListener('pointermove', function (e) {
      if (S.edit) return;
      var r = si.getBoundingClientRect();
      S.fx.setLight(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      if (dragS) { splitX = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)); applySplit(); }
    });
    line.addEventListener('pointerdown', function (e) { dragS = true; line.setPointerCapture(e.pointerId); e.stopPropagation(); });
    line.addEventListener('pointermove', function (e) {
      if (!dragS) return; var r = si.getBoundingClientRect();
      splitX = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)); applySplit();
    });
    line.addEventListener('pointerup', function () { dragS = false; });
    line.addEventListener('pointercancel', function () { dragS = false; });

    var stage = $('#stage');
    ['dragenter', 'dragover'].forEach(function (t) { stage.addEventListener(t, function (e) { e.preventDefault(); stage.classList.add('dragging'); }); });
    ['dragleave', 'drop'].forEach(function (t) { stage.addEventListener(t, function (e) { e.preventDefault(); stage.classList.remove('dragging'); }); });
    stage.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });
  }

  /* ---------- сохранить ---------- */
  function download() {
    if (!S.fx || !S.model) return;
    var was = S.split; if (was) S.fx.setSplit(1);
    var brand = (global.CONFIG && CONFIG.brand) || 'Nail Studio';
    var c = S.fx.snapshot(brand + ' · ' + S.design.name);
    if (was) applySplit();
    c.toBlob(function (b) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(b);
      a.download = 'primerka-' + S.design.id + '.png'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('Фото сохранено');
    }, 'image/png');
  }

  function init() {
    var cv = $('#studioFx');
    try { S.fx = new NailFX(cv); }
    catch (e) { $('#stage').classList.add('nogl'); status('Ваш браузер не поддерживает WebGL — примерка недоступна', 'warn'); return; }
    S.fx.matte = 0;
    buildDesigns(); buildShapes(); stageEvents();
    /* демо */
    var demos = $('#demos');
    (global.NAIL_MODELS || []).forEach(function (m, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'demo'; b.dataset.id = m.id; b.title = m.title;
      b.style.backgroundImage = 'url(' + m.src + ')';
      b.addEventListener('click', function () { loadDemo(i); });
      demos.appendChild(b);
    });
    $('#file').addEventListener('change', function (e) { loadFile(e.target.files[0]); e.target.value = ''; });
    $('#cam').addEventListener('change', function (e) { loadFile(e.target.files[0]); e.target.value = ''; });
    $('#len').addEventListener('input', function (e) { setLen(+e.target.value); });
    $$('#finish button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.matte = +b.dataset.v; $$('#finish button').forEach(function (x) { x.classList.toggle('on', x === b); });
        S.fx.setMatte(S.matte); updateChoice();
      });
    });
    $('#toggleSplit').addEventListener('click', function () { if (S.edit) exitEdit(); setSplitMode(!S.split); });
    $('#editNails').addEventListener('click', function () { if (S.edit) exitEdit(); else enterEdit(); });
    $('#editDone').addEventListener('click', function () { exitEdit(); });
    $('#delNail').addEventListener('click', function () {
      if (S.sel < 0) return; S.model.nails.splice(S.sel, 1); S.sel = -1; renderEdit();
    });
    $('#download').addEventListener('click', download);
    $('#bookThis').addEventListener('click', function () {
      var ch = $('#choice'); ch.hidden = false; $('#choiceTxt').textContent = S.choice; ch.classList.add('in');
      global.dispatchEvent(new CustomEvent('nail-choice', { detail: S.choice }));
    });
    pick(S.design.id, true); setShape(0); setLen(1); updateChoice();
    loadDemo(1);
    S.ready = true;
    /* рендерим только когда секция видна */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { S.fx.run(e.isIntersecting); }); }, { rootMargin: '200px' }).observe($('#stage'));
    }
  }

  global.Studio = {
    init: init, pick: function (id) { pick(id); }, upload: function () { $('#file').click(); },
    state: S, loadDemo: loadDemo
  };
})(window);
