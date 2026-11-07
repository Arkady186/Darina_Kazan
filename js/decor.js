/* Парящий 3D-декор вокруг фото в первом экране: жемчуг, стразы, сердца, звёзды, искры. */
(function (global) {
  'use strict';
  function init(canvas, anchorEl) {
    var GL = global.GL3, G = GL.geo, Node = GL.Node;
    var R = new GL.Renderer(canvas);
    function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }
    var mats = {
      gold: R.material({ color: hex('#e9c48a'), spec: 1, rough: 0.12, metal: 1 }),
      silver: R.material({ color: hex('#e8ecf4'), spec: 1, rough: 0.08, metal: 1 }),
      pearl: R.material({ color: hex('#fff3ee'), spec: 0.9, rough: 0.1, metal: 0.15 }),
      heart: R.material({ color: hex('#f4a3ba'), spec: 0.95, rough: 0.06, emis: 0.06 }),
      gem: R.material({ color: hex('#e3ebff'), spec: 1, rough: 0.05, metal: 0.55 })
    };
    var mesh = {
      pearl: R.mesh(G.sphere(1, 28, 18)),
      gem: R.mesh(G.gem(1)),
      heart: R.mesh(G.pillow(function (t) {
        var x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [x / 17, (y + 2.5) / 17];
      }, 0.5, 44, 22)),
      star: R.mesh(G.pillow(function (t) {
        var k = (t / (Math.PI * 2)) * 10, i = Math.floor(k), f = k - i;
        var a0 = -Math.PI / 2 + i * Math.PI / 5, a1 = a0 + Math.PI / 5, r0 = i % 2 ? 0.42 : 1, r1 = i % 2 ? 1 : 0.42;
        return [Math.cos(a0) * r0 * (1 - f) + Math.cos(a1) * r1 * f, Math.sin(a0) * r0 * (1 - f) + Math.sin(a1) * r1 * f];
      }, 0.32, 60, 16))
    };
    var root = new Node(), items = [];
    var spec = [['heart', 'heart', 0.26], ['pearl', 'pearl', 0.13], ['star', 'gold', 0.22], ['gem', 'gem', 0.16], ['pearl', 'pearl', 0.09],
      ['star', 'silver', 0.15], ['heart', 'heart', 0.17], ['gem', 'gem', 0.12], ['pearl', 'pearl', 0.16], ['star', 'gold', 0.13], ['gem', 'gem', 0.09]];
    spec.forEach(function (s, i) {
      var n = new Node(mesh[s[0]]); n.mat = mats[s[1]]; n.s = s[2]; root.add(n);
      items.push({ n: n, a: i / spec.length * Math.PI * 2 + Math.random() * 0.4, sp: 0.08 + Math.random() * 0.1, k: 1.0 + (i % 3) * 0.12 + Math.random() * 0.08,
        wob: Math.random() * 6, spin: 0.3 + Math.random() * 0.8, base: s[2] });
    });
    var NS = 70, sp = new Float32Array(NS * 7), sparks = [];
    for (var i = 0; i < NS; i++) sparks.push({ a: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 0.75, z: (Math.random() - 0.5) * 2, s: 0.1 + Math.random() * 0.22, ph: Math.random(), f: 1 + Math.random() * 3, v: (Math.random() - 0.5) * 0.06 });
    var running = true, ptr = [0, 0], pc = [0, 0];
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function frame(ms) {
      requestAnimationFrame(frame);
      if (!running) return;
      var t = ms / 1000;
      R.resize();
      var cr = canvas.getBoundingClientRect(), ar = anchorEl.getBoundingClientRect();
      if (!cr.width || !ar.width) return;
      var cx = ((ar.left + ar.width / 2 - cr.left) / cr.width - 0.5) * R.visW;
      var cy = -((ar.top + ar.height / 2 - cr.top) / cr.height - 0.5) * R.visH;
      var hw = ar.width / cr.width * R.visW / 2, hh = ar.height / cr.height * R.visH / 2;
      pc[0] += (ptr[0] - pc[0]) * 0.05; pc[1] += (ptr[1] - pc[1]) * 0.05;
      var k = Math.min(1.2, hw / 1.6);
      items.forEach(function (it, j) {
        if (!reduce) it.a += it.sp * 0.016;
        var ex = Math.cos(it.a) * (hw * 1.12 + 0.25) * it.k, ey = Math.sin(it.a) * (hh * 1.0 + 0.2) * it.k;
        it.n.p = [cx + ex + pc[0] * 0.25 * it.k, cy + ey + Math.sin(t * 0.8 + it.wob) * 0.12 - pc[1] * 0.2 * it.k, Math.sin(it.a * 2 + it.wob) * 1.2];
        it.n.r = [t * it.spin * 0.5, t * it.spin, t * it.spin * 0.3];
        it.n.s = it.base * k;
      });
      for (var q = 0; q < NS; q++) {
        var s = sparks[q]; s.a += s.v * 0.016;
        var o = q * 7;
        sp[o] = cx + Math.cos(s.a) * hw * 1.25 * (0.6 + s.r * 0.6); sp[o + 1] = cy + Math.sin(s.a) * hh * 1.15 * (0.6 + s.r * 0.6); sp[o + 2] = s.z;
        sp[o + 3] = s.s; sp[o + 4] = s.ph; sp[o + 5] = s.f; sp[o + 6] = 0;
      }
      R.setSparkles(sp);
      R.draw([root], t);
    }
    requestAnimationFrame(frame);
    return {
      run: function (v) { running = v; },
      pointer: function (x, y) { ptr = [x, y]; }
    };
  }
  global.Decor = { init: init };
})(window);
