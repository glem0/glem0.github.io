// Loaded before the app module (classic script, ES5 on purpose). If assets/app.js cannot load or
// parse (e.g. an old browser), replace the skeleton with a message instead of spinning forever.
// app.js sets data-app="ready" once it has booted. Kept as a file rather than inline so the page's
// Content-Security-Policy can stay `script-src 'self'` with no inline-script hash to maintain.
window.addEventListener('error', function (e) {
  if (document.documentElement.dataset.app === 'ready') return;
  var box = document.getElementById('error');
  var list = document.getElementById('list');
  var count = document.getElementById('count');
  if (!box || box.dataset.boot) return;
  box.dataset.boot = '1';
  box.hidden = false;
  box.textContent = "This browser couldn't start the search app (" + (e.message || 'script error') + '). Please try a current version of Chrome, Firefox, Safari or Edge.';
  if (list) { list.innerHTML = ''; list.setAttribute('aria-busy', 'false'); }
  if (count) count.textContent = 'Could not start';
});
