document.getElementById("year").textContent = new Date().getFullYear();

(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  function updateLabel() {
    var dark = (root.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  updateLabel();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateLabel);

  toggle.addEventListener("click", function () {
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
    var next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (error) {}
    updateLabel();
    if (window.__updateDotColor) window.__updateDotColor();
  });
})();

// The full navigation remains visible when JavaScript is unavailable.
(function () {
  var button = document.querySelector('.menu-toggle');
  var menu = document.getElementById('main-menu');
  if (!button || !menu) return;
  button.hidden = false;
  document.documentElement.classList.add('has-menu');
  function closeMenu() {
    button.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
  }
  button.addEventListener('click', function () {
    var open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      button.focus();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);
})();
