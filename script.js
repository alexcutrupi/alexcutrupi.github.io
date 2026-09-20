document.getElementById("year").textContent = new Date().getFullYear();

// Force a fresh Gravatar fetch on every load instead of trusting any
// browser or CDN cache, so a newly-updated photo always shows up.
(function () {
  var avatar = document.getElementById("avatar");
  if (!avatar) return;
  var hash = avatar.getAttribute("data-gravatar-hash");
  if (!hash) return;
  avatar.src = "https://www.gravatar.com/avatar/" + hash + "?s=160&d=mp&t=" + Date.now();
})();

(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", function () {
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
    var next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (window.__updateDotColor) window.__updateDotColor();
  });
})();

// Interactive dot background: dots push away from the pointer and ease
// back to rest. Only runs with a real mouse and when motion is allowed;
// otherwise the plain CSS dot-grid in styles.css is left in place.
(function () {
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canHover || reducedMotion) return;

  var canvas = document.createElement("canvas");
  canvas.id = "dot-canvas";
  document.body.prepend(canvas);
  document.documentElement.classList.add("has-dot-canvas");

  var ctx = canvas.getContext("2d");
  var spacing = 24;
  var radius = 90;
  var maxPush = 16;
  var ease = 0.18;
  var dotColor = "0,0,0";
  var dots = [];
  var mouse = { x: -9999, y: -9999 };
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function readDotColor() {
    var hex = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-text")
      .trim();
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    dotColor = m
      ? parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16)
      : "128,128,128";
  }

  window.__updateDotColor = readDotColor;

  function buildGrid() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cols = Math.ceil(w / spacing) + 1;
    var rows = Math.ceil(h / spacing) + 1;
    dots = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ox = c * spacing;
        var oy = r * spacing;
        dots.push({ ox: ox, oy: oy, x: ox, y: oy });
      }
    }
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(" + dotColor + ",0.16)";

    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var dx = d.ox - mouse.x;
      var dy = d.oy - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var targetX = d.ox;
      var targetY = d.oy;

      if (dist < radius) {
        var force = (radius - dist) / radius;
        var angle = Math.atan2(dy, dx);
        targetX = d.ox + Math.cos(angle) * force * maxPush;
        targetY = d.oy + Math.sin(angle) * force * maxPush;
      }

      d.x += (targetX - d.x) * ease;
      d.y += (targetY - d.y) * ease;

      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildGrid, 150);
  });

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener("mouseleave", function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readDotColor);

  readDotColor();
  buildGrid();
  requestAnimationFrame(tick);
})();
