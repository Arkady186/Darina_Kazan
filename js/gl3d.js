/* Мини-3D движок на чистом WebGL (без внешних библиотек).
   Узлы со сценой, геометрия (лафт/параметрические поверхности), один "uber"-шейдер
   с глянцевыми бликами и частицы-искры. */
(function (global) {
  'use strict';

  /* ---------- матрицы (column-major) ---------- */
  var tmpM = new Float32Array(16);
  var M = {
    ident: function () { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
    mul: function (o, a, b) {
      for (var c = 0; c < 4; c++) for (var i = 0; i < 4; i++) {
        tmpM[c*4+i] = a[i]*b[c*4] + a[4+i]*b[c*4+1] + a[8+i]*b[c*4+2] + a[12+i]*b[c*4+3];
      }
      o.set(tmpM); return o;
    },
    persp: function (o, fov, asp, n, f) {
      var t = 1 / Math.tan(fov / 2);
      o.fill(0);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    local: function (o, p, r, s) {
      var cx = Math.cos(r[0]), sx = Math.sin(r[0]);
      var cy = Math.cos(r[1]), sy = Math.sin(r[1]);
      var cz = Math.cos(r[2]), sz = Math.sin(r[2]);
      var sc = s;
      o[0] = cz*cy*sc;               o[1] = sz*cy*sc;               o[2] = -sy*sc;     o[3] = 0;
      o[4] = (cz*sy*sx - sz*cx)*sc;  o[5] = (sz*sy*sx + cz*cx)*sc;  o[6] = cy*sx*sc;    o[7] = 0;
      o[8] = (cz*sy*cx + sz*sx)*sc;  o[9] = (sz*sy*cx - cz*sx)*sc;  o[10] = cy*cx*sc;   o[11] = 0;
      o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
      return o;
    }
  };

  /* ---------- узел сцены ---------- */
  function Node(mesh) {
    this.p = [0, 0, 0]; this.r = [0, 0, 0]; this.s = 1;
    this.kids = []; this.parent = null; this.mesh = mesh || null; this.vis = true;
    this.w = M.ident(); this.l = M.ident();
  }
  Node.prototype.add = function (n) { n.parent = this; this.kids.push(n); return n; };
  Node.prototype.remove = function (n) {
    var i = this.kids.indexOf(n); if (i >= 0) { this.kids.splice(i, 1); n.parent = null; }
  };
  Node.prototype.update = function (pw) {
    M.local(this.l, this.p, this.r, this.s);
    if (pw) M.mul(this.w, pw, this.l); else this.w.set(this.l);
    for (var i = 0; i < this.kids.length; i++) this.kids[i].update(this.w);
  };

  /* ---------- геометрия ---------- */
  function smoothNormals(pos, idx) {
    var n = new Float32Array(pos.length), i, key, map = {}, groups = new Array(pos.length / 3);
    for (i = 0; i < pos.length; i += 3) {
      key = Math.round(pos[i]*2000) + '_' + Math.round(pos[i+1]*2000) + '_' + Math.round(pos[i+2]*2000);
      if (map[key] === undefined) map[key] = [];
      map[key].push(i / 3); groups[i / 3] = key;
    }
    var acc = {};
    for (i = 0; i < idx.length; i += 3) {
      var a = idx[i]*3, b = idx[i+1]*3, c = idx[i+2]*3;
      var ux = pos[b]-pos[a], uy = pos[b+1]-pos[a+1], uz = pos[b+2]-pos[a+2];
      var vx = pos[c]-pos[a], vy = pos[c+1]-pos[a+1], vz = pos[c+2]-pos[a+2];
      var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      [a, b, c].forEach(function (k) {
        var g = groups[k / 3]; var s = acc[g] || (acc[g] = [0, 0, 0]);
        s[0] += nx; s[1] += ny; s[2] += nz;
      });
    }
    for (i = 0; i < pos.length; i += 3) {
      var s2 = acc[groups[i / 3]] || [0, 1, 0]; var l = Math.hypot(s2[0], s2[1], s2[2]) || 1;
      n[i] = s2[0] / l; n[i+1] = s2[1] / l; n[i+2] = s2[2] / l;
    }
    return n;
  }

  function finish(pos, uv, idx, flat) {
    if (flat) {
      var p2 = [], u2 = [], n2 = [], i2 = [], k = 0;
      for (var t = 0; t < idx.length; t += 3) {
        var a = idx[t]*3, b = idx[t+1]*3, c = idx[t+2]*3;
        var ux = pos[b]-pos[a], uy = pos[b+1]-pos[a+1], uz = pos[b+2]-pos[a+2];
        var vx = pos[c]-pos[a], vy = pos[c+1]-pos[a+1], vz = pos[c+2]-pos[a+2];
        var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        var l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        [a, b, c].forEach(function (q) {
          p2.push(pos[q], pos[q+1], pos[q+2]); n2.push(nx, ny, nz);
          u2.push(uv[q/3*2], uv[q/3*2+1]); i2.push(k++);
        });
      }
      return { pos: new Float32Array(p2), nor: new Float32Array(n2), uv: new Float32Array(u2), idx: new Uint16Array(i2) };
    }
    return { pos: new Float32Array(pos), nor: smoothNormals(pos, idx), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  /* сетка nu x nv по функции fn(u,v)->[x,y,z] */
  function surface(nu, nv, fn, flat) {
    var pos = [], uv = [], idx = [], i, j;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var u = i / nu, v = j / nv, p = fn(u, v);
      pos.push(p[0], p[1], p[2]); uv.push(u, v);
    }
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = j*(nu+1)+i, b = a+1, c = a+nu+1, d = c+1;
      idx.push(a, c, b, b, c, d);
    }
    return finish(pos, uv, idx, flat);
  }

  /* тело вращения вокруг оси Y: profile = [[radius, y], ...] */
  function lathe(profile, seg, sx, sy, sz) {
    sx = sx || 1; sy = sy || 1; sz = sz || 1;
    return surface(seg, profile.length - 1, function (u, v) {
      var pr = profile[Math.round(v * (profile.length - 1))];
      var a = u * Math.PI * 2;
      return [Math.cos(a) * pr[0] * sx, pr[1] * sy, Math.sin(a) * pr[0] * sz];
    });
  }

  /* капсула вдоль +Y: низ y=0 (радиус r0), верх y=len (радиус r1) */
  function capsule(r0, r1, len, seg, sz) {
    var pr = [], k, a, N = 7;
    for (k = 0; k <= N; k++) { a = -Math.PI/2 + (k / N) * Math.PI/2; pr.push([Math.max(r0 * Math.cos(a), 0.0001), r0 * Math.sin(a)]); }
    for (k = 1; k < 3; k++) pr.push([r0 + (r1 - r0) * k / 3, len * k / 3]);
    for (k = 0; k <= N; k++) { a = (k / N) * Math.PI/2; pr.push([Math.max(r1 * Math.cos(a), 0.0001), len + r1 * Math.sin(a)]); }
    return lathe(pr, 22, 1, 1, sz || 1);
  }

  function sphere(r, seg, rings, flat) {
    return surface(seg, rings, function (u, v) {
      var a = u * Math.PI * 2, b = (v - 0.5) * Math.PI;
      return [Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r];
    }, flat);
  }

  function spow(x, e) { return (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), e); }
  /* скруглённая "плитка" — суперэллипсоид (ладонь) */
  function slab(a, b, c, e) {
    return surface(40, 28, function (u, v) {
      var ph = u * Math.PI * 2, th = (v - 0.5) * Math.PI;
      var ct = spow(Math.cos(th), e), st = spow(Math.sin(th), e);
      return [a * ct * spow(Math.cos(ph), e), b * ct * spow(Math.sin(ph), e), c * st];
    });
  }

  /* "подушка": надутая фигура по контуру outline(t)->[x,y] */
  function pillow(outline, bulge, seg, rings) {
    return surface(seg, rings, function (u, v) {
      var o = outline(u * Math.PI * 2), al = v * Math.PI;
      var s = Math.sin(al);
      return [o[0] * s, o[1] * s, bulge * Math.cos(al)];
    });
  }

  /* ноготь: оболочка с толщиной. w x h, начало в центре кутикулы, ось Y к краю */
  function nailShell(w, h, thick, cx, ly) {
    var nu = 14, nv = 20, pos = [], uv = [], idx = [], i, j, side;
    function pt(s, t) {
      var px = s, py = t * 2 - 1;
      var n = t < 0.5 ? 2.3 : 7;
      var den = Math.pow(Math.pow(Math.abs(px), n) + Math.pow(Math.abs(py), n), 1 / n) || 1;
      var k = Math.max(Math.abs(px), Math.abs(py)) / den;
      var qx = px * k, qy = py * k;
      var x = qx * w / 2, y = (qy * 0.5 + 0.5) * h;
      var z = -cx * x * x - ly * Math.pow(y / h - 0.45, 2);
      return [x, y, z];
    }
    for (side = 0; side < 2; side++) {
      for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
        var s = (i / nu) * 2 - 1, t = j / nv, p = pt(s, t);
        pos.push(p[0], p[1], p[2] - side * thick); uv.push(i / nu, t);
      }
    }
    var off = (nu + 1) * (nv + 1);
    for (side = 0; side < 2; side++) for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = side*off + j*(nu+1)+i, b = a+1, c = a+nu+1, d = c+1;
      idx.push(a, c, b, b, c, d);
    }
    /* боковая стенка по периметру */
    var loop = [], q;
    for (i = 0; i <= nu; i++) loop.push(i);
    for (j = 1; j <= nv; j++) loop.push(j*(nu+1)+nu);
    for (i = nu - 1; i >= 0; i--) loop.push(nv*(nu+1)+i);
    for (j = nv - 1; j >= 1; j--) loop.push(j*(nu+1));
    for (q = 0; q < loop.length; q++) {
      var t0 = loop[q], t1 = loop[(q+1) % loop.length];
      idx.push(t0, t1, t0+off, t1, t1+off, t0+off);
    }
    return finish(pos, uv, idx);
  }

  /* огранённый камень */
  function gem(r) {
    var pr = [[0.0001, -r*0.9], [r*0.55, -r*0.25], [r, 0], [r*0.72, r*0.28], [0.0001, r*0.38]];
    var g = lathe(pr, 8);
    return finish(Array.from(g.pos), Array.from(g.uv), Array.from(g.idx), true);
  }

  /* ---------- шейдеры ---------- */
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv;',
    'uniform mat4 uModel; uniform mat4 uVP;',
    'varying vec3 vN; varying vec3 vW; varying vec2 vUv;',
    'void main(){',
    '  vec4 w = uModel * vec4(aPos,1.0); vW = w.xyz;',
    '  vN = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNor;',
    '  vUv = aUv; gl_Position = uVP * w; }'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'varying vec3 vN; varying vec3 vW; varying vec2 vUv;',
    'uniform vec3 uCam; uniform vec3 uColor; uniform sampler2D uTex; uniform float uUseTex;',
    'uniform float uSpec; uniform float uRough; uniform float uMetal; uniform float uSkin; uniform float uEmis;',
    'vec3 env(vec3 r){',
    '  float y = r.y*0.5+0.5;',
    '  vec3 c = mix(vec3(0.10,0.07,0.09), vec3(0.50,0.44,0.48), smoothstep(0.0,1.0,y));',
    '  float b1 = smoothstep(0.80,0.93, dot(r, normalize(vec3(-0.55,0.75,0.65))));',
    '  float b2 = smoothstep(0.86,0.96, dot(r, normalize(vec3(0.85,0.30,0.50))));',
    '  float b3 = smoothstep(0.90,0.985, dot(r, normalize(vec3(0.05,0.25,1.0))));',
    '  float b4 = smoothstep(0.88,0.97, dot(r, normalize(vec3(-0.2,-0.4,0.9))));',
    '  c += vec3(2.4,2.3,2.2)*b1 + vec3(1.1,1.3,1.9)*b2 + vec3(1.9,1.8,1.8)*b3 + vec3(1.0,0.7,0.8)*b4*0.8;',
    '  return c; }',
    'void main(){',
    '  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);',
    '  if(!gl_FrontFacing) N = -N;',
    '  vec3 base = uUseTex > 0.5 ? texture2D(uTex, vUv).rgb : uColor;',
    '  base = pow(base, vec3(2.2));',
    '  vec3 L1 = normalize(vec3(-0.55,0.8,0.7)); vec3 L2 = normalize(vec3(0.85,0.25,0.5)); vec3 L3 = normalize(vec3(0.0,0.3,-1.0));',
    '  float wrap = uSkin*0.32;',
    '  float d1 = max((dot(N,L1)+wrap)/(1.0+wrap),0.0);',
    '  float d2 = max((dot(N,L2)+wrap)/(1.0+wrap),0.0);',
    '  float d3 = max(dot(N,L3),0.0);',
    '  vec3 amb = mix(vec3(0.10,0.07,0.09), vec3(0.34,0.29,0.33), N.y*0.5+0.5);',
    '  vec3 lit = base*(amb + vec3(1.1,0.97,0.9)*d1*1.05 + vec3(0.75,0.82,1.0)*d2*0.38 + vec3(1.0,0.55,0.65)*d3*0.55);',
    '  float nv = max(dot(N,V),0.0);',
    '  lit += uSkin*base*vec3(1.0,0.33,0.28)*pow(1.0-nv,2.2)*0.55;',
    '  vec3 R = reflect(-V,N);',
    '  float F = 0.04 + 0.96*pow(1.0-nv,5.0);',
    '  vec3 e = mix(env(R), vec3(0.45), uRough);',
    '  vec3 H1 = normalize(L1+V); vec3 H2 = normalize(L2+V);',
    '  float sh = mix(260.0, 16.0, uRough);',
    '  float sp = pow(max(dot(N,H1),0.0),sh) + 0.5*pow(max(dot(N,H2),0.0),sh);',
    '  vec3 col;',
    '  vec3 tint = mix(vec3(1.0), base*1.6+0.2, uMetal);',
    '  col = lit*(1.0-uMetal*0.9) + e*tint*(0.12+0.88*F)*uSpec + vec3(1.0)*sp*uSpec*0.55 + base*uEmis;',
    '  col = col/(1.0+0.18*col)*1.14;',
    '  col = pow(col, vec3(1.0/2.2));',
    '  gl_FragColor = vec4(col,1.0); }'
  ].join('\n');

  var SVS = [
    'attribute vec3 aPos; attribute vec4 aData;',
    'uniform mat4 uVP; uniform float uTime; uniform float uPx;',
    'varying float vA; varying vec3 vC;',
    'void main(){',
    '  gl_Position = uVP * vec4(aPos,1.0);',
    '  float tw = 0.5 + 0.5*sin(uTime*aData.z + aData.y*6.283);',
    '  tw = tw*tw;',
    '  gl_PointSize = max(aData.x * uPx / gl_Position.w * (0.35+tw), 1.0);',
    '  vA = tw; vC = mix(vec3(1.0,0.78,0.62), vec3(1.0,0.62,0.78), fract(aData.y*7.0)); }'
  ].join('\n');
  var SFS = [
    'precision mediump float; varying float vA; varying vec3 vC;',
    'void main(){ vec2 p = gl_PointCoord*2.0-1.0; float d = length(p);',
    '  float core = exp(-9.0*d*d);',
    '  float cr = exp(-30.0*abs(p.x))*exp(-2.2*abs(p.y)) + exp(-30.0*abs(p.y))*exp(-2.2*abs(p.x));',
    '  float a = (core*0.9 + cr)*vA;',
    '  gl_FragColor = vec4(vC*a, a*0.7); }'
  ].join('\n');

  function compile(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  /* ---------- рендерер ---------- */
  function Renderer(canvas) {
    var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL недоступен');
    this.gl = gl; this.canvas = canvas;
    this.prog = compile(gl, VS, FS);
    this.sprog = compile(gl, SVS, SFS);
    this.proj = M.ident(); this.vp = M.ident(); this.view = M.ident();
    this.fov = 28 * Math.PI / 180; this.dist = 14;
    this.cam = [0, 0, this.dist];
    this.sparkBuf = gl.createBuffer();
    this.sparkles = null;
    this.whiteTex = this.texture(null);
    this.resize();
  }
  Renderer.prototype.resize = function () {
    var c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(c.clientWidth * dpr)), h = Math.max(1, Math.floor(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.gl.viewport(0, 0, w, h);
    M.persp(this.proj, this.fov, w / h, 1, 60);
    this.view.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-this.dist,1]);
    M.mul(this.vp, this.proj, this.view);
    this.aspect = w / h;
    this.visH = 2 * this.dist * Math.tan(this.fov / 2);
    this.visW = this.visH * this.aspect;
  };
  Renderer.prototype.texture = function (canvas) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (canvas) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      var ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  Renderer.prototype.mesh = function (geo) {
    var gl = this.gl, n = geo.pos.length / 3, buf = new Float32Array(n * 8), i;
    for (i = 0; i < n; i++) {
      buf.set(geo.pos.subarray(i*3, i*3+3), i*8);
      buf.set(geo.nor.subarray(i*3, i*3+3), i*8+3);
      buf.set(geo.uv.subarray(i*2, i*2+2), i*8+6);
    }
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
    return { vb: vb, ib: ib, count: geo.idx.length };
  };
  /* материал: color [r,g,b] 0..1 (sRGB), tex, spec, rough, metal, skin, emis */
  Renderer.prototype.material = function (o) {
    return Object.assign({ color: [1,1,1], tex: null, spec: 0.3, rough: 0.5, metal: 0, skin: 0, emis: 0 }, o || {});
  };
  Renderer.prototype.setSparkles = function (arr) { this.sparkles = arr; this.sparkN = arr.length / 7; };

  Renderer.prototype.draw = function (roots, time) {
    var gl = this.gl, P = this.prog, u = P.u, self = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniform3fv(u.uCam, this.cam);
    gl.uniform1i(u.uTex, 0);
    var aPos = gl.getAttribLocation(P.p, 'aPos'), aNor = gl.getAttribLocation(P.p, 'aNor'), aUv = gl.getAttribLocation(P.p, 'aUv');
    gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aNor); gl.enableVertexAttribArray(aUv);
    function walk(n) {
      if (!n.vis) return;
      if (n.mesh) {
        var m = n.mesh, mat = n.mat;
        gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 32, 24);
        gl.uniformMatrix4fv(u.uModel, false, n.w);
        gl.uniform3fv(u.uColor, mat.color);
        gl.uniform1f(u.uUseTex, mat.tex ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mat.tex || self.whiteTex);
        gl.uniform1f(u.uSpec, mat.spec); gl.uniform1f(u.uRough, mat.rough);
        gl.uniform1f(u.uMetal, mat.metal); gl.uniform1f(u.uSkin, mat.skin); gl.uniform1f(u.uEmis, mat.emis);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      }
      for (var i = 0; i < n.kids.length; i++) walk(n.kids[i]);
    }
    roots.forEach(function (r) { r.update(null); walk(r); });
    gl.disableVertexAttribArray(aNor); gl.disableVertexAttribArray(aUv);

    /* искры */
    if (this.sparkles) {
      var S = this.sprog, su = S.u;
      gl.useProgram(S.p);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.uniformMatrix4fv(su.uVP, false, this.vp); gl.uniform1f(su.uTime, time);
      gl.uniform1f(su.uPx, this.canvas.height / (2 * Math.tan(this.fov / 2)));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.sparkles, gl.DYNAMIC_DRAW);
      var ap = gl.getAttribLocation(S.p, 'aPos'), ad = gl.getAttribLocation(S.p, 'aData');
      gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(ad);
      gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(ad, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.POINTS, 0, this.sparkN);
      gl.disableVertexAttribArray(ap); gl.disableVertexAttribArray(ad);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
  };

  global.GL3 = {
    M: M, Node: Node, Renderer: Renderer,
    geo: { surface: surface, lathe: lathe, capsule: capsule, sphere: sphere, slab: slab, pillow: pillow, nailShell: nailShell, gem: gem }
  };
})(window);
