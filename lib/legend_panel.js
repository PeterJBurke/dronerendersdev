/* Collapsible left legend for the 5-inch quad render pages (designer, 2026-11-09: "make the left side legend not viewable by
 * default, but an option to view like a left side collapsable window").
 *
 * Load synchronously at the end of <head> with a plain script tag pointing at this file (lib/ relative to the page).
 * Optional data-target="panel" names the element to collapse (default id "legend").
 * - The legend is hidden by default; a "Legend" button at the top left opens it as a left-side panel that scrolls.
 * - #legend in the URL hash opens it on load. Escape closes it.
 * - After every toggle a resize event is dispatched so pages that lay out HTML callouts around the legend re-run them.
 * Written by tools/render/ui_chrome.py into every render page; edit here, not in the pages.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var TID = (me && me.getAttribute('data-target')) || 'legend';
  var css =
    'html:not(.lp-open) #' + TID + ' { display:none !important; }\n' +
    'html.lp-open #' + TID + ' { display:block !important; position:fixed !important; left:12px !important; top:54px !important; right:auto !important; bottom:auto !important;' +
    ' width:auto; max-width:min(380px, calc(100vw - 24px)) !important; max-height:calc(100vh - 66px) !important; overflow:auto !important;' +
    ' -webkit-overflow-scrolling:touch; overscroll-behavior:contain; box-sizing:border-box; z-index:20 !important; margin:0 !important;' +
    ' box-shadow:0 6px 24px rgba(0,0,0,0.18); }\n' +
    '#lpBtn { position:fixed; left:16px; top:16px; z-index:21; }\n' +
    '#lpBtn[aria-expanded="true"] { border-color:var(--muted, #888); }\n' +
    '@media (max-width: 700px) {\n' +
    '  #ctrls { left:104px !important; }\n' +
    '  html.lp-open #' + TID + ' { max-width:calc(100vw - 24px) !important; max-height:62vh !important; }\n' +
    '}\n';
  var st = document.createElement('style');
  st.id = 'lpStyle';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var root = document.documentElement;
  if (/(^|[#&,;])legend\b/i.test(location.hash || '')) root.classList.add('lp-open');

  function init() {
    var el = document.getElementById(TID);
    if (!el || document.getElementById('lpBtn')) return;
    var b = document.createElement('button');
    b.id = 'lpBtn';
    b.type = 'button';
    b.setAttribute('aria-controls', TID);
    function sync() {
      var open = root.classList.contains('lp-open');
      b.textContent = open ? 'Hide legend' : 'Legend';
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function set(open) {
      root.classList.toggle('lp-open', open);
      sync();
      try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }
    }
    b.addEventListener('click', function () { set(!root.classList.contains('lp-open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('lp-open')) set(false); });
    sync();
    document.body.insertBefore(b, document.body.firstChild);
    window.__legendPanel = { open: function () { set(true); }, close: function () { set(false); } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
