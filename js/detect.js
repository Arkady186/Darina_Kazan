/* Автопоиск ногтей на фото руки.
   Модель MediaPipe Hand Landmarker грузится из интернета при первом использовании;
   само фото не покидает браузер. Если загрузка невозможна — студия переходит
   в ручную разметку. */
(function (global) {
  'use strict';
  var VER = '0.10.14';
  var BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VER;
  var MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  var pending = null, ready = null;

  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }

  function load() {
    if (ready) return Promise.resolve(ready);
    if (pending) return pending;
    if (!navigator.onLine) return Promise.reject(new Error('offline'));
    pending = timeout((async function () {
      var vision = await import(BASE + '/vision_bundle.mjs');
      var files = await vision.FilesetResolver.forVisionTasks(BASE + '/wasm');
      var opts = {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE', numHands: 2,
        minHandDetectionConfidence: 0.35, minHandPresenceConfidence: 0.35
      };
      var lm;
      try { lm = await vision.HandLandmarker.createFromOptions(files, opts); }
      catch (e) { opts.baseOptions.delegate = 'CPU'; lm = await vision.HandLandmarker.createFromOptions(files, opts); }
      ready = lm; return lm;
    })(), 30000);
    pending.catch(function () { pending = null; });
    return pending;
  }

  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  /* 21 точка руки -> 5 ногтей */
  var FINGERS = [
    { f: 0, d: 3, t: 4, wk: 0.165 },
    { f: 1, d: 7, t: 8, wk: 0.13 },
    { f: 2, d: 11, t: 12, wk: 0.135 },
    { f: 3, d: 15, t: 16, wk: 0.125 },
    { f: 4, d: 19, t: 20, wk: 0.105 }
  ];
  function nailsFromHand(lm, W, H) {
    var P = function (i) { return [lm[i].x * W, lm[i].y * H]; };
    var hand = dist(P(0), P(9)) || 1;
    return FINGERS.map(function (F) {
      var D = P(F.d), T = P(F.t), s = dist(D, T) || 1;
      var ux = (T[0] - D[0]) / s, uy = (T[1] - D[1]) / s;
      var w = Math.min(Math.max(s * 0.6, hand * F.wk * 0.85), hand * F.wk * 1.3);
      var Ln = Math.min(Math.max(s * 0.58, w * 0.55), w * 1.45);
      var tip = [T[0] + ux * s * 0.02, T[1] + uy * s * 0.02];
      var b = [tip[0] - ux * Ln, tip[1] - uy * Ln];
      return { f: F.f, b: b, t: tip, w: w, auto: true };
    });
  }

  function detect(canvas) {
    return load().then(function (lm) {
      var res = lm.detect(canvas);
      var hands = (res && res.landmarks) || [];
      var nails = [];
      hands.forEach(function (h) { nails = nails.concat(nailsFromHand(h, canvas.width, canvas.height)); });
      return nails.slice(0, 10);
    });
  }

  global.HandDetect = { load: load, detect: detect, nailsFromHand: nailsFromHand };
})(window);
