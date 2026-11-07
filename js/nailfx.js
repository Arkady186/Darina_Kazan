/* NailFX — фотореалистичный рендер ногтей поверх фото (WebGL).
   Каждый ноготь: кутикула b, натуральный кончик t, ширина w, палец f.
   Шейдер строит форму (квадрат/овал/миндаль/балерина/стилет), объём и нормали,
   глянец с бликами от «софтбоксов» (двигаются за курсором), хром, кошачий глаз,
   блёстки, тень от наращённой длины, «кисть» при смене дизайна и режим до/после. */
(function (global) {
  'use strict';
  var MAXN = 10;
  var D = global.NailDesigns;

  var VS = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }';

  var FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uImg; uniform sampler2D uAtlas;',
    'uniform vec2 uSize; uniform vec2 uLight; uniform float uSplit; uniform float uMatte; uniform float uN; uniform float uScale;',
    'uniform vec4 uA[10]; uniform vec4 uB[10]; uniform vec4 uC[10]; uniform vec4 uD[10];',
    'uniform vec4 uFx0; uniform vec4 uFx1; uniform vec3 uCat0; uniform vec3 uCat1;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float halfW(float y, float L, float W, float s){',
    '  if (y < 0.0 || y > L) return 0.0;',
    '  float h = W*0.5; float c = W*0.32; float t; float a; float r;',
    '  if (y < c) { t = (c-y)/c; return h*sqrt(max(1.0-t*t,0.0)); }',
    '  float hb = h*(1.0-0.04*min(y/L,1.0));',
    '  if (s < 0.5) { r = W*0.14; if (y > L-r) { t = (y-(L-r))/r; return hb-r+r*sqrt(max(1.0-t*t,0.0)); } return hb; }',
    '  if (s < 1.5) { a = min(W*0.55, L-c); if (y > L-a) { t = (y-(L-a))/a; return hb*sqrt(max(1.0-t*t,0.0)); } return hb; }',
    '  if (s < 2.5) { a = min(W*1.15,(L-c)*0.85); if (y > L-a) { t = (y-(L-a))/a; return hb*pow(max(1.0-pow(t,1.8),0.0),0.75); } return hb; }',
    '  if (s < 3.5) { a = min(W*1.25,(L-c)*0.8); if (y > L-a) { t = (y-(L-a))/a; float w2 = hb*(1.0-0.42*t); r = W*0.07;',
    '      if (y > L-r) { float t2 = (y-(L-r))/r; w2 = w2-r+r*sqrt(max(1.0-t2*t2,0.0)); } return w2; } return hb; }',
    '  a = min(W*2.0,(L-c)*0.92); if (y > L-a) { t = (y-(L-a))/a; return hb*pow(max(1.0-t,0.0),0.8); } return hb;',
    '}',
    'float box(vec3 r, vec2 c, vec2 s){ vec2 d = abs(r.xy-c); return smoothstep(s.x, s.x*0.25, d.x)*smoothstep(s.y, s.y*0.3, d.y)*step(0.0,r.z); }',
    'vec3 env(vec3 r){',
    '  vec2 L = uLight;',
    '  float up = clamp(-r.y*0.5+0.5,0.0,1.0);',
    '  vec3 c = mix(vec3(0.02,0.018,0.02), vec3(0.12,0.115,0.12), up);',
    '  c += vec3(2.9,2.85,2.8)*box(r, vec2(-0.36+L.x*0.6, -0.1+L.y*0.35), vec2(0.22,0.34));',
    '  c += vec3(1.6,1.65,1.8)*box(r, vec2(0.40+L.x*0.6, -0.05+L.y*0.35), vec2(0.045,0.30));',
    '  c += vec3(0.7,0.66,0.66)*box(r, vec2(0.0+L.x*0.3, 0.55+L.y*0.25), vec2(0.6,0.10));',
    '  c += vec3(0.35)*smoothstep(0.55, 0.0, length(r.xy - vec2(L.x*0.5-0.15, L.y*0.4-0.25)));',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 p = vec2(vUv.x, 1.0-vUv.y)*uSize;',
    '  vec2 uv = p/uSize;',
    '  vec3 base = texture2D(uImg, uv).rgb;',
    '  if (vUv.x > uSplit) { gl_FragColor = vec4(base,1.0); return; }',
    '  vec3 col = base; float shadow = 0.0; vec3 ncol = vec3(0.0); float na = 0.0;',
    '  for (int i = 0; i < 10; i++) {',
    '    if (float(i) >= uN) break;',
    '    vec4 A = uA[i]; vec4 B = uB[i];',
    '    vec2 d = p - A.xy; vec2 dir = A.zw;',
    '    float y = dot(d, dir);',
    '    float W = uD[i].x; float L = B.y;',
    '    if (B.w < 0.5 || y < -W*0.4 || y > L+W*0.6) continue;',
    '    vec2 perp = vec2(-dir.y, dir.x); float x = dot(d, perp);',
    '    if (abs(x) > W*1.1) continue;',
    '    vec4 C = uC[i]; float Ln = B.x; float sh = B.z;',
    '    float aa = 0.9*uScale;',
    /* какая часть уже "прокрашена" кистью */
    '    float u = clamp(x/(W*0.5)*0.5+0.5, 0.0, 1.0);',
    '    float v = clamp(y/L, 0.0, 1.0);',
    '    float edge = C.z*1.35 - 0.2 + 0.035*sin(u*11.0+C.w*6.0) + 0.02*sin(u*23.0+C.w*3.0);',
    '    bool toSide = v < edge;',
    '    float cell = toSide ? C.y : C.x;',
    '    if (cell < 0.0) continue;',
    /* форма */
    '    float hw = halfW(y, L, W, sh);',
    '    float eS = hw - abs(x);',
    '    float flt = (sh < 0.5 || (sh > 2.5 && sh < 3.5)) ? 1.0 : 0.0;',
    '    float eT = flt > 0.5 ? (L - y) : 1e4;',
    '    float e = min(eS, eT);',
    '    float inside = (y > 0.0 && y < L) ? clamp(e/aa + 0.5, 0.0, 1.0) : 0.0;',
    '    inside *= smoothstep(0.0, 1.8*uScale, y);',
    /* закрашиваем остаток старого ногтя, если новая форма уже */
    '    float Lo = Ln + W*0.07;',
    '    float ohw = halfW(clamp(y, 0.0, Lo), Lo, W*1.12, 0.0);',
    '    float oIn = (y > -W*0.03 && y < Lo && abs(x) < ohw) ? 1.0 : 0.0;',
    '    if (oIn > 0.5 && inside < 1.0) {',
    '      float dS = ohw - abs(x); float dT = Lo - y; vec2 q;',
    '      if (dS < dT) q = A.xy + perp*(sign(x)*(ohw + dS + 3.0*uScale)) + dir*y;',
    '      else q = A.xy + perp*x + dir*(Lo + dT + 3.0*uScale);',
    '      vec3 fill = texture2D(uImg, q/uSize, 1.0).rgb;',
    '      col = mix(col, fill, 1.0 - inside);',
    '    }',
    /* тень от ногтя */
    '    vec2 so = normalize(vec2(-uLight.x*0.7, 0.75 - uLight.y*0.35)) * W*0.05;',
    '    vec2 ds = d - so; float xs = dot(ds, perp); float ys = dot(ds, dir);',
    '    float hs = halfW(ys, L, W, sh);',
    '    float sa = (ys > -W*0.1 && ys < L+W*0.1) ? clamp((hs - abs(xs))/(W*0.16) + 0.5, 0.0, 1.0) * smoothstep(L+W*0.1, L-W*0.05, ys) : 0.0;',
    '    shadow = max(shadow, sa * mix(0.05, 0.3, smoothstep(Ln*0.85, Ln*1.1, ys)));',
    '    if (inside <= 0.0) continue;',
    /* альбедо из атласа */
    '    float au = clamp(u, 0.03, 0.97);',
    '    vec2 auv = vec2((mod(cell, 8.0) + au)/8.0, (floor(cell/8.0) + clamp(v,0.004,0.996))/4.0);',
    '    vec3 alb = texture2D(uAtlas, auv).rgb; alb *= alb;',
    '    vec4 fx = toSide ? uFx1 : uFx0; vec3 cat = toSide ? uCat1 : uCat0;',
    /* нормаль: изгиб поперёк, лёгкий купол вдоль, скос у края */
    '    float hb = W*0.5;',
    '    float nx = clamp(x/max(hw, W*0.12), -1.0, 1.0);',
    '    vec3 n = vec3(nx*0.78, (v-0.42)*0.2 - 0.38*exp(-y/(W*0.16)), 0.0);',
    '    float bev = W*0.10;',
    '    float k = 1.0 - clamp(e/bev, 0.0, 1.0); k = k*k;',
    '    vec2 outw = (eS < eT) ? vec2(sign(x), 0.0) : vec2(0.0, 1.0);',
    '    n.xy += outw*k*0.75;',
    '    n.z = sqrt(max(1.0 - dot(n.xy, n.xy), 0.04)); n = normalize(n);',
    '    vec3 N = vec3(n.x*perp + n.y*dir, n.z);',
    /* освещение */
    '    vec3 Ld = normalize(vec3(uLight.x*0.7-0.25, uLight.y*0.6-0.5, 0.85));',
    '    float dif = clamp(dot(N, Ld), 0.0, 1.0);',
    '    vec3 amb = texture2D(uImg, uv, 6.0).rgb; float al = dot(amb, vec3(0.3,0.55,0.15));',
    '    float ill = mix(1.0, clamp(al/0.55, 0.6, 1.2), 0.55);',
    '    vec3 c = alb*(0.42 + 0.68*dif)*ill;',
    '    c *= mix(0.5, 1.0, pow(N.z, 1.4));',
    '    float onFinger = 1.0 - smoothstep(Ln*0.85, Ln*1.05, y);',
    '    c *= 1.0 - 0.22*k*onFinger*step(eS, eT);',
    '    vec3 R = vec3(2.0*N.z*N.xy, 2.0*N.z*N.z - 1.0);',
    '    float F = 0.04 + 0.96*pow(1.0 - N.z, 5.0);',
    '    vec3 ev = env(R);',
    '    float gloss = 1.0 - uMatte;',
    '    vec3 scene = texture2D(uImg, clamp(uv + R.xy*0.12, 0.0, 1.0), 4.5).rgb;',
    '    ev += scene*scene*0.6;',
    '    vec3 Hh = normalize(Ld + vec3(0.0,0.0,1.0));',
    '    float bl = pow(max(dot(N, Hh), 0.0), 180.0);',
    '    float rimK = 1.0 - 0.8*k*onFinger;',
    '    c += (ev*(0.045 + F*0.95)*rimK + vec3(bl*0.6))*gloss*(1.0 - fx.x*0.5);',
    '    c += uMatte*0.05*dif + uMatte*0.08*k;',
    /* хром */
    '    vec3 ir = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + R.x*1.3 + R.y*0.7 + uLight.x*0.4));',
    '    vec3 chrome = (ev*0.75 + 0.18)*mix(vec3(1.0), alb*1.3+0.35, 0.55) + ir*0.16;',
    '    c = mix(c, chrome, fx.x);',
    /* кошачий глаз */
    '    float bandPos = uLight.x*0.75 + (v-0.5)*0.25;',
    '    float band = exp(-pow((nx*0.75 - bandPos)/0.16, 2.0)) + 0.35*exp(-pow((nx*0.75 - bandPos)/0.45, 2.0));',
    '    float shim = 0.55 + 0.45*hash(floor(vec2(x, y)/(1.3*uScale)));',
    '    c += cat*cat*band*shim*fx.y*1.6;',
    /* блёстки */
    '    vec2 gc = floor(vec2(x, y)/(2.6*uScale));',
    '    float h = hash(gc + C.w*7.0);',
    '    float tw = pow(max(0.0, sin(h*60.0 + uLight.x*7.0 + uLight.y*5.0)), 10.0);',
    '    c += vec3(1.0,0.93,0.82)*step(0.5, h)*tw*fx.z*1.4;',
    /* влажная полоса кисти и кутикула */
    '    c += vec3(0.35)*exp(-pow((v-edge)/0.012, 2.0))*step(C.z, 0.999)*step(0.001, C.z);',
    '    c *= 1.0 - 0.28*exp(-y/(W*0.035));',
    '    c = c/(1.0+0.12*c)*1.1;',
    '    if (inside > na) { na = inside; ncol = sqrt(max(c, 0.0)); }',
    '  }',
    '  col *= 1.0 - shadow*(1.0-na);',
    '  col = mix(col, ncol, na);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(gl) {
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function pot(n) { var p = 1; while (p < n) p *= 2; return Math.min(p, 2048); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function NailFX(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL недоступен');
    this.gl = gl; this.canvas = canvas;
    this.prog = compile(gl);
    var U = {}, p = this.prog;
    ['uImg', 'uAtlas', 'uSize', 'uLight', 'uSplit', 'uMatte', 'uN', 'uScale', 'uA', 'uB', 'uC', 'uD', 'uFx0', 'uFx1', 'uCat0', 'uCat1'].forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
    this.U = U;
    var buf = this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.imgTex = gl.createTexture(); this.atlasTex = gl.createTexture();
    this._upload(this.atlasTex, D.buildAtlas(), true);
    this.nails = []; this.anim = [];
    this.design = null; this.prevDesign = null;
    this.shape = 0; this.len = 1; this.matte = 0; this.split = 1;
    this.light = [0, 0]; this.lightT = [0, 0]; this.pointer = false;
    this.dirty = true; this.running = true; this.auto = opts.autoLight !== false;
    this.onframe = null;
    var self = this;
    function loop(ms) { requestAnimationFrame(loop); self._tick(ms / 1000); }
    requestAnimationFrame(loop);
  }

  NailFX.prototype._upload = function (tex, src, mip) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  /* src: Image/Canvas, w/h — размер рабочей картинки; nails — в её пикселях */
  NailFX.prototype.setImage = function (src, w, h, nails) {
    var size = pot(Math.max(w, h));
    var c = document.createElement('canvas'); c.width = size; c.height = size;
    var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, size, size);
    this._upload(this.imgTex, c, true);
    this.w = w; this.h = h; this.fit();
    this.source = src;
    this.setNails(nails || []);
    this.anim = []; this.prevDesign = null;
  };
  /* разрешение рендера = размер на экране × DPR (не больше исходного фото) */
  NailFX.prototype.fit = function () {
    if (!this.w) return;
    var dw = this.canvas.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var k = dw ? Math.min(1, (dw * dpr) / this.w) : 1;
    k = Math.max(k, 0.25);
    if (this.fixedScale) k = this.fixedScale;
    var cw = Math.round(this.w * k), ch = Math.round(this.h * k);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; this.dirty = true; }
    this.k = k;
  };
  NailFX.prototype.setNails = function (nails) { this.nails = nails.slice(0, MAXN); this.dirty = true; };

  /* смена дизайна с анимацией кисти; design = объект из NailDesigns или null (оригинал) */
  NailFX.prototype.setDesign = function (design, animate) {
    if (design === this.design) return;
    this.prevDesign = this.design; this.design = design;
    var now = performance.now() / 1000, self = this;
    if (animate === false) { this.anim = []; this.prevDesign = design; this.dirty = true; return; }
    var order = this.nails.map(function (n, i) { return i; });
    order.sort(function (a, b) { return self.nails[a].b[0] - self.nails[b].b[0]; });
    this.anim = [];
    order.forEach(function (idx, k) { self.anim[idx] = { t0: now + k * 0.11, dur: 0.85 }; });
    this.animEnd = now + order.length * 0.11 + 0.9;
    this.dirty = true;
  };
  NailFX.prototype.setShape = function (s) { this.shape = s; this.dirty = true; };
  NailFX.prototype.setLength = function (l) { this.len = l; this.dirty = true; };
  NailFX.prototype.setMatte = function (m) { this.matte = m ? 1 : 0; this.dirty = true; };
  NailFX.prototype.setSplit = function (s) { this.split = s; this.dirty = true; };
  NailFX.prototype.setLight = function (x, y) { this.lightT = [x, y]; this.pointer = true; this.lastPtr = performance.now(); };
  NailFX.prototype.run = function (v) { this.running = v; if (v) this.dirty = true; };

  NailFX.prototype._tick = function (t) {
    if (!this.running || !this.w) return;
    var lx, ly;
    if (t - (this.lastFit || 0) > 0.5) { this.lastFit = t; this.fit(); }
    var autoMode = this.auto && !this.pointer;
    if (autoMode && !this.dirty && !(this.animEnd && t < this.animEnd + 0.05) && t - (this.lastRender || 0) < 1 / 30) return;
    if (this.auto && (!this.pointer || performance.now() - this.lastPtr > 2500)) {
      this.pointer = false;
      this.lightT = [Math.sin(t * 0.55) * 0.8, Math.sin(t * 0.37 + 1) * 0.5];
    }
    lx = this.light[0] + (this.lightT[0] - this.light[0]) * 0.08;
    ly = this.light[1] + (this.lightT[1] - this.light[1]) * 0.08;
    var moved = Math.abs(lx - this.light[0]) + Math.abs(ly - this.light[1]) > 0.0005;
    this.light = [lx, ly];
    var animating = this.animEnd && t < this.animEnd + 0.05;
    if (moved || animating || this.dirty) { this.render(t); this.dirty = false; this.lastRender = t; }
  };

  NailFX.prototype.render = function (t) {
    t = t || performance.now() / 1000;
    var gl = this.gl, U = this.U, n = this.nails.length;
    var A = new Float32Array(MAXN * 4), B = new Float32Array(MAXN * 4), C = new Float32Array(MAXN * 4), Dd = new Float32Array(MAXN * 4);
    var cur = this.design, prev = this.prevDesign;
    for (var i = 0; i < n; i++) {
      var N = this.nails[i];
      var dx = N.t[0] - N.b[0], dy = N.t[1] - N.b[1], Ln = Math.hypot(dx, dy) || 1;
      var ang = Math.atan2(dy, dx);
      var w = N.w * 1.05;
      var b0 = N.b[0] - Math.cos(ang) * w * 0.045, b1 = N.b[1] - Math.sin(ang) * w * 0.045;
      var Lnat = Ln * 1.02 + w * 0.045;
      var L = Math.max(Lnat * this.len, w * 0.9);
      if (this.shape === 4) L = Math.max(L, w * 1.9);
      if (this.shape === 2 || this.shape === 3) L = Math.max(L, w * 1.35);
      A[i * 4] = b0; A[i * 4 + 1] = b1; A[i * 4 + 2] = Math.cos(ang); A[i * 4 + 3] = Math.sin(ang); Dd[i * 4] = w;
      B[i * 4] = Lnat; B[i * 4 + 1] = L; B[i * 4 + 2] = this.shape; B[i * 4 + 3] = N.off ? 0 : 1;
      var f = N.f == null ? i : N.f;
      var an = this.anim[i], pr = 1;
      if (an) pr = Math.max(0, Math.min(1, (t - an.t0) / an.dur));
      C[i * 4] = prev ? D.cellFor(prev, f) : -1;
      C[i * 4 + 1] = cur ? D.cellFor(cur, f) : -1;
      C[i * 4 + 2] = cur ? ease(pr) : 1;
      C[i * 4 + 3] = (i * 0.618) % 1;
      if (!cur) { C[i * 4] = -1; C[i * 4 + 1] = -1; }
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.imgTex); gl.uniform1i(U.uImg, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.atlasTex); gl.uniform1i(U.uAtlas, 1);
    gl.uniform2f(U.uSize, this.w, this.h);
    gl.uniform2f(U.uLight, this.light[0], this.light[1]);
    gl.uniform1f(U.uSplit, this.split);
    gl.uniform1f(U.uMatte, this.matte);
    gl.uniform1f(U.uN, n);
    gl.uniform1f(U.uScale, Math.max(1, Math.max(this.w, this.h) / 1100) / Math.min(1, this.k || 1));
    gl.uniform4fv(U.uA, A); gl.uniform4fv(U.uB, B); gl.uniform4fv(U.uC, C); gl.uniform4fv(U.uD, Dd);
    var p0 = prev || { fx: [0, 0, 0], cat: [0, 0, 0] }, p1 = cur || p0;
    gl.uniform4f(U.uFx0, p0.fx[0], p0.fx[1], p0.fx[2], 0); gl.uniform4f(U.uFx1, p1.fx[0], p1.fx[1], p1.fx[2], 0);
    gl.uniform3fv(U.uCat0, p0.cat); gl.uniform3fv(U.uCat1, p1.cat);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (this.onframe) this.onframe();
  };

  /* экспорт PNG с подписью */
  NailFX.prototype.snapshot = function (label) {
    this.fixedScale = 1; this.fit(); this.render();
    var c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    var ctx = c.getContext('2d'); ctx.drawImage(this.canvas, 0, 0);
    this.fixedScale = 0; this.fit(); this.dirty = true;
    if (label) {
      var fs = Math.max(14, Math.round(this.w / 34));
      ctx.font = '600 ' + fs + 'px Manrope, Arial, sans-serif';
      var tw = ctx.measureText(label).width, pad = fs * 0.7;
      ctx.fillStyle = 'rgba(21,10,16,0.55)';
      var x = this.w - tw - pad * 3, y = this.h - fs * 2.6;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, tw + pad * 2, fs * 1.8, fs * 0.9); else ctx.rect(x, y, tw + pad * 2, fs * 1.8); ctx.fill();
      ctx.fillStyle = '#f6ece6'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + pad, y + fs * 0.92);
    }
    return c;
  };

  global.NailFX = NailFX;
})(window);
