/* Part labels ("callouts") for the 5-inch quad render pages, in the style of quad4_ref_render.html: HTML label boxes
 * (panel background: white in light mode, dark in dark mode; bold title + muted second line) in two columns beside the
 * drone, with a leader line and a dot on the part (designer, 2026-11-09: "make the quad labels same style (white background
 * in box for the label)" and "allow toggle of labels with arrows on off").
 *
 * Load with a plain script tag (lib/ relative to the page). It
 *   - adds the CSS (same rules as quad4_ref_render.html) and, if the page has none, a #callouts layer;
 *   - binds a toolbar button #bLabels ("Labels on/off"); #nolabels in the URL hash starts with labels off;
 *     the state is the class "co-off" on <html>; window.__onLabels(on) is called after each change if the page defines it;
 *   - exposes Callouts.layout(camera, curView) for pages whose parts register anchors in window.__callouts:
 *       { t: 'title', s: 'second line', o: THREE.Object3D anchor, hide: { top: 1 } (optional: dashed, "(hidden below)") }
 *     An anchor whose object (or a parent) is invisible is not shown. Call layout() after each render.
 * Pages that lay out their own callouts (quad4_ref_render.html) use only the toggle.
 * Written for tools/render/gen_variants_modl5.py / onboard.py and tools/render/ui_chrome.py; edit here, not in the pages.
 */
(function () {
  'use strict';
  var css =
    ':root { --lead:#9aa3ad; }\n' +
    ':root[data-theme="light"] { --lead:#5d6570; }\n' +
    '#callouts { position:fixed; inset:0; pointer-events:none; z-index:1; }\n' +
    '#callouts svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }\n' +
    '#callouts svg polyline { fill:none; stroke:var(--lead); stroke-width:1.2; }\n' +
    '#callouts svg polyline.hid { stroke-dasharray:4 3; }\n' +
    '#callouts svg circle { fill:var(--bg); stroke:var(--lead); stroke-width:1.4; }\n' +
    '.co { position:absolute; background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:3px 7px; font-size:12px; line-height:1.3; white-space:nowrap; }\n' +
    '.co b { font-weight:600; }\n' +
    '.co span { display:block; color:var(--muted); font-size:11px; }\n' +
    '@media (max-width: 899px) { #callouts { display:none; } }\n' +
    'html.co-off #callouts { display:none !important; }\n';
  var st = document.createElement('style'); st.id = 'coStyle'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  var root = document.documentElement;
  if (/(^|[#&,;])nolabels\b/i.test(location.hash || '')) root.classList.add('co-off');

  function setOn(on) {
    root.classList.toggle('co-off', !on);
    if (typeof window.__onLabels === 'function') window.__onLabels(on);
  }
  function init() {
    var b = document.getElementById('bLabels');
    if (b && !b.__co) { b.__co = true; b.addEventListener('click', function () { setOn(root.classList.contains('co-off')); }); }
    if (typeof window.__onLabels === 'function') window.__onLabels(!root.classList.contains('co-off'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  var items = null, layer = null, svg = null, NS = 'http://www.w3.org/2000/svg';
  function build() {
    layer = document.getElementById('callouts');
    if (!layer) { layer = document.createElement('div'); layer.id = 'callouts'; document.body.appendChild(layer); }
    svg = layer.querySelector('svg');
    if (!svg) { svg = document.createElementNS(NS, 'svg'); layer.appendChild(svg); }
    items = (window.__callouts || []).map(function (c) {
      var d = document.createElement('div'); d.className = 'co'; d.innerHTML = '<b></b><span></span>';
      d.querySelector('b').textContent = c.t; d.querySelector('span').textContent = c.s || ''; layer.appendChild(d);
      var line = document.createElementNS(NS, 'polyline'); svg.appendChild(line);
      var dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', '3'); svg.appendChild(dot);
      return { c: c, el: d, line: line, dot: dot };
    });
  }
  function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  function show(it, on) { var v = on ? '' : 'none'; it.el.style.display = v; it.line.style.display = v; it.dot.style.display = v; }

  // Same algorithm as quad4_ref_render.html layoutCallouts(): split by screen side of the drone centre, stack each column
  // top-down without overlap, horizontal stub then a straight leader to the projected anchor.
  function layout(camera, curView, centre) {
    if (!window.THREE) return;
    if (!items) build();
    var W = window.innerWidth, H = window.innerHeight;
    if (W < 900 || root.classList.contains('co-off')) return;
    var legEl = document.getElementById('legend'), ctrEl = document.getElementById('ctrls');
    var leg = legEl ? legEl.getBoundingClientRect() : { right: 0 }, ctr = ctrEl ? ctrEl.getBoundingClientRect() : { bottom: 16 };
    camera.updateMatrixWorld();
    var cen = (centre || new THREE.Vector3(0, 20, 0)).clone().project(camera), cx = (cen.x + 1) / 2 * W;
    var L = [], R = [], v = new THREE.Vector3();
    items.forEach(function (it) {
      var c = it.c, ok = c.o && shown(c.o);
      if (ok) { c.o.updateMatrixWorld(); c.o.getWorldPosition(v); v.project(camera); ok = v.z < 1; }
      show(it, ok); if (!ok) return;
      it.x = (v.x + 1) / 2 * W; it.y = (1 - v.y) / 2 * H; it.w = it.el.offsetWidth; it.h = it.el.offsetHeight;
      var hid = c.hide && c.hide[curView];
      it.el.querySelector('span').textContent = (c.s || '') + (hid ? ' (hidden below)' : '');
      it.line.setAttribute('class', hid ? 'hid' : '');
      (it.x < cx ? L : R).push(it);
    });
    function maxW(a) { return a.reduce(function (m, c) { return Math.max(m, c.el.offsetWidth); }, 0); }
    var bottom = H - 10;
    function place(arr, top) {
      arr.sort(function (a, b) { return a.y - b.y; });
      var y = top; arr.forEach(function (c) { c.ly = Math.max(c.y - c.h / 2, y); y = c.ly + c.h + 8; });
      var lim = bottom; for (var i = arr.length - 1; i >= 0; i--) { arr[i].ly = Math.min(arr[i].ly, lim - arr[i].h); lim = arr[i].ly - 8; }
    }
    var minX = L.reduce(function (m, c) { return Math.min(m, c.x); }, 1e9), maxX = R.reduce(function (m, c) { return Math.max(m, c.x); }, -1e9);
    var opEl = document.getElementById('opts'), opL = opEl && opEl.getClientRects().length ? opEl.getBoundingClientRect().left - 14 : W - 16;   // Options panel (onboard.py)
    var lR = Math.max(minX - 40, leg.right + 14 + maxW(L)), rL = Math.min(maxX + 40, opL - maxW(R));
    place(L, 56); place(R, ctr.bottom + 12);
    L.forEach(function (c) { c.lx = lR - c.el.offsetWidth; c.ex = lR; });
    R.forEach(function (c) { c.lx = rL; c.ex = rL; });
    L.concat(R).forEach(function (c) {
      c.el.style.left = Math.round(c.lx) + 'px'; c.el.style.top = Math.round(c.ly) + 'px';
      var my = c.ly + c.h / 2, kx = c.ex + (R.indexOf(c) >= 0 ? -10 : 10);
      c.line.setAttribute('points', c.ex + ',' + my + ' ' + kx + ',' + my + ' ' + c.x.toFixed(1) + ',' + c.y.toFixed(1));
      c.dot.setAttribute('cx', c.x.toFixed(1)); c.dot.setAttribute('cy', c.y.toFixed(1));
    });
  }
  window.Callouts = { layout: layout, set: setOn };
})();
