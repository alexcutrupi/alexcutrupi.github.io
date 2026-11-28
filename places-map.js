/*! (c) Alex Cutrupi. All rights reserved. Copying or reuse without permission is not allowed. See LICENSE. */
(() => {
  const map = document.querySelector(".places-map");
  if (!map) return;

  const graphic = map.querySelector(".places-graphic");
  const diagram = map.querySelector(".places-diagram");
  const camera = map.querySelector(".places-camera");
  const selected = map.querySelector(".places-selected");
  const label = map.querySelector(".places-pin-label");
  const labelBackground = label.querySelector("rect");
  const labelText = label.querySelector("text");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 660px)");

  const names = new Map([...map.querySelectorAll("[data-place]")].map(place => [
    place.dataset.place, place.textContent,
  ]));
  const stops = [...map.querySelectorAll("[data-place-pin]")].map(pin => ({
    pin,
    name: names.get(pin.dataset.placePin),
    x: Number(pin.getAttribute("cx")),
    y: Number(pin.getAttribute("cy")),
  })).sort((a, b) => b.y - a.y || a.x - b.x);
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const previous = stops[i - 1];
    const distance = previous ? Math.hypot(stop.x - previous.x, stop.y - previous.y) : Infinity;
    stop.zoom = distance < 15 ? 3.25 : distance < 42 ? 2.85 : 2.45;
    stop.angle = 1;
  }

  const height = 430;
  const opening = { x: stops[0].x - 43, y: 396, zoom: 1.94, angle: 1 };
  const overview = { x: 195, y: 215, zoom: 1, angle: 0 };
  const introTime = 3600;
  const stepTime = 2200;
  const holdTime = 1050;
  const outroTime = 3100;
  const lastStopTime = introTime + (stops.length - 1) * stepTime;
  const totalTime = lastStopTime + outroTime;

  let width;
  let touring = false;
  let playing = false;
  let visible = !("IntersectionObserver" in window);
  let elapsed = 0;
  let previousFrame;
  let frame = 0;
  let visited = -1;
  let activeStop;
  let labelWidth = 0;

  function positionLabel(x, y) {
    const inView = x >= 0 && x <= width && y >= 0 && y <= height;
    label.classList.toggle("is-visible", inView);
    if (!inView) return;

    const edge = 8;
    const gap = 12;
    const left = x + gap + labelWidth < width - edge ? x + gap : x - gap - labelWidth;
    const labelX = Math.max(edge, Math.min(width - labelWidth - edge, left));
    const labelY = Math.max(edge, Math.min(height - 29 - edge, y - 14));
    label.setAttribute("transform", `translate(${labelX} ${labelY})`);
  }

  function applyCamera(view) {
    const skew = -.29 * view.angle;
    const pitch = 1 - .18 * view.angle;
    const x = width / 2 - (view.x + skew * view.y) * view.zoom;
    const y = height / 2 - view.y * pitch * view.zoom;
    camera.setAttribute("transform", `matrix(${view.zoom} 0 ${view.zoom * skew} ${view.zoom * pitch} ${x} ${y})`);

    if (activeStop) {
      positionLabel((activeStop.x + skew * activeStop.y) * view.zoom + x, activeStop.y * pitch * view.zoom + y);
    }
  }

  function blend(from, to, progress) {
    const t = Math.max(0, Math.min(1, progress));
    const ease = t * t * (3 - 2 * t);
    return {
      x: from.x + (to.x - from.x) * ease,
      y: from.y + (to.y - from.y) * ease,
      zoom: from.zoom + (to.zoom - from.zoom) * ease,
      angle: from.angle + (to.angle - from.angle) * ease,
    };
  }

  function highlight(stop) {
    activeStop = stop;
    selected.classList.toggle("is-selected", Boolean(stop));
    label.classList.toggle("is-visible", Boolean(stop));
    if (!stop) return;
    selected.setAttribute("cx", stop.x);
    selected.setAttribute("cy", stop.y);
    labelText.textContent = stop.name;
    labelWidth = Math.ceil(labelText.getComputedTextLength()) + 18;
    labelBackground.setAttribute("width", labelWidth);
  }

  function renderTour() {
    const count = elapsed < introTime ? 0 : Math.min(stops.length, 1 + Math.floor((elapsed - introTime) / stepTime));
    if (visited !== count) {
      for (let i = Math.max(0, visited); i < count; i++) stops[i].pin.classList.add("is-visited");
      visited = count;
      highlight(stops[count - 1]);
    }

    if (count === 0) {
      applyCamera(blend(opening, stops[0], elapsed / introTime));
    } else if (count < stops.length) {
      const sinceStop = elapsed - introTime - (count - 1) * stepTime;
      applyCamera(blend(stops[count - 1], stops[count], (sinceStop - holdTime) / (stepTime - holdTime)));
    } else {
      applyCamera(blend(stops.at(-1), overview, (elapsed - lastStopTime - holdTime) / (outroTime - holdTime)));
    }
  }

  function updateMapControl() {
    if (reduceMotion.matches) {
      graphic.removeAttribute("role");
      graphic.removeAttribute("tabindex");
      graphic.removeAttribute("aria-label");
    } else {
      graphic.setAttribute("role", "button");
      graphic.tabIndex = 0;
      graphic.setAttribute("aria-label", !touring ? "Replay map tour" : playing ? "Pause map tour" : "Resume map tour");
    }
  }

  function syncPlayback() {
    if (touring && playing && visible && !document.hidden && !reduceMotion.matches) {
      if (!frame) frame = window.requestAnimationFrame(tick);
    } else {
      window.cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = undefined;
    }
  }

  function tick(now) {
    frame = 0;
    if (previousFrame !== undefined) elapsed += now - previousFrame;
    previousFrame = now;
    if (elapsed >= totalTime) {
      showAll();
      return;
    }
    renderTour();
    syncPlayback();
  }

  function showAll() {
    touring = false;
    playing = false;
    syncPlayback();
    graphic.classList.remove("is-touring");
    for (const { pin } of stops) pin.setAttribute("r", "2.65");
    highlight(undefined);
    applyCamera(overview);
    updateMapControl();
  }

  function startTour() {
    elapsed = 0;
    visited = -1;
    touring = true;
    playing = true;
    for (const { pin } of stops) {
      pin.classList.remove("is-visited");
      pin.setAttribute("r", "1.8");
    }
    graphic.classList.add("is-touring");
    renderTour();
    updateMapControl();
    syncPlayback();
  }

  function updateViewport() {
    width = compact.matches ? 390 : 660;
    diagram.setAttribute("viewBox", `0 0 ${width} ${height}`);
    if (touring) renderTour();
    else applyCamera(overview);
  }

  function togglePlayback() {
    if (reduceMotion.matches) return;
    if (!touring) {
      startTour();
      return;
    }
    playing = !playing;
    updateMapControl();
    syncPlayback();
  }

  graphic.addEventListener("click", togglePlayback);
  graphic.addEventListener("keydown", event => {
    if (reduceMotion.matches || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    if (!event.repeat) togglePlayback();
  });
  document.addEventListener("visibilitychange", syncPlayback);
  compact.addEventListener("change", updateViewport);
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) showAll();
    else updateMapControl();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= .2;
      syncPlayback();
    }, { threshold: .2 });
    observer.observe(graphic);
  }

  updateViewport();
  if (!reduceMotion.matches) startTour();
})();
