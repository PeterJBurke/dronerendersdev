/*
 * motor_models.js - 5-inch quad reusable brushless outrunner motor and propeller models.
 * three.js r0.160, classic script (global THREE), works from file://. No modules, no external assets.
 *
 * Opacity rule (designer, 2026-11-08): every motor material and the prop hub are fully opaque; only the propeller
 * blades are translucent (logo decals use alphaTest, not blending).
 *
 * Units: 1 scene unit = 1 mm. Y is up. Every motor group has its origin at the centre of the
 * base underside (the face that sits on the arm), so place it at (x, armTopY, z).
 *
 * Public API (window.MotorModels):
 *   MotorModels.makeOutrunner(params)        -> THREE.Group  (params = preset name, preset object, or overrides)
 *   MotorModels.makeMotor(presetName, over)  -> THREE.Group  (shorthand: preset + overrides)
 *   MotorModels.makeProp(params)             -> THREE.Group  (origin = prop hub underside, sits on motor seatY)
 *   MotorModels.mountMotorAndProp(parent, {x, y, z, motor, prop, dir, leadAngle, propOver, motorOver}) -> {motor, prop}
 *   MotorModels.MOTOR_PRESETS, MotorModels.PROP_PRESETS
 *   group.userData: { seatY (prop seat = bell top), shaftTopY, nutTopY, bellD, rotor (THREE.Group that spins), preset }
 *
 * Sources for the presets (read 2026-11-08):
 *   UM2207: nwblue.com/products/unusual-machines-2207-motor (saved capture
 *     vendors/price-checks/2026-11-08_chrome/shopify-prices/nwblue_um2207-motor.html/.png):
 *     motor diameter 29.8 mm, overall length 32.7 mm, body length 19.2 mm, shaft 5 mm (M5 nut included),
 *     mounting 4 x M3 on PCD 19 mm, 12N14P, EZO 684ZZ, leads 3 x 20 cm 16 AWG, 33.3 g.
 *     Look from the product photo: matte gunmetal bell, plain side with white "UNUSUAL MACHINES" logo,
 *     six rounded windows in the top with copper visible, large top fillet, narrower four-lobed dark base,
 *     silver hollow M5 shaft. Stator 22 x 7 mm is the 2207-size definition; internal heights are ESTIMATED.
 *   XING2 1404 3800KV: shop.iflight.com/xing2-1404-toothpick-ultralight-build-unibell-pro1482 and reseller
 *     pages: 19.9 x 18.4 mm overall (body 13.5 mm per RaceDayQuads), 9 x 9 mm M2 mount, 9N12P, 9.1 g,
 *     120 mm 26 AWG leads, 1.5 mm shaft. Look from the reference kit photos (reference/ref4-drone/photos 057-059, 160):
 *     dark gunmetal bell side with large silver "XING" logo, teal anodised top with spokes, teal-grey lobed base.
 *   F2004 (5-inch default from 2026-11-08, designer): T-Motor F2004 3000KV: phi 24.3 x 17.25 mm, 12x12 M2, 1.5 mm shaft
 *     with T-mount screws, 12N14P, 16.4 g (fpv24.com, hobbyrc.co.uk, racedayquads.com listings; T-Motor store 404).
 *     Look from the fpv24 product photo (cdnc.meilon.de/img/product/tm/tmo-afd01010161/t-motor-f2004_l.jpg):
 *     gunmetal bell with large "F2004 TO THE FORE" print and a ring groove, black top with five swept spokes and
 *     bright blue machined window chamfers, copper visible, narrow dark four-lobed base.
 *     "12x12" = holes 12 mm apart across the centre (PCD 12), the same circle as the MOD-L 5" arm pad
 *     (designer README: "12mm motor mount (12 only on the 5")", "done with BrotherHobby VY2004 and FpvCycle 2203 in mind").
 *   TC2004: BrotherHobby TC2004 (M2 12x12, 12N14P, 14.9 g; getfpv / pyrodrone listings); F2004 geometry, colours not verified.
 *   generic2203: typical size dimensions, ESTIMATED; mount set to the MOD-L 5" pad (4 x M2 on a 12 mm circle).
 *   HQProp T5x2x3 (5-inch default prop): 127 mm, 2.0 in pitch, hub 9.8 x 5.0 mm, T-mount 1.9/1.5/1.9 mm holes, 2.5 g
 *     (myfpvstore.com, rotorama.com, kiwiquads.co.nz listings); planform ESTIMATED.
 *   HQProp V2S 5x4.3x3: 127 mm, hub 12.8 mm x 6.5 mm, 5 mm bore, 3.8 g, PC (retailer listings: fpvfaster.com.au,
 *     rotorama.com, readymaderc.com). Blade planform (max chord about 14.5 mm) ESTIMATED from product photos.
 *     In-stock colours at RaceDayQuads 2026-11-08: Yellow and Purple (Grey and Blue sold out).
 *   Gemfan Hurricane 4024-2 (1.5 mm): 102.2 mm, max blade width 13.38 mm, hub 5.5 mm thick (reseller listing),
 *     translucent blue as fitted to the reference kit (photos 159-161).
 */
(function (root) {
  'use strict';
  var THREE = root.THREE;
  if (!THREE) { throw new Error('motor_models.js needs three.js (global THREE) loaded first'); }
  var TAU = Math.PI * 2;

  // ---------------------------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------------------------
  function extend(dst) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) {
        var v = s[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && !(v.isColor) && typeof dst[k] === 'object' && dst[k] && !Array.isArray(dst[k])) dst[k] = extend({}, dst[k], v);
        else dst[k] = v;
      }
    }
    return dst;
  }

  // Merge several BufferGeometries (already transformed) into one non-indexed geometry with position/normal/uv.
  function mergeGeoms(list) {
    var parts = list.map(function (g) { return g.index ? g.toNonIndexed() : g; });
    var n = 0; parts.forEach(function (g) { n += g.attributes.position.count; });
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), o = 0;
    parts.forEach(function (g) {
      if (!g.attributes.normal) g.computeVertexNormals();
      var c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    list.forEach(function (g) { g.dispose(); });
    return out;
  }

  // Lay an ExtrudeGeometry (shape in XY, extruded along +Z) flat: shape XY -> world XZ (shape y -> world -z), extrusion -> +Y.
  function layFlat(geo, y0) { geo.rotateX(-Math.PI / 2); if (y0) geo.translate(0, y0, 0); return geo; }

  // Chaikin corner cutting on a closed polygon (array of [x, y]); gives rounded windows and lobes cheaply.
  function chaikin(pts, iters) {
    for (var k = 0; k < iters; k++) {
      var out = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      pts = out;
    }
    return pts;
  }
  function polyPath(pts, PathCtor) {
    var p = new (PathCtor || THREE.Path)();
    p.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  }
  function circlePath(x, y, r, PathCtor) { var p = new (PathCtor || THREE.Path)(); p.absarc(x, y, r, 0, TAU, false); return p; }
  function shadowed(m, cast, receive) { m.castShadow = cast !== false; m.receiveShadow = receive !== false; return m; }

  // ---------------------------------------------------------------------------------------------
  // Canvas textures (cached): copper turns, lamination stack, M5 thread, logos
  // ---------------------------------------------------------------------------------------------
  var texCache = {};
  function canvasTexture(key, w, h, draw, opts) {
    if (texCache[key]) return texCache[key];
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = (opts && opts.clamp) ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (opts && opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    texCache[key] = t;
    return t;
  }
  // Copper winding: one wire turn per stripe. Mapped so that 1 uv unit = 1 mm along the stripes' normal.
  function copperTexture(turnsPerMm) {
    return canvasTexture('cu' + turnsPerMm, 8, 64, function (g, w, h) {
      var n = 8;   // 8 turns per texture tile
      for (var i = 0; i < n; i++) {
        var y0 = i * h / n, grd = g.createLinearGradient(0, y0, 0, y0 + h / n);
        grd.addColorStop(0.0, '#4a2210'); grd.addColorStop(0.18, '#9a4f22'); grd.addColorStop(0.45, '#e8a066');
        grd.addColorStop(0.62, '#c0743a'); grd.addColorStop(0.9, '#5d2c12'); grd.addColorStop(1.0, '#3a1a0a');
        g.fillStyle = grd; g.fillRect(0, y0, w, h / n);
      }
    }, { repeat: [1, turnsPerMm / 8] });
  }
  // Stator lamination stack seen from the side: thin steel sheets with dark insulation lines.
  function laminationTexture() {
    return canvasTexture('lam', 4, 32, function (g, w, h) {
      g.fillStyle = '#8d939a'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 8; i++) { g.fillStyle = '#4b5056'; g.fillRect(0, i * 4, w, 1); g.fillStyle = '#a7adb3'; g.fillRect(0, i * 4 + 2, w, 1); }
    }, { repeat: [1, 0.25] });   // 8 sheets per 4 mm -> 0.5 mm sheets (real 0.2 mm; coarser so it survives downscaling)
  }
  function threadTexture(len) {
    var rv = Math.max(1, len / 0.8 / 2);
    return canvasTexture('thread' + rv.toFixed(2), 32, 16, function (g, w, h) {
      g.fillStyle = '#c9cdd2'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6b7077'; g.lineWidth = 4;
      for (var i = -2; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 8 + 2); g.lineTo(w, i * 8 + 6); g.stroke(); }
      g.strokeStyle = '#eef0f2'; g.lineWidth = 1.5;
      for (var j = -2; j < 4; j++) { g.beginPath(); g.moveTo(0, j * 8 + 6); g.lineTo(w, j * 8 + 10); g.stroke(); }
    }, { repeat: [1, rv] });   // two crests per tile -> 0.8 mm pitch (M5 x 0.8) over len mm
  }
  // Logo band around the bell: text printed twice around, on a transparent canvas.
  function logoTexture(spec) {
    var key = 'logo|' + spec.text + '|' + spec.sub + '|' + spec.color + '|' + spec.font;
    return canvasTexture(key, 2048, 192, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      for (var k = 0; k < 2; k++) {
        var cx = w * (0.25 + 0.5 * k);
        g.fillStyle = spec.color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.font = spec.font || 'bold 120px "DejaVu Sans", Arial, sans-serif';
        if (spec.italic) { g.save(); g.translate(cx, 0); g.transform(1, 0, -0.18, 1, 0, 0); g.fillText(spec.text, 0, spec.sub ? 122 : 150); g.restore(); }
        else g.fillText(spec.text, cx, spec.sub ? 122 : 150);
        if (spec.sub) { g.font = '600 40px "DejaVu Sans", Arial, sans-serif'; g.fillText(spec.sub, cx, 176); }
      }
    }, { clamp: false });
  }

  // ---------------------------------------------------------------------------------------------
  // Materials (cached by key)
  // ---------------------------------------------------------------------------------------------
  var matCache = {};
  function mat(key, make) { return matCache[key] || (matCache[key] = make()); }
  function stdMat(color, rough, metal, extra) {
    return mat('std|' + color + '|' + rough + '|' + metal + '|' + (extra ? JSON.stringify(extra) : ''), function () {
      return new THREE.MeshStandardMaterial(extend({ color: color, roughness: rough, metalness: metal }, extra || {}));
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------------------------------
  var MOTOR_PRESETS = {
    UM2207: {
      name: 'Unusual Machines UM2207 1860KV',
      bellD: 29.8,          // vendor "Motor Diameter: 29.8 mm" (renders used 27.9, unsourced)
      bodyH: 19.2,          // vendor "Body Length (h): 19.2 mm" (base underside to bell top)
      overallH: 32.7,       // vendor "Overall Length (H): 32.7 mm" -> shaft 13.5 mm above the bell
      baseH: 3.0, baseD: 21.5, baseGap: 0.8,               // ESTIMATED from the product photo (base narrower than bell, four lobes)
      baseLobes: 4, baseLobeR: 12.4, baseLobeWidth: 0.55, baseWindows: false,
      mount: { pcd: 19.0, screwD: 3.0, angle: Math.PI / 4 },  // vendor "4 x M3, PCD 19 mm" (= 13.4 x 13.4 mm square, NOT 16 x 16)
      wall: 1.3, topT: 1.8, fillet: 2.6,                   // bell wall / top thickness / top fillet radius, ESTIMATED from the photo
      windows: { n: 6, rIn: 5.6, rOut: 12.0, spoke: 2.6, round: 2 },   // six rounded windows (photo)
      hubBossR: 4.4, hubBossH: 0.6,
      stator: { d: 22, h: 7, teeth: 12, yokeIn: 7.0, yokeOut: 8.6, toothW: 2.6, tipIn: 9.9, slotOpen: 1.4 },  // 2207, 12N
      magnets: { n: 14, t: 1.4, h: 8.4 },                  // 12N14P (vendor)
      shaft: { d: 5, thread: 9.5, hollow: 1.6, clip: true },   // M5 x 0.8, hollow titanium-look shaft (photo)
      nut: { type: 'nyloc', af: 8, flangeD: 11, h: 6.2, color: 0x9da3aa, insert: 0x1f3fa0 },   // 1x M5 nut included (vendor); flange nyloc ASSUMED
      propHubH: 6.5,        // HQProp V2S hub thickness: the nut sits on top of the prop hub
      leads: { n: 3, d: 2.1, len: 26, colors: [0x141517, 0x141517, 0x141517], angle: 0 },   // 3 x 16 AWG silicone (vendor), black ASSUMED
      colors: { bell: 0x5a5e63, bellTop: 0x5a5e63, base: 0x2a2c2f, boss: 0x3a3d41, magnet: 0x8c9198, shaft: 0xc4c8cd, accent: null },
      finish: { bellRough: 0.62, bellMetal: 0.25 },        // matte anodised
      logo: { text: 'UNUSUAL', sub: 'MACHINES', color: '#f4f5f6', h: 5.2, y: 0.42 },
      lod: 1
    },
    XING2_1404: {
      name: 'iFlight XING2 1404 3800KV',
      bellD: 19.9,          // iFlight "19.9 x 18.4 mm"
      bodyH: 13.5,          // RaceDayQuads "19.9 x 13.5 mm" body
      overallH: 18.4,       // iFlight overall incl. shaft
      baseH: 2.0, baseD: 14.5, baseGap: 0.6,
      baseLobes: 4, baseLobeR: 8.6, baseLobeWidth: 0.6, baseWindows: false,
      mount: { pcd: 9.0, screwD: 2.0, angle: Math.PI / 4 },    // iFlight "9 x 9 mm, phi 2 mm" = holes 9 mm apart across the centre
      wall: 0.9, topT: 1.3, fillet: 1.6,
      windows: { n: 6, rIn: 3.4, rOut: 7.6, spoke: 1.9, round: 2 },
      hubBossR: 2.6, hubBossH: 0.5,
      stator: { d: 14, h: 4, teeth: 9, yokeIn: 3.6, yokeOut: 4.9, toothW: 2.0, tipIn: 6.2, slotOpen: 1.1 },   // 1404, 9N12P (iFlight)
      magnets: { n: 12, t: 1.0, h: 5.0 },
      shaft: { d: 1.5, thread: 0, hollow: 0, clip: true },
      nut: { type: 'none' },                                   // 1.5 mm press-fit prop (Gemfan 4024 1.5 mm)
      propHubH: 5.5,
      leads: { n: 3, d: 0.95, len: 22, colors: [0x141517, 0x141517, 0x141517], angle: 0 },   // 26 AWG black (photo 059)
      colors: { bell: 0x3a4148, bellTop: 0x18b2b0, base: 0x4f6f74, boss: 0x2f3a40, magnet: 0x8c9198, shaft: 0xc4c8cd, accent: 0x18b2b0 },
      finish: { bellRough: 0.4, bellMetal: 0.4, topRough: 0.3, topMetal: 0.45 },
      logo: { text: 'XING', sub: 'iFLIGHT', color: '#cfd6dc', h: 4.4, y: 0.5, italic: true, font: 'italic 900 140px "DejaVu Sans", Arial, sans-serif' },
      lod: 1
    },
    F2004: {
      // 5-INCH DEFAULT MOTOR (designer, 2026-11-08: 2004-size, 12x12 M2, 1.5 mm shaft, T-mount props).
      name: 'T-Motor F2004 3000KV',
      bellD: 24.3,          // "Dimensions: phi 24.3 x 17.25 mm" (fpv24.com, hobbyrc.co.uk, racedayquads.com listings)
      bodyH: 15.3,          // ESTIMATED split of the 17.25 mm: body 15.3 + 1.95 mm of 1.5 mm shaft above the bell (product photo)
      overallH: 17.25,
      baseH: 2.6, baseD: 17.5, baseGap: 0.7,               // narrow four-lobed dark base (product photo), ESTIMATED
      baseLobes: 4, baseLobeR: 9.0, baseLobeWidth: 0.6, baseWindows: false,
      mount: { pcd: 12.0, screwD: 2.0, angle: Math.PI / 4 },  // "12x12" M2 = holes 12 mm apart across the centre; matches the MOD-L 5" pad circle
      wall: 1.1, topT: 1.5, fillet: 1.2,
      groove: { y: 0.86, depth: 0.25, w: 0.5 },            // machined ring groove near the top of the bell (photo)
      windows: { n: 5, rIn: 3.9, rOut: 10.2, spoke: 2.2, round: 2, sweep: 0.38 },   // five swept windows (photo)
      edgeAccent: 0x1e8fe0,                                 // bright blue machined chamfers on the windows (photo; listing colour "black/blue")
      edgeBevel: 0.35,
      hubBossR: 4.6, hubBossH: 0.6,
      tmount: { holes: 2, spacing: 6.6, d: 1.6 },           // T-mount prop screws (M2 threads into the bell); spacing ESTIMATED
      stator: { d: 20, h: 4, teeth: 12, yokeIn: 5.8, yokeOut: 7.3, toothW: 2.3, tipIn: 8.8, slotOpen: 1.3 },   // 2004-size, 12N14P (listing)
      magnets: { n: 14, t: 1.2, h: 5.0 },
      shaft: { d: 1.5, thread: 0, hollow: 0, clip: true },  // 1.5 mm shaft (product title); some listings say 3 mm (1700KV variant)
      nut: { type: 'none' },
      propHubH: 5.0,        // HQ T5x2x3 hub thickness
      leads: { n: 3, d: 1.5, len: 26, colors: [0x141517, 0x141517, 0x141517], angle: 0 },   // 20 AWG black ASSUMED
      colors: { bell: 0x52575d, bellTop: 0x1c1d20, base: 0x2a2c30, boss: 0x34373b, magnet: 0x8c9198, shaft: 0xc4c8cd, accent: 0x1e8fe0 },
      finish: { bellRough: 0.45, bellMetal: 0.35, topRough: 0.4, topMetal: 0.35 },
      logo: { text: 'F2004', sub: 'TO THE FORE', color: '#eceef0', h: 6.0, y: 0.38, italic: true, font: 'italic 900 150px "DejaVu Sans", Arial, sans-serif' },
      lod: 1
    },
    TC2004: {
      // BrotherHobby TC2004 (1700/1950/2100/3150KV): M2 12x12, 12N14P, M1.5 prop-adapter thread, 14.9 g with short wire
      // (getfpv / pyrodrone / rotorvillage listings). Bell size and colours NOT verified: geometry copied from F2004, neutral colours.
      name: 'BrotherHobby TC2004 (colours not verified)',
      base: 'F2004',
      edgeAccent: null,
      colors: { bell: 0x55595e, bellTop: 0x55595e, base: 0x2a2c30, boss: 0x34373b, magnet: 0x8c9198, shaft: 0xc4c8cd, accent: null },
      finish: { bellRough: 0.45, bellMetal: 0.6 },
      logo: { text: 'BROTHERHOBBY', sub: 'TC 2004', color: '#e9ebee', h: 4.6, y: 0.45, font: 'bold 96px "DejaVu Sans", Arial, sans-serif' },
      windows: { n: 6, rIn: 3.9, rOut: 10.0, spoke: 2.0, round: 2, sweep: 0 }
    },
    generic2203: {
      name: 'Generic 2203-size (MOD-L 5" Dave_C option)',
      bellD: 27.0, bodyH: 14.6, overallH: 26.0,   // ESTIMATED typical 2203
      baseH: 2.4, baseD: 19, baseGap: 0.7,
      baseLobes: 4, baseLobeR: 10.0, baseLobeWidth: 0.55, baseWindows: true,
      mount: { pcd: 12.0, screwD: 2.0, angle: Math.PI / 4 },
      wall: 1.1, topT: 1.5, fillet: 1.8,
      windows: { n: 6, rIn: 5.0, rOut: 11.2, spoke: 2.4, round: 2 },
      hubBossR: 4.0, hubBossH: 0.5,
      stator: { d: 22, h: 3, teeth: 12, yokeIn: 7.0, yokeOut: 8.5, toothW: 2.5, tipIn: 9.9, slotOpen: 1.4 },
      magnets: { n: 14, t: 1.3, h: 4.2 },
      shaft: { d: 5, thread: 8, hollow: 1.4, clip: true },
      nut: { type: 'nyloc', af: 8, flangeD: 11, h: 6.2, color: 0x9da3aa, insert: 0x1f3fa0 },
      propHubH: 6.5,
      leads: { n: 3, d: 1.7, len: 24, colors: [0x141517, 0x141517, 0x141517], angle: 0 },
      colors: { bell: 0x8d949c, bellTop: 0x8d949c, base: 0x2a2c30, boss: 0x34373b, magnet: 0x8c9198, shaft: 0xc4c8cd, accent: 0x2a2c30 },
      finish: { bellRough: 0.35, bellMetal: 0.8 },
      logo: null, lod: 1
    }
  };

  var PROP_PRESETS = {
    HQ_T5x2x3: {
      // 5-INCH DEFAULT PROP (designer, 2026-11-08). HQProp Durable T5x2x3, T-mount, 1.5 mm shaft.
      name: 'HQProp T5x2x3 (T-mount)',
      D: 127, pitch: 2.0 * 25.4, blades: 3,
      hubD: 9.8, hubH: 5.0, bore: 1.5,                              // 9.8 mm hub, 5 mm thick (most listings; one says 4.6), 2.5 g
      tmount: { holes: 2, spacing: 6.6, screwD: 2.0 },              // 3-hole T-mount 1.9 / 1.5 / 1.9 mm (listings); hole spacing ESTIMATED
      chordRoot: 6.4, chordMax: 11.6, tMax: 0.45, chordTip: 8.6,    // thin ultralight blade, ESTIMATED from product photos
      tipStart: 0.86, thickRoot: 1.9, thickTip: 0.5, camber: 0.04,
      lePull: 1.4,
      color: 0x2f86d6, opacity: 0.76, hubColor: null,               // Blue (getfpv / racedayquads listing colour); grey also sold
      nR: 26, nC: 9
    },
    HQ_V2S_5x43x3: {
      name: 'HQProp V2S 5x4.3x3',
      D: 127, pitch: 4.3 * 25.4, blades: 3,
      hubD: 12.8, hubH: 6.5, bore: 5,                              // retailer listings
      chordRoot: 8.6, chordMax: 14.5, tMax: 0.42, chordTip: 11.0,   // ESTIMATED from product photos
      tipStart: 0.86, thickRoot: 2.4, thickTip: 0.7, camber: 0.045,
      lePull: 1.6,                                                 // leading-edge sweep at the tip (mm), ESTIMATED
      color: 0xf2c11d, opacity: 0.78, hubColor: null,               // Yellow (in stock 2026-11-08); Purple 0x7b3fb5 also in stock
      nR: 26, nC: 9
    },
    GEMFAN_4024_2: {
      name: 'Gemfan Hurricane 4024 2-blade (1.5 mm)',
      D: 102.2, pitch: 2.4 * 25.4, blades: 2,
      hubD: 8.8, hubH: 5.5, bore: 1.5,                             // hub 5.5 mm (reseller); hub diameter ESTIMATED
      chordRoot: 7.0, chordMax: 13.4, tMax: 0.48, chordTip: 10.0,   // max width 13.38 mm (reseller), planform ESTIMATED
      tipStart: 0.84, thickRoot: 2.0, thickTip: 0.6, camber: 0.04,
      lePull: 1.2,
      color: 0x55b9e6, opacity: 0.72, hubColor: null,               // translucent blue (reference kit photos 159-161)
      nR: 24, nC: 9
    }
  };

  var ALIASES = { generic2004: 'F2004', quad5: 'F2004', QUAD5_DEFAULT: 'F2004' };
  function resolve(presets, params) {
    if (typeof params === 'string') params = { preset: params };
    params = params || {};
    var name = ALIASES[params.preset] && !presets[params.preset] ? ALIASES[params.preset] : params.preset;
    var base = name ? presets[name] : null;
    if (name && !base) throw new Error('unknown preset ' + params.preset);
    if (base && base.base) base = extend({}, presets[base.base], base);   // one level of preset inheritance
    var out = extend({}, base || {}, params);
    delete out.base;
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // Motor parts
  // ---------------------------------------------------------------------------------------------
  // Bell shell (side wall + rounded top shoulder), as a lathe. Covers r from (R - fillet) to R; the windowed top disc fills the centre.
  function bellShellGeometry(P, y0, y1, segs) {
    var R = P.bellD / 2, f = P.fillet, w = P.wall, tt = P.topT, pts = [];
    var V = function (x, y) { pts.push(new THREE.Vector2(x, y)); };
    V(R - w, y0 + 0.4);                 // inner bottom
    V(R - w + 0.3, y0);                 // inner chamfer
    V(R - 0.35, y0);                    // outer chamfer
    V(R, y0 + 0.35);
    V(R, y1 - f);                       // straight side
    for (var i = 1; i <= 6; i++) { var a = i / 6 * Math.PI / 2; V(R - f + f * Math.cos(a), y1 - f + f * Math.sin(a)); }   // top fillet
    V(R - f - 0.02, y1);
    V(R - f - 0.02, y1 - tt);           // under the top plate
    V(R - w, y1 - tt - 0.6);
    V(R - w, y0 + 0.4);
    var g = new THREE.LatheGeometry(pts, segs);
    return g;
  }

  // Windowed top disc of the bell.
  function bellTopGeometry(P, yTop, curveSegs) {
    var R = P.bellD / 2 - P.fillet + 0.05, W = P.windows, s = new THREE.Shape();
    s.absarc(0, 0, R, 0, TAU, false);
    if (W && W.n > 0) {
      for (var i = 0; i < W.n; i++) {
        var a0 = (i + 0.5) * TAU / W.n, poly = [], k;
        var half = function (r) { return Math.PI / W.n - Math.asin(Math.min(0.95, (W.spoke / 2) / r)); };
        var sw = W.sweep || 0;   // spokes swept: outer arc rotated by sw relative to the inner arc
        for (k = 0; k <= 5; k++) { var aa = a0 + sw - half(W.rOut) + 2 * half(W.rOut) * k / 5; poly.push([W.rOut * Math.cos(aa), W.rOut * Math.sin(aa)]); }
        if (sw) { var rm = (W.rIn + W.rOut) / 2; poly.push([rm * Math.cos(a0 + sw * 0.45 - half(rm)), rm * Math.sin(a0 + sw * 0.45 - half(rm))]); }
        for (k = 3; k >= 0; k--) { var ab = a0 - half(W.rIn) + 2 * half(W.rIn) * k / 3; poly.push([W.rIn * Math.cos(ab), W.rIn * Math.sin(ab)]); }
        if (sw) { var rm2 = (W.rIn + W.rOut) / 2; poly.push([rm2 * Math.cos(a0 + sw * 0.45 + half(rm2)), rm2 * Math.sin(a0 + sw * 0.45 + half(rm2))]); }
        s.holes.push(polyPath(chaikin(poly, W.round == null ? 2 : W.round)));
      }
    }
    s.holes.push(circlePath(0, 0, P.shaft.d / 2 + 0.05));
    var bev = P.edgeBevel || 0;
    var g = new THREE.ExtrudeGeometry(s, { depth: P.topT - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8, bevelOffset: -bev * 0.8, bevelSegments: 1, curveSegments: curveSegs });
    if (bev) g.translate(0, 0, bev);
    return layFlat(g, yTop - P.topT);
  }

  // Stator lamination profile (yoke ring + T teeth) and copper coils around each tooth shank.
  function statorGeometries(P, y0, lod) {
    var S = P.stator, N = S.teeth, rS = S.d / 2, pts = [];
    for (var i = 0; i < N; i++) {
      var a = i * TAU / N, tipHalf = Math.PI / N - (S.slotOpen / 2) / rS;
      var wYo = (S.toothW / 2) / S.yokeOut, wTi = (S.toothW / 2) / S.tipIn, j;
      var P2 = function (r, ang) { pts.push([r * Math.cos(ang), r * Math.sin(ang)]); };
      P2(S.yokeOut, a - wYo); P2(S.tipIn, a - wTi); P2(S.tipIn, a - tipHalf + 0.02);
      for (j = 0; j <= 4; j++) P2(rS, a - tipHalf + 2 * tipHalf * j / 4);
      P2(S.tipIn, a + tipHalf - 0.02); P2(S.tipIn, a + wTi); P2(S.yokeOut, a + wYo);
      var aNext = (i + 1) * TAU / N;
      for (j = 1; j <= 2; j++) P2(S.yokeOut, a + wYo + (aNext - wYo - (a + wYo)) * j / 3);
    }
    var shape = new THREE.Shape(); shape.moveTo(pts[0][0], pts[0][1]);
    for (var p = 1; p < pts.length; p++) shape.lineTo(pts[p][0], pts[p][1]);
    shape.closePath();
    shape.holes.push(circlePath(0, 0, S.yokeIn));
    var lam = layFlat(new THREE.ExtrudeGeometry(shape, { depth: S.h, bevelEnabled: false, curveSegments: lod > 0 ? 16 : 8 }), y0);

    // coils: rounded-rectangle loop cross-section (tangential x vertical), extruded along the tooth (radial)
    var rMid = (S.yokeOut + S.tipIn) / 2, slotW = rMid * TAU / N - S.toothW;
    var cw = Math.max(0.35, Math.min(slotW * 0.44, 2.2));   // coil build-up each side of the shank
    var W = S.toothW + 2 * cw, Hc = S.h + 2 * Math.min(cw, 1.4), L = S.tipIn - S.yokeOut - 0.25;
    var cs = new THREE.Shape(), rr = Math.min(cw, Hc / 2) * 0.9;
    cs.moveTo(-W / 2 + rr, -Hc / 2); cs.lineTo(W / 2 - rr, -Hc / 2); cs.quadraticCurveTo(W / 2, -Hc / 2, W / 2, -Hc / 2 + rr);
    cs.lineTo(W / 2, Hc / 2 - rr); cs.quadraticCurveTo(W / 2, Hc / 2, W / 2 - rr, Hc / 2);
    cs.lineTo(-W / 2 + rr, Hc / 2); cs.quadraticCurveTo(-W / 2, Hc / 2, -W / 2, Hc / 2 - rr);
    cs.lineTo(-W / 2, -Hc / 2 + rr); cs.quadraticCurveTo(-W / 2, -Hc / 2, -W / 2 + rr, -Hc / 2);
    var coils = [];
    for (var t = 0; t < N; t++) {
      var g = new THREE.ExtrudeGeometry(cs, { depth: L, bevelEnabled: false, curveSegments: lod > 0 ? 3 : 2 });
      // shape x -> tangential, shape y -> vertical, extrusion z -> radial
      var m = new THREE.Matrix4(), ang = t * TAU / N;
      var basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(-Math.sin(ang), 0, -Math.cos(ang)),   // tangential
        new THREE.Vector3(0, 1, 0),                              // vertical
        new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang)));    // radial (matches layFlat: shape y -> -z)
      m.copy(basis).setPosition(S.yokeOut * Math.cos(ang) + 0.1 * Math.cos(ang), y0 + S.h / 2, -(S.yokeOut + 0.1) * Math.sin(ang));
      g.applyMatrix4(m);
      coils.push(g);
    }
    return { lam: lam, coils: mergeGeoms(coils), coilTop: y0 + S.h / 2 + Hc / 2, coilBottom: y0 + S.h / 2 - Hc / 2 };
  }

  // Lobed base plate with screw holes (and optional lightening windows).
  function baseGeometry(P, lod) {
    var n = P.baseLobes || 4, r0 = P.baseD / 2, rl = P.baseLobeR, wl = P.baseLobeWidth || 0.55, pts = [], M = 96;
    var ang0 = P.mount.angle || 0;
    for (var i = 0; i < M; i++) {
      var th = i / M * TAU, bump = 0;
      for (var k = 0; k < n; k++) {
        var d = Math.atan2(Math.sin(th - (ang0 + k * TAU / n)), Math.cos(th - (ang0 + k * TAU / n)));
        var b = Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(d) / wl * Math.PI / 2)));
        bump = Math.max(bump, Math.pow(b, 0.6));
      }
      var r = r0 + (rl - r0) * bump;
      pts.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    var s = polyPath(pts, THREE.Shape);
    var pr = P.mount.pcd / 2, hr = P.mount.screwD / 2 + 0.1;
    for (var j = 0; j < 4; j++) { var a = ang0 + j * TAU / 4; s.holes.push(circlePath(pr * Math.cos(a), pr * Math.sin(a), hr)); }
    s.holes.push(circlePath(0, 0, P.shaft.d / 2 + 0.9));
    if (P.baseWindows) {
      for (var w = 0; w < 4; w++) {
        var aw = ang0 + (w + 0.5) * TAU / 4, rin = P.shaft.d / 2 + 2.2, rout = r0 - 1.6, poly = [];
        if (rout - rin < 1.5) break;
        for (var q = 0; q <= 3; q++) { var t1 = aw - 0.42 + 0.84 * q / 3; poly.push([rout * Math.cos(t1), rout * Math.sin(t1)]); }
        poly.push([rin * Math.cos(aw), rin * Math.sin(aw)]);
        s.holes.push(polyPath(chaikin(poly, 2)));
      }
    }
    var g = new THREE.ExtrudeGeometry(s, { depth: P.baseH - 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 1, curveSegments: lod > 0 ? 12 : 6 });
    g.translate(0, 0, 0.25);
    return layFlat(g, 0);
  }

  // Flanged nyloc prop nut, origin at its underside.
  function makeNut(N, lod) {
    var g = new THREE.Group(), af = N.af, rc = af / Math.sqrt(3);   // hex circumradius from across-flats
    var steel = stdMat(N.color, 0.35, 0.85);
    var fl = new THREE.Mesh(new THREE.CylinderGeometry(N.flangeD / 2 - 0.3, N.flangeD / 2, 1.2, lod > 0 ? 32 : 16), steel); fl.position.y = 0.6; g.add(shadowed(fl));
    var hex = new THREE.Mesh(new THREE.CylinderGeometry(rc, rc, N.h - 2.6, 6), steel); hex.position.y = 1.2 + (N.h - 2.6) / 2; g.add(shadowed(hex));
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(af / 2 - 1.0, af / 2 - 0.4, 1.4, lod > 0 ? 24 : 12), steel); cap.position.y = N.h - 0.7; g.add(shadowed(cap));
    if (N.insert != null) {
      var ins = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.35, 6, 20), stdMat(N.insert, 0.7, 0.0)); ins.rotation.x = Math.PI / 2; ins.position.y = N.h + 0.02; g.add(ins);
    }
    return g;
  }

  // Motor leads: three silicone wires leaving the stator end between two base lobes, dropping onto the arm.
  function makeLeads(P, yExit, lod) {
    var L = P.leads, g = new THREE.Group(); if (!L || !L.n) return g;
    var ang = L.angle || 0, dir = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang)), side = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    var rStart = P.stator.d / 2 - 1.5, rOut = P.baseD / 2 + 1.2;
    for (var i = 0; i < L.n; i++) {
      var off = (i - (L.n - 1) / 2) * L.d * 1.02;
      var p0 = dir.clone().multiplyScalar(rStart).addScaledVector(side, off).setY(yExit);
      var p1 = dir.clone().multiplyScalar(rOut).addScaledVector(side, off).setY(yExit - 0.3);
      var p2 = dir.clone().multiplyScalar(rOut + 4).addScaledVector(side, off).setY(L.d / 2 + 0.6);
      var p3 = dir.clone().multiplyScalar(rOut + L.len).addScaledVector(side, off * 1.05).setY(L.d / 2 + 0.05);
      var curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      var m = new THREE.Mesh(new THREE.TubeGeometry(curve, lod > 0 ? 18 : 8, L.d / 2, lod > 0 ? 7 : 5, false), stdMat(L.colors[i % L.colors.length], 0.55, 0.0));
      g.add(shadowed(m));
      // tinned end
      var tip = new THREE.Mesh(new THREE.CylinderGeometry(L.d * 0.32, L.d * 0.32, 2.2, 6), stdMat(0xb9bcc0, 0.4, 0.9));
      tip.position.copy(p3).addScaledVector(dir, 1.1); tip.rotation.z = Math.PI / 2; tip.rotation.y = ang; g.add(tip);
    }
    return g;
  }

  // ---------------------------------------------------------------------------------------------
  // makeOutrunner
  // ---------------------------------------------------------------------------------------------
  function dark0() { return stdMat(0x101113, 0.8, 0.1); }
  function makeOutrunner(params) {
    var P = resolve(MOTOR_PRESETS, params);
    var lod = P.lod == null ? 1 : P.lod, segs = lod > 0 ? 56 : 28;
    var C = P.colors, Fin = P.finish || {};
    var g = new THREE.Group(); g.name = 'motor:' + (P.preset || P.name || 'custom');
    var rotor = new THREE.Group(); rotor.name = 'rotor'; g.add(rotor);
    var R = P.bellD / 2;
    var yBell0 = P.baseH + P.baseGap, yTop = P.bodyH;
    var shaftAbove = P.overallH - P.bodyH;

    var matBell = stdMat(C.bell, Fin.bellRough != null ? Fin.bellRough : 0.5, Fin.bellMetal != null ? Fin.bellMetal : 0.6);
    var matTop = (C.bellTop != null && C.bellTop !== C.bell) ? stdMat(C.bellTop, Fin.topRough != null ? Fin.topRough : 0.3, Fin.topMetal != null ? Fin.topMetal : 0.8) : matBell;
    var matBase = stdMat(C.base, 0.55, 0.5), matBoss = stdMat(C.boss, 0.5, 0.6);
    var matShaft = stdMat(C.shaft, 0.28, 0.92);
    var lamSide = mat('lamSide', function () { return new THREE.MeshStandardMaterial({ color: 0xffffff, map: laminationTexture(), roughness: 0.45, metalness: 0.75 }); });
    var lamCap = stdMat(0x8a9096, 0.4, 0.8);
    var cuMat = mat('copper', function () { return new THREE.MeshStandardMaterial({ color: 0xffffff, map: copperTexture(6), roughness: 0.38, metalness: 0.6, emissive: 0x6a3210, emissiveIntensity: 0.55 }); });
    var dark = stdMat(0x101113, 0.8, 0.1);

    // --- bell (rotor): shell, windowed top, hub boss, magnets, inner dark lining, logo ---
    rotor.add(shadowed(new THREE.Mesh(bellShellGeometry(P, yBell0, yTop, segs), matBell)));
    var matEdge = P.edgeAccent != null ? stdMat(P.edgeAccent, 0.25, 0.7, { emissive: P.edgeAccent, emissiveIntensity: 0.18 }) : matTop;
    rotor.add(shadowed(new THREE.Mesh(bellTopGeometry(P, yTop, lod > 0 ? 18 : 8), [matTop, matEdge])));
    if (P.groove) {   // machined ring groove on the bell side
      var cut = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.01, R + 0.01, P.groove.w, segs, 1, true), stdMat(0x1a1c1f, 0.6, 0.4));
      cut.position.y = yBell0 + (yTop - yBell0) * P.groove.y; rotor.add(cut);
    }
    if (P.hubBossR) {
      var boss = new THREE.Mesh(new THREE.CylinderGeometry(P.hubBossR - 0.4, P.hubBossR, P.hubBossH, segs / 2), matTop);
      boss.position.y = yTop + P.hubBossH / 2; rotor.add(shadowed(boss));
      if (P.tmount && P.tmount.holes) {
        for (var th0 = 0; th0 < P.tmount.holes; th0++) {
          var ta = th0 * TAU / P.tmount.holes, hd = new THREE.Mesh(new THREE.CircleGeometry(P.tmount.d / 2, 12), dark0());
          hd.rotation.x = -Math.PI / 2; hd.position.set(P.tmount.spacing / 2 * Math.cos(ta), yTop + P.hubBossH + 0.02, -P.tmount.spacing / 2 * Math.sin(ta)); rotor.add(hd);
        }
      }
    }
    var lining = new THREE.Mesh(new THREE.CylinderGeometry(R - P.wall - 0.02, R - P.wall - 0.02, yTop - P.topT - yBell0 - 0.3, segs, 1, true), stdMat(0x1a1b1e, 0.7, 0.3, { side: THREE.BackSide }));
    lining.position.y = (yTop - P.topT + yBell0) / 2; rotor.add(lining);
    // magnets: curved segments as thin boxes on the inside of the wall
    var Mg = P.magnets, rM = R - P.wall - Mg.t / 2 - 0.02, magGeoms = [], magW = (TAU * rM / Mg.n) * 0.86;
    var yMag = Math.min(yTop - P.topT - 0.6 - Mg.h / 2, yBell0 + 0.8 + Mg.h / 2 + 2.5);
    for (var i = 0; i < Mg.n; i++) {
      var a = (i + 0.5) * TAU / Mg.n, bg = new THREE.BoxGeometry(magW, Mg.h, Mg.t);
      bg.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2 + a).setPosition(rM * Math.cos(a), yMag, -rM * Math.sin(a)));
      magGeoms.push(bg);
    }
    rotor.add(shadowed(new THREE.Mesh(mergeGeoms(magGeoms), stdMat(C.magnet, 0.35, 0.85)), false, true));
    if (P.logo) {
      var lt = logoTexture(P.logo);
      var lband = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, P.logo.h, segs, 1, true),
        mat('logoMat|' + P.logo.text + P.logo.color, function () { return new THREE.MeshStandardMaterial({ map: lt, transparent: false, alphaTest: 0.5, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -1 }); }));   // opaque decal (alpha-tested, not blended)
      lband.position.y = yBell0 + 0.35 + (yTop - P.fillet - yBell0 - 0.35) * P.logo.y;
      lband.rotation.y = Math.PI * 0.75; rotor.add(lband);
    }
    if (P.accentRing && C.accent != null) {
      var ar = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 1.4, segs, 1, true), stdMat(C.accent, 0.4, 0.6));
      ar.position.y = yBell0 + 1.4; rotor.add(ar);
    }

    // --- stator (static): laminations, copper coils, holder boss ---
    var S = P.stator;
    var yStator = yMag - S.h / 2;
    var st = statorGeometries(P, yStator, lod);
    g.add(shadowed(new THREE.Mesh(st.lam, [lamCap, lamSide])));
    g.add(shadowed(new THREE.Mesh(st.coils, cuMat)));
    var holderH = yStator - P.baseH + 0.2;
    if (holderH > 0) {
      var holder = new THREE.Mesh(new THREE.CylinderGeometry(S.yokeIn + 0.2, S.yokeIn + 0.8, holderH, segs / 2), matBoss);
      holder.position.y = P.baseH - 0.1 + holderH / 2; g.add(shadowed(holder));
    }
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(S.yokeIn - 0.05, S.yokeIn - 0.05, S.h + 0.6, segs / 2), matBoss);
    tube.position.y = yStator + S.h / 2; g.add(tube);

    // --- base ---
    g.add(shadowed(new THREE.Mesh(baseGeometry(P, lod), matBase)));

    // --- shaft, thread, hollow end, C-clip ---
    var sr = P.shaft.d / 2, y0s = -0.9, yS1 = yTop + shaftAbove;
    var plainTop = P.shaft.thread > 0 ? yS1 - P.shaft.thread : yS1;
    var sh = new THREE.Mesh(new THREE.CylinderGeometry(sr * (P.shaft.thread > 0 ? 0.86 : 1), sr * (P.shaft.thread > 0 ? 0.86 : 1), plainTop - y0s, 20), matShaft);
    sh.position.y = (plainTop + y0s) / 2; rotor.add(shadowed(sh));
    if (P.shaft.thread > 0) {
      var thLen = P.shaft.thread;
      var thMat = mat('thread' + thLen, function () { return new THREE.MeshStandardMaterial({ color: 0xffffff, map: threadTexture(thLen), roughness: 0.32, metalness: 0.9 }); });
      var th = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, P.shaft.thread, 24, 1, true), thMat);
      th.position.y = yS1 - P.shaft.thread / 2; rotor.add(shadowed(th));
      var endCap = new THREE.Mesh(new THREE.RingGeometry(P.shaft.hollow ? P.shaft.hollow / 2 : 0.01, sr, 20), matShaft); endCap.rotation.x = -Math.PI / 2; endCap.position.y = yS1; rotor.add(endCap);
      if (P.shaft.hollow) { var hole = new THREE.Mesh(new THREE.CircleGeometry(P.shaft.hollow / 2, 12), dark); hole.rotation.x = -Math.PI / 2; hole.position.y = yS1 - 0.3; rotor.add(hole); }
    }
    if (P.shaft.clip) {
      var clip = new THREE.Mesh(new THREE.TorusGeometry(sr + 0.35, Math.max(0.18, sr * 0.12), 6, 18, TAU * 0.82), stdMat(0x1c1d20, 0.5, 0.6));
      clip.rotation.x = Math.PI / 2; clip.position.y = -0.55; rotor.add(clip);
    }

    // --- prop nut (placed on top of the prop hub) ---
    var nutTop = yTop;
    if (P.nut && P.nut.type === 'nyloc' && P.showNut !== false) {
      var nut = makeNut(P.nut, lod); nut.position.y = yTop + (P.hubBossH || 0) + (P.propHubH || 0); rotor.add(nut);
      nutTop = nut.position.y + P.nut.h;
    }

    // --- leads ---
    if (P.showLeads !== false) g.add(makeLeads(P, Math.max(P.baseH + 0.6, st.coilBottom + 0.3), lod));

    // --- optional screw heads under the arm (button head, hex socket) ---
    if (P.screwsBelow != null) {
      var hr = P.mount.screwD * 0.95, hh = P.mount.screwD * 0.55, pr = P.mount.pcd / 2;
      for (var k = 0; k < 4; k++) {
        if (P.screwHoles && P.screwHoles.indexOf(k) < 0) continue;   // e.g. [0, 2]: only the pair that lands on pad holes
        var aa = (P.mount.angle || 0) + k * TAU / 4;
        var head = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.8, hr, hh, 16), stdMat(0x2b2d31, 0.4, 0.8));
        head.position.set(pr * Math.cos(aa), -P.screwsBelow - hh / 2, -pr * Math.sin(aa)); g.add(shadowed(head));
      }
    }

    g.userData = { preset: P.preset || null, params: P, seatY: yTop + (P.hubBossH || 0), bellTopY: yTop, shaftTopY: yS1, nutTopY: nutTop, bellD: P.bellD, rotor: rotor };
    return g;
  }
  function makeMotor(name, over) { return makeOutrunner(extend({ preset: name }, over || {})); }

  // ---------------------------------------------------------------------------------------------
  // Propellers: closed, cambered, twisted blades (pitch-correct for CW and CCW) + hub
  // ---------------------------------------------------------------------------------------------
  var bladeCache = {};
  function bladeGeometry(Q, hand) {
    var key = JSON.stringify([Q.D, Q.pitch, Q.hubD, Q.chordRoot, Q.chordMax, Q.tMax, Q.chordTip, Q.tipStart, Q.thickRoot, Q.thickTip, Q.camber, Q.lePull, Q.nR, Q.nC, hand]);
    if (bladeCache[key]) return bladeCache[key];
    var R = Q.D / 2, r0 = Q.hubD / 2 - 1.2, nR = Q.nR, nC = Q.nC;
    function chord(t) {
      var c;
      if (t < Q.tMax) { var u = t / Q.tMax; c = Q.chordRoot + (Q.chordMax - Q.chordRoot) * Math.sin(u * Math.PI / 2); }
      else { var v = (t - Q.tMax) / (Q.tipStart - Q.tMax); c = Q.chordMax + (Q.chordTip - Q.chordMax) * Math.min(1, v) * Math.min(1, v); }
      if (t > Q.tipStart) { var w = (t - Q.tipStart) / (1 - Q.tipStart); c = Q.chordTip * Math.sqrt(Math.max(0.0, 1 - w * w)); }
      return Math.max(c, 0.25);
    }
    var pos = [], ring = 2 * nC;
    for (var i = 0; i <= nR; i++) {
      var t = Math.pow(i / nR, 0.85), r = r0 + (R - r0) * t;
      if (i === nR) r = R;
      var beta = Math.atan(Q.pitch / (TAU * Math.max(r, 4)));
      beta = Math.min(beta, 0.78);
      var c = chord(Math.min(t, 0.999)), th = Q.thickRoot + (Q.thickTip - Q.thickRoot) * t;
      th = Math.min(th, c * 0.2);
      var sLE = -0.40 * c + Q.lePull * t * t;          // chord-line position of the leading edge (negative = ahead)
      var ca = Math.cos(beta), sa = Math.sin(beta);
      var aMid = sLE + 0.5 * c;                          // mid-chord sits on the hub mid-plane
      // upper surface LE->TE, then lower surface TE->LE (closed loop)
      for (var s = 0; s < ring; s++) {
        var upper = s < nC, k = upper ? s : (ring - 1 - s);
        var u = 0.5 - 0.5 * Math.cos(Math.PI * k / (nC - 1));   // cosine spacing, LE and TE dense
        var cam = Q.camber * c * 4 * u * (1 - u);
        var xx = u, half = 5 * th * (0.2969 * Math.sqrt(xx) - 0.1260 * xx - 0.3516 * xx * xx + 0.2843 * xx * xx * xx - 0.1036 * xx * xx * xx * xx);
        half = Math.max(half, 0.04) * (upper ? 1 : -1);
        var along = sLE + u * c;                         // along the chord line from the shaft axis, LE at sLE
        var off = cam + half;                             // along the section normal (up = suction side)
        // chord direction d = (z: hand*cos, y: -sin); normal n = (z: hand*sin, y: cos); LE ahead and higher
        var z = hand * (along * ca + off * sa);
        var y = -(along - aMid) * sa + off * ca;
        pos.push(r, y, z);
      }
    }
    var idx = [];
    for (var a = 0; a < nR; a++) for (var b = 0; b < ring; b++) {
      var p0 = a * ring + b, p1 = a * ring + (b + 1) % ring, p2 = p0 + ring, p3 = p1 + ring;
      if (hand > 0) idx.push(p0, p2, p1, p1, p2, p3); else idx.push(p0, p1, p2, p1, p3, p2);
    }
    var tipC = pos.length / 3; var last = nR * ring, sx = 0, sy = 0, sz = 0;
    for (var e = 0; e < ring; e++) { sx += pos[(last + e) * 3]; sy += pos[(last + e) * 3 + 1]; sz += pos[(last + e) * 3 + 2]; }
    pos.push(sx / ring + 0.2, sy / ring, sz / ring);
    for (var f = 0; f < ring; f++) { var q0 = last + f, q1 = last + (f + 1) % ring; if (hand > 0) idx.push(q0, tipC, q1); else idx.push(q0, q1, tipC); }
    var gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setIndex(idx); gg.computeVertexNormals();
    bladeCache[key] = gg;
    return gg;
  }

  // dir: 'CW' or 'CCW' seen from above. Origin = hub underside on the shaft axis.
  function makeProp(params) {
    var Q = resolve(PROP_PRESETS, params);
    var hand = (Q.dir || 'CCW').toUpperCase() === 'CW' ? -1 : 1;
    var g = new THREE.Group(); g.name = 'prop:' + (Q.preset || Q.name || 'custom') + ':' + (hand > 0 ? 'CCW' : 'CW');
    var bladeMat = mat('prop|' + Q.color + '|' + Q.opacity, function () {
      return new THREE.MeshStandardMaterial({ color: Q.color, roughness: 0.22, metalness: 0.0, transparent: Q.opacity < 1, opacity: Q.opacity, side: THREE.DoubleSide, depthWrite: Q.opacity >= 1 });
    });
    var hubMat = mat('prophub|' + (Q.hubColor || Q.color), function () {
      return new THREE.MeshStandardMaterial({ color: Q.hubColor || Q.color, roughness: 0.35, metalness: 0.0 });   // hub opaque (designer: only blades translucent)
    });
    // hub: lathe with chamfers, bore visible from above
    var hr = Q.hubD / 2, hh = Q.hubH, pts = [
      new THREE.Vector2(Q.bore / 2, 0), new THREE.Vector2(hr - 0.6, 0), new THREE.Vector2(hr, 0.6), new THREE.Vector2(hr, hh - 0.9),
      new THREE.Vector2(hr - 0.9, hh), new THREE.Vector2(Q.bore / 2, hh), new THREE.Vector2(Q.bore / 2, 0)];
    var hub = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), hubMat); g.add(shadowed(hub, true, false));
    var bg = bladeGeometry(Q, hand);
    for (var i = 0; i < Q.blades; i++) {
      var bl = new THREE.Mesh(bg, bladeMat); bl.castShadow = true;
      bl.rotation.y = i * TAU / Q.blades + (Q.phase || 0);
      bl.position.y = hh * 0.5;
      g.add(bl);
    }
    if (Q.tmount && Q.tmount.holes) {   // T-mount: M2 button-head screws through the hub into the bell
      for (var sI = 0; sI < Q.tmount.holes; sI++) {
        var sa2 = sI * TAU / Q.tmount.holes + Math.PI / 2, sd = Q.tmount.screwD;
        var sc = new THREE.Mesh(new THREE.CylinderGeometry(sd * 0.75, sd * 0.95, sd * 0.6, 14), stdMat(0x2b2d31, 0.35, 0.85));
        sc.position.set(Q.tmount.spacing / 2 * Math.cos(sa2), hh + sd * 0.3, -Q.tmount.spacing / 2 * Math.sin(sa2)); g.add(shadowed(sc));
        var hx = new THREE.Mesh(new THREE.CircleGeometry(sd * 0.32, 6), stdMat(0x08090a, 0.9, 0.0));
        hx.rotation.x = -Math.PI / 2; hx.position.set(sc.position.x, hh + sd * 0.6 + 0.02, sc.position.z); g.add(hx);
      }
    }
    // moulded text ring on the hub top (darker), cheap recognisability cue
    var ringCol = new THREE.Color(Q.hubColor || Q.color).multiplyScalar(0.78).getHex();
    var ring = new THREE.Mesh(new THREE.RingGeometry(Q.bore / 2 + 0.6, hr - 1.2, 32), stdMat(ringCol, 0.6, 0.0));
    ring.rotation.x = -Math.PI / 2; ring.position.y = hh + 0.02; g.add(ring);
    g.userData = { preset: Q.preset || null, params: Q, hand: hand, hubH: hh };
    return g;
  }

  // Convenience: motor + prop at (x, y, z) in parent, lead direction toward the frame centre by default.
  function mountMotorAndProp(parent, o) {
    var mOver = extend({}, o.motorOver || {});
    if (o.leadAngle != null) mOver.leads = extend({}, (MOTOR_PRESETS[o.motor] || {}).leads || {}, mOver.leads || {}, { angle: o.leadAngle });
    else if (o.x != null && o.z != null) mOver.leads = extend({}, (MOTOR_PRESETS[o.motor] || {}).leads || {}, mOver.leads || {}, { angle: Math.atan2(o.z, -o.x) });
    var m = makeMotor(o.motor, mOver); m.position.set(o.x || 0, o.y || 0, o.z || 0); parent.add(m);
    var p = null;
    if (o.prop) {
      p = makeProp(extend({ preset: o.prop, dir: o.dir || 'CCW' }, o.propOver || {}));
      p.position.set(o.x || 0, (o.y || 0) + m.userData.seatY, o.z || 0); parent.add(p);
    }
    return { motor: m, prop: p };
  }

  root.MotorModels = {
    makeOutrunner: makeOutrunner, makeMotor: makeMotor, makeProp: makeProp, mountMotorAndProp: mountMotorAndProp,
    MOTOR_PRESETS: MOTOR_PRESETS, PROP_PRESETS: PROP_PRESETS, ALIASES: ALIASES,
    QUAD5_DEFAULT: { motor: 'F2004', prop: 'HQ_T5x2x3' }, QUAD5_ALTERNATIVE: { motor: 'UM2207', prop: 'HQ_V2S_5x43x3' },
    version: '2026-11-08'
  };
})(typeof window !== 'undefined' ? window : this);
