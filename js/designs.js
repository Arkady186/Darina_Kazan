/* Каталог дизайнов, формы ногтей и атлас текстур (рисуется в canvas). */
(function (global) {
  'use strict';

  var CW = 256, CH = 512, COLS = 8, ROWS = 4; // атлас 2048 x 2048

  /* ---------- формы ---------- */
  var SHAPES = [
    { id: 0, name: 'Квадрат' },
    { id: 1, name: 'Овал' },
    { id: 2, name: 'Миндаль' },
    { id: 3, name: 'Балерина' },
    { id: 4, name: 'Стилет' }
  ];

  /* полуширина ногтя на расстоянии y от кутикулы (та же функция в шейдере) */
  function halfW(y, L, W, shape) {
    if (y < 0 || y > L) return 0;
    var h = W / 2, c = W * 0.32, t, a, r;
    if (y < c) { t = (c - y) / c; return h * Math.sqrt(Math.max(1 - t * t, 0)); }
    var hb = h * (1 - 0.04 * Math.min(y / L, 1));
    if (shape === 0) {
      r = W * 0.14; if (y > L - r) { t = (y - (L - r)) / r; return hb - r + r * Math.sqrt(Math.max(1 - t * t, 0)); } return hb;
    } else if (shape === 1) {
      a = Math.min(W * 0.55, L - c); if (y > L - a) { t = (y - (L - a)) / a; return hb * Math.sqrt(Math.max(1 - t * t, 0)); } return hb;
    } else if (shape === 2) {
      a = Math.min(W * 1.15, (L - c) * 0.85); if (y > L - a) { t = (y - (L - a)) / a; return hb * Math.pow(Math.max(1 - Math.pow(t, 1.8), 0), 0.75); } return hb;
    } else if (shape === 3) {
      a = Math.min(W * 1.25, (L - c) * 0.8);
      if (y > L - a) {
        t = (y - (L - a)) / a; var w2 = hb * (1 - 0.42 * t); r = W * 0.07;
        if (y > L - r) { var t2 = (y - (L - r)) / r; w2 = w2 - r + r * Math.sqrt(Math.max(1 - t2 * t2, 0)); }
        return w2;
      }
      return hb;
    }
    a = Math.min(W * 2.0, (L - c) * 0.92); if (y > L - a) { t = (y - (L - a)) / a; return hb * Math.pow(Math.max(1 - t, 0), 0.8); } return hb;
  }

  /* контур ногтя в локальных координатах: x поперёк, y вдоль (0 = кутикула) */
  function outline(L, W, shape, n) {
    n = n || 48; var pts = [], i, y;
    for (i = 0; i <= n; i++) { y = L * i / n; pts.push([halfW(y, L, W, shape), y]); }
    for (i = n; i >= 0; i--) { y = L * i / n; pts.push([-halfW(y, L, W, shape), y]); }
    return pts;
  }

  /* ---------- рисование ячеек ---------- */
  function vg(ctx, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, CH);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g; ctx.fillRect(-8, -8, CW + 16, CH + 16);
  }
  function soft(ctx, x, y, r, c) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-8, -8, CW + 16, CH + 16);
  }
  function starPath(ctx, x, y, R, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (rot || 0) + i * Math.PI / 5, r = i % 2 ? R * 0.42 : R;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function rhinestone(ctx, x, y, r) {
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dfe4ee'); g.addColorStop(0.8, '#8c93a3'); g.addColorStop(1, '#4b4f5a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.22, 0, 7); ctx.fill();
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    for (var i = 0; i <= 64; i++) {
      var t = i / 64 * Math.PI * 2;
      var hx = 16 * Math.pow(Math.sin(t), 3), hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      ctx[i ? 'lineTo' : 'moveTo'](x + hx * s / 17, y + hy * s / 17);
    }
    ctx.closePath();
  }
  function heart3d(ctx, x, y, s, c0, c1) {
    heartPath(ctx, x, y, s);
    var g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.35, s * 0.1, x, y, s * 1.1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.save(); ctx.shadowColor = 'rgba(80,10,30,0.45)'; ctx.shadowBlur = s * 0.35; ctx.shadowOffsetY = s * 0.12;
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(x - s * 0.42, y - s * 0.32, s * 0.2, s * 0.11, -0.6, 0, 7); ctx.fill();
  }
  function bow(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = 'rgba(60,40,90,0.35)'; ctx.shadowBlur = s * 0.25; ctx.shadowOffsetY = s * 0.1;
    function loop(dir) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(dir * s * 0.55, -s * 0.75, dir * s * 1.25, -s * 0.55, dir * s * 1.05, 0);
      ctx.bezierCurveTo(dir * s * 1.25, s * 0.55, dir * s * 0.55, s * 0.6, 0, 0);
      var g = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ddd8ea');
      ctx.fillStyle = g; ctx.fill();
    }
    loop(-1); loop(1);
    ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.1); ctx.lineTo(-s * 0.55, s * 1.25); ctx.lineTo(-s * 0.25, s * 1.15); ctx.lineTo(0, s * 0.2); ctx.closePath();
    ctx.moveTo(s * 0.12, s * 0.1); ctx.lineTo(s * 0.5, s * 1.3); ctx.lineTo(s * 0.2, s * 1.18); ctx.lineTo(0, s * 0.2); ctx.closePath();
    ctx.fillStyle = '#efecf6'; ctx.fill();
    ctx.shadowColor = 'transparent';
    var k = ctx.createRadialGradient(-s * 0.06, -s * 0.06, 0, 0, 0, s * 0.3);
    k.addColorStop(0, '#ffffff'); k.addColorStop(1, '#d5cfe4');
    ctx.fillStyle = k; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.24, s * 0.28, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(150,135,185,0.45)'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.05); ctx.quadraticCurveTo(-s * 0.6, -s * 0.2, -s * 0.85, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.05); ctx.quadraticCurveTo(s * 0.6, -s * 0.2, s * 0.85, 0); ctx.stroke();
    ctx.restore();
  }
  function frenchTip(ctx, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(-8, CH * 0.6); ctx.quadraticCurveTo(CW / 2, CH * 0.84, CW + 8, CH * 0.6);
    ctx.lineTo(CW + 8, CH + 8); ctx.lineTo(-8, CH + 8); ctx.closePath(); ctx.fill();
  }
  function nude(ctx) { vg(ctx, [[0, '#f0c9c3'], [0.4, '#ecbdb8'], [1, '#efc3bd']]); soft(ctx, 90, 200, 240, 'rgba(255,255,255,0.10)'); }

  var CELLS = [
    /* 0 нюд */ nude,
    /* 1 молочный */ function (c) { vg(c, [[0, '#f4e6e1'], [0.35, '#f6eeea'], [1, '#f3ebe6']]); },
    /* 2 пудровый */ function (c) { vg(c, [[0, '#f6cdd3'], [0.5, '#f0b4c0'], [1, '#eeaebc']]); },
    /* 3 красный */ function (c) { vg(c, [[0, '#9a0b18'], [0.45, '#aa0f1d'], [1, '#8e0915']]); },
    /* 4 бордо */ function (c) { vg(c, [[0, '#5a0a1b'], [0.5, '#6d0f22'], [1, '#4c0816']]); },
    /* 5 чёрный */ function (c) { vg(c, [[0, '#1a161c'], [1, '#0e0c10']]); },
    /* 6 лаванда */ function (c) { vg(c, [[0, '#d8cfec'], [0.45, '#d2c7ea'], [1, '#cbbfe6']]); soft(c, 100, 180, 240, 'rgba(255,255,255,0.16)'); },
    /* 7 мокко */ function (c) { vg(c, [[0, '#7c5747'], [0.5, '#8b6352'], [1, '#6c4a3c']]); },
    /* 8 френч */ function (c) { vg(c, [[0, '#f2cbc5'], [0.6, '#f0c3bd'], [1, '#f0c3bd']]); frenchTip(c, '#fcf9f6'); },
    /* 9 чёрный френч */ function (c) { vg(c, [[0, '#f2cbc5'], [0.6, '#efc1bb'], [1, '#efc1bb']]); frenchTip(c, '#141116'); },
    /* 10 омбре */ function (c) { vg(c, [[0, '#f1bcc3'], [0.35, '#f3c9cc'], [0.75, '#fbf1ee'], [1, '#fffaf7']]); },
    /* 11 жемчужный хром */ function (c) { vg(c, [[0, '#efe3e3'], [0.5, '#f4ecea'], [1, '#ece2e2']]); },
    /* 12 кошачий глаз */ function (c) { vg(c, [[0, '#2a1230'], [0.5, '#3a1840'], [1, '#22102a']]); },
    /* 13 блёстки */ function (c) {
      vg(c, [[0, '#ead6c9'], [1, '#d9bfae']]);
      for (var i = 0; i < 260; i++) {
        var x = Math.random() * CW, y = Math.random() * CH, r = Math.random() * 2.4 + 0.6;
        c.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,220,0.9)' : 'rgba(190,150,120,0.8)';
        c.fillRect(x, y, r, r);
      }
    },
    /* 14 арт: нюд + звёзды + стразы */ function (c) {
      nude(c);
      starPath(c, 86, 150, 40, 0.1); c.fillStyle = '#121014'; c.fill();
      starPath(c, 178, 290, 30, -0.2); c.fill();
      starPath(c, 92, 410, 24, 0.3); c.fill();
      rhinestone(c, 190, 120, 14); rhinestone(c, 60, 300, 11); rhinestone(c, 200, 420, 12);
    },
    /* 15 арт: чёрный + розовая молния */ function (c) {
      vg(c, [[0, '#17121a'], [1, '#0d0b0f']]);
      c.lineJoin = 'miter'; c.strokeStyle = '#f4bccb'; c.lineWidth = 30;
      c.beginPath(); c.moveTo(210, -10); c.lineTo(70, 200); c.lineTo(182, 320); c.lineTo(66, 530); c.stroke();
      c.strokeStyle = 'rgba(244,188,203,0.55)'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(150, -10); c.lineTo(26, 200); c.lineTo(128, 320); c.lineTo(20, 530); c.stroke();
      rhinestone(c, 200, 120, 13); rhinestone(c, 56, 420, 12);
    },
    /* 16 арт: розовый + 3D-сердце */ function (c) {
      vg(c, [[0, '#f0c3c8'], [1, '#e9b1ba']]);
      heart3d(c, 128, 250, 74, '#ffd3df', '#ea6f92');
      c.fillStyle = 'rgba(255,255,255,0.92)';
      [[54, 400, 8], [84, 440, 6], [42, 456, 4.5], [206, 110, 6], [214, 150, 4]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); });
    },
    /* 17 арт: чёрный + розовая молния (зеркально) */ function (c) {
      vg(c, [[0, '#17121a'], [1, '#0d0b0f']]);
      c.lineJoin = 'miter'; c.strokeStyle = '#f4bccb'; c.lineWidth = 30;
      c.beginPath(); c.moveTo(46, -10); c.lineTo(186, 200); c.lineTo(74, 320); c.lineTo(190, 530); c.stroke();
      rhinestone(c, 60, 110, 13); rhinestone(c, 200, 300, 12);
    },
    /* 18 арт: нюд + звёзды */ function (c) {
      nude(c);
      starPath(c, 170, 150, 34, -0.1); c.fillStyle = '#121014'; c.fill();
      starPath(c, 80, 300, 30, 0.2); c.fill();
      rhinestone(c, 70, 140, 12); rhinestone(c, 190, 360, 14); rhinestone(c, 120, 440, 10);
    },
    /* 19 лаванда + бантик */ function (c) {
      vg(c, [[0, '#d8cfec'], [0.45, '#d2c7ea'], [1, '#cbbfe6']]); soft(c, 100, 180, 240, 'rgba(255,255,255,0.16)');
      bow(c, 128, 200, 92);
    },
    /* 20 красный + сердце */ function (c) {
      vg(c, [[0, '#a90d1b'], [0.45, '#b81320'], [1, '#9c0b18']]);
      heart3d(c, 128, 240, 60, '#ffffff', '#f2c6cf');
    }
  ];

  /* fx: [хром, кошачий глаз, блёстки], cat: цвет блика кошачьего глаза */
  var DESIGNS = [
    { id: 'french', name: 'Френч', group: 'Из портфолио', cells: [8], work: 5 },
    { id: 'nude', name: 'Нюд', group: 'Из портфолио', cells: [0], work: 1 },
    { id: 'red', name: 'Красный глянец', group: 'Из портфолио', cells: [3], work: 3 },
    { id: 'lavbow', name: 'Лаванда с бантиком', group: 'Из портфолио', cells: [6, 19, 6, 6, 6], work: 4 },
    { id: 'art', name: 'Арт-дизайн', group: 'Из портфолио', cells: [14, 15, 16, 17, 18], work: 2 },
    { id: 'milk', name: 'Молочный', group: 'Однотон', cells: [1] },
    { id: 'powder', name: 'Пудровый', group: 'Однотон', cells: [2] },
    { id: 'bordo', name: 'Бордо', group: 'Однотон', cells: [4] },
    { id: 'black', name: 'Чёрный', group: 'Однотон', cells: [5] },
    { id: 'lav', name: 'Лаванда', group: 'Однотон', cells: [6] },
    { id: 'mocha', name: 'Мокко', group: 'Однотон', cells: [7] },
    { id: 'bfrench', name: 'Чёрный френч', group: 'Френч и омбре', cells: [9] },
    { id: 'ombre', name: 'Омбре', group: 'Френч и омбре', cells: [10] },
    { id: 'chrome', name: 'Жемчужный хром', group: 'Эффекты', cells: [11], fx: [0.85, 0, 0] },
    { id: 'cat', name: 'Кошачий глаз', group: 'Эффекты', cells: [12], fx: [0, 1, 0], cat: [0.98, 0.78, 0.9] },
    { id: 'glitter', name: 'Блёстки', group: 'Эффекты', cells: [13], fx: [0, 0, 1] },
    { id: 'redheart', name: 'Красный с сердцем', group: 'Эффекты', cells: [3, 3, 20, 3, 3] }
  ];
  DESIGNS.forEach(function (d) { d.fx = d.fx || [0, 0, 0]; d.cat = d.cat || [0, 0, 0]; });

  function byId(id) { for (var i = 0; i < DESIGNS.length; i++) if (DESIGNS[i].id === id) return DESIGNS[i]; return DESIGNS[0]; }
  /* ячейка атласа для пальца f (0 большой … 4 мизинец) */
  function cellFor(d, f) { return d.cells.length === 1 ? d.cells[0] : d.cells[((f % 5) + 5) % 5]; }

  var atlas = null;
  function buildAtlas() {
    if (atlas) return atlas;
    atlas = document.createElement('canvas'); atlas.width = CW * COLS; atlas.height = CH * ROWS;
    var ctx = atlas.getContext('2d');
    CELLS.forEach(function (fn, i) {
      ctx.save();
      ctx.translate((i % COLS) * CW, Math.floor(i / COLS) * CH);
      ctx.beginPath(); ctx.rect(0, 0, CW, CH); ctx.clip();
      fn(ctx);
      ctx.restore();
    });
    return atlas;
  }

  /* иконка-ноготь для каталога */
  function icon(d, shape, size) {
    size = size || 1;
    var w = Math.round(64 * size), h = Math.round(104 * size);
    var c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    var ctx = c.getContext('2d'); ctx.scale(2, 2);
    var A = buildAtlas(), W = w * 0.66, L = h * 0.86, ox = w / 2, oy = h * 0.07;
    var pts = outline(L, W, shape, 40);
    var cell = cellFor(d, 2);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath(); pts.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }); ctx.closePath();
    ctx.shadowColor = 'rgba(40,10,25,0.35)'; ctx.shadowBlur = 6 * size; ctx.shadowOffsetY = 3 * size;
    ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.clip();
    ctx.drawImage(A, (cell % COLS) * CW, Math.floor(cell / COLS) * CH, CW, CH, -W / 2, 0, W, L);
    if (d.fx[0] > 0) {
      var g0 = ctx.createLinearGradient(-W / 2, 0, W / 2, L);
      g0.addColorStop(0, 'rgba(255,220,240,0.7)'); g0.addColorStop(0.35, 'rgba(200,230,255,0.25)'); g0.addColorStop(0.6, 'rgba(255,255,255,0.75)'); g0.addColorStop(1, 'rgba(230,210,255,0.4)');
      ctx.fillStyle = g0; ctx.fillRect(-W / 2, 0, W, L);
    }
    if (d.fx[1] > 0) {
      var g1 = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
      g1.addColorStop(0.2, 'rgba(250,200,230,0)'); g1.addColorStop(0.5, 'rgba(250,200,230,0.85)'); g1.addColorStop(0.8, 'rgba(250,200,230,0)');
      ctx.fillStyle = g1; ctx.fillRect(-W / 2, 0, W, L);
    }
    var g = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(0.22, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.36, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g; ctx.fillRect(-W / 2, 0, W, L);
    ctx.restore();
    return c.toDataURL('image/png');
  }

  /* SVG-путь формы для кнопок */
  function shapePath(shape, W, L, ox, oy) {
    return outline(L, W, shape, 30).map(function (p, i) { return (i ? 'L' : 'M') + (ox + p[0]).toFixed(1) + ' ' + (oy + p[1]).toFixed(1); }).join(' ') + 'Z';
  }

  global.NailDesigns = {
    DESIGNS: DESIGNS, SHAPES: SHAPES, CW: CW, CH: CH, COLS: COLS, ROWS: ROWS,
    halfW: halfW, outline: outline, buildAtlas: buildAtlas, icon: icon, byId: byId, cellFor: cellFor, shapePath: shapePath
  };
})(window);
