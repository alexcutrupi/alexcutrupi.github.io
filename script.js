const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const root = document.documentElement;
const themeToggle = document.getElementById("theme-toggle");
const darkPreference = window.matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
  return root.dataset.theme || (darkPreference.matches ? "dark" : "light");
}

function updateThemeToggle() {
  const isDark = currentTheme() === "dark";
  themeToggle.dataset.dark = String(isDark);
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

if (themeToggle) {
  updateThemeToggle();
  darkPreference.addEventListener("change", updateThemeToggle);
  themeToggle.hidden = false;
  themeToggle.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // The choice still applies to the current page.
    }
    updateThemeToggle();
  });
}

// The full navigation stays visible when JavaScript is unavailable.
const menuToggle = document.querySelector(".menu-toggle");
const menu = document.getElementById("main-menu");

function setMenuOpen(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  menu.classList.toggle("is-open", open);
}

if (menuToggle && menu) {
  menuToggle.hidden = false;
  root.classList.add("has-menu");
  menuToggle.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });
  menu.addEventListener("keydown", closeMenuOnEscape);
  menuToggle.addEventListener("keydown", closeMenuOnEscape);
  window.matchMedia("(max-width: 960px)").addEventListener("change", () => setMenuOpen(false));
}

function closeMenuOnEscape(event) {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    event.preventDefault();
    setMenuOpen(false);
    menuToggle.focus();
  }
}

const backdropControls = document.querySelector(".backdrop-controls");
const backdropView = document.querySelector(".backdrop-view");
const backdropPrevious = document.querySelector(".backdrop-previous");
const backdropNext = document.querySelector(".backdrop-next");
const backdropToggle = document.querySelector(".backdrop-toggle");
const backdropToggleLabel = document.querySelector(".backdrop-toggle-label");
const backdropProgress = document.querySelector(".backdrop-progress");
const backdropStatus = document.getElementById("backdrop-status");
const backdropDirectory = "assets/photo-blends/";
const smallBackdrop = window.matchMedia("(max-width: 800px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const backdropInterval = 9000;
const backdropDuration = 1200;
const openingBackdrop = 48;
const backdropShuffleKey = "portfolioBackdropShuffle";

function enableSectionReveal() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove("awaiting-reveal");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -12% 0px" });

  for (const panel of document.querySelectorAll(".skills-panel")) {
    if (panel.getBoundingClientRect().top <= window.innerHeight * .88) continue;
    panel.classList.add("awaiting-reveal");
    observer.observe(panel);
  }
}

function enableStoryFocus() {
  const story = document.querySelector("main.story");
  const hero = story?.querySelector(".hero-copy");
  if (!hero) return;

  const heroSection = hero.parentElement;
  const surfaces = [...story.querySelectorAll(":scope > .story-panel")].map(panel =>
    panel === heroSection ? hero : panel
  );
  let frame = 0;

  function updateFocus() {
    frame = 0;
    if (reducedMotion.matches || story.hidden) return;

    const viewportHeight = window.innerHeight;
    const centers = surfaces.map(surface => {
      // Read the hero's layout position so its visual translation does not shift its focus point.
      if (surface === hero) {
        return heroSection.getBoundingClientRect().top + hero.offsetTop + hero.offsetHeight / 2;
      }
      const { top, height } = surface.getBoundingClientRect();
      return top + height / 2;
    });
    const remaining = document.documentElement.scrollHeight - viewportHeight - window.scrollY;
    const viewportFocus = viewportHeight * .5;
    // Only shift the focus toward the last panel after the preceding one has had its turn.
    const endWindow = Math.max(1, Math.min(viewportFocus, remaining + viewportFocus - centers.at(-2)));
    const endProgress = 1 - Math.min(1, Math.max(0, remaining / endWindow));
    const focus = viewportFocus + Math.max(0, centers.at(-1) - viewportFocus) * endProgress;

    const openingProgress = Math.min(1, Math.max(0, window.scrollY / Math.min(180, viewportHeight * .24)));
    const openingFocus = openingProgress * (2 - openingProgress);
    hero.style.setProperty("--story-intro-offset", (1 - openingFocus).toFixed(3));

    surfaces.forEach((surface, index) => {
      const center = centers[index];
      const neighbor = centers[focus < center ? index - 1 : index + 1];
      const distance = neighbor === undefined ? 0 : Math.abs(focus - center) / Math.abs(neighbor - center);
      const progress = 1 - Math.min(1, distance);
      const weight = progress * progress * (3 - 2 * progress);
      const emphasis = surface === hero ? weight * openingFocus : weight;
      surface.style.setProperty("--story-emphasis", (emphasis * 2 - 1).toFixed(3));
    });
  }

  function scheduleFocus() {
    if (!frame) frame = requestAnimationFrame(updateFocus);
  }

  window.addEventListener("scroll", scheduleFocus, { passive: true });
  window.addEventListener("resize", scheduleFocus);
  window.addEventListener("pageshow", scheduleFocus);
  reducedMotion.addEventListener("change", scheduleFocus);
  if ("ResizeObserver" in window) new ResizeObserver(scheduleFocus).observe(story);
  scheduleFocus();
}

function enableGlassResponse() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  for (const surface of document.querySelectorAll(".site-header .nav, .backdrop-controls")) {
    surface.addEventListener("pointermove", event => {
      if (event.pointerType !== "mouse" || reducedMotion.matches) return;
      const bounds = surface.getBoundingClientRect();
      surface.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
      surface.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
      surface.classList.add("has-pointer-light");
    });
    surface.addEventListener("pointerleave", () => surface.classList.remove("has-pointer-light"));
  }
}

function enablePhotosOnly() {
  const main = document.getElementById("main");
  const surroundingContent = document.querySelectorAll(".page-nav, .site-footer, .skip-link");
  let savedScroll = 0;

  function setPhotosOnly(active) {
    if (active) savedScroll = window.scrollY;
    main.hidden = active;
    surroundingContent.forEach(element => { element.hidden = active; });
    backdropView.textContent = active ? "Show content" : "Photos only";
    window.scrollTo({ top: active ? 0 : savedScroll, behavior: "instant" });
  }

  backdropView.addEventListener("click", () => setPhotosOnly(!main.hidden));
  menu?.addEventListener("click", event => {
    if (main.hidden && event.target.closest('a[href^="#"]')) setPhotosOnly(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && main.hidden && !event.defaultPrevented) {
      setPhotosOnly(false);
      backdropView.focus({ preventScroll: true });
    }
  });
}

function enableBackdropGestures(move) {
  const main = document.getElementById("main");
  const chrome = ".site-header, .site-footer, .backdrop-controls";
  let swipe;

  document.addEventListener("keydown", event => {
    if (!main.hidden || event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey ||
        event.metaKey || event.shiftKey || event.target.closest(".site-header, .site-footer")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });

  document.addEventListener("pointerdown", event => {
    if (!main.hidden || event.pointerType !== "touch" || !event.isPrimary || event.target.closest(chrome)) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  document.addEventListener("pointerup", event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const x = event.clientX - swipe.x;
    const y = event.clientY - swipe.y;
    swipe = undefined;
    if (main.hidden && Math.abs(x) >= 56 && Math.abs(x) > Math.abs(y) * 1.4) move(x < 0 ? 1 : -1);
  });
  document.addEventListener("pointercancel", event => {
    if (swipe?.id === event.pointerId) swipe = undefined;
  });
}

async function showBackdrop(scene, tone, animate) {
  const suffix = String(scene).padStart(2, "0") + ".webp";
  const desktop = 'url("' + backdropDirectory + "desktop-" + suffix + '")';
  const mobile = 'url("' + backdropDirectory + "mobile-" + suffix + '")';
  const image = new Image();
  image.src = backdropDirectory + (smallBackdrop.matches ? "mobile-" : "desktop-") + suffix;
  await image.decode();

  const body = document.body;
  if (animate && !reducedMotion.matches) {
    body.style.setProperty("--backdrop-incoming-desktop", desktop);
    body.style.setProperty("--backdrop-incoming-mobile", mobile);
    body.style.setProperty("--backdrop-duration", backdropDuration + "ms");
    body.classList.add("is-blending-backdrop");
    body.style.setProperty("--backdrop-tone", tone);
    await new Promise(resolve => window.setTimeout(resolve, backdropDuration));
  } else {
    body.style.setProperty("--backdrop-tone", tone);
  }
  body.style.setProperty("--backdrop-desktop", desktop);
  body.style.setProperty("--backdrop-mobile", mobile);
  body.classList.remove("is-blending-backdrop");
  body.style.removeProperty("--backdrop-incoming-desktop");
  body.style.removeProperty("--backdrop-incoming-mobile");
}

const warmedBackdrops = new Set();

// Fetch the upcoming backdrop during the countdown so the crossfade starts on time.
function warmBackdrop(scene) {
  const src = backdropDirectory + (smallBackdrop.matches ? "mobile-" : "desktop-") +
    String(scene).padStart(2, "0") + ".webp";
  if (warmedBackdrops.has(src)) return;
  warmedBackdrops.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
}

async function countBackdrops() {
  const exists = scene => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = backdropDirectory + "mobile-" + String(scene).padStart(2, "0") + ".webp";
  });
  // Double up to find a missing scene, then binary-search for the last one present.
  let low = 1;
  let high = 2;
  while (high <= 512 && await exists(high)) { low = high; high *= 2; }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (await exists(middle)) low = middle; else high = middle;
  }
  return low;
}

function shuffleBackdrops(count, openingScene) {
  const remaining = Array.from({ length: count }, (_, index) => index + 1)
    .filter(scene => scene !== openingScene);

  for (let index = remaining.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
  }

  return [openingScene, ...remaining];
}

async function enableBackdrops() {
  let scenes;
  try {
    const response = await fetch(backdropDirectory + "scenes.json");
    if (response.ok) scenes = await response.json();
  } catch {
    // Browsers block fetch for pages opened straight from disk (file://).
  }
  // Without the scene list, work out how many backdrops exist by probing the files.
  scenes ??= { count: await countBackdrops() };
  const { count, colors } = scenes;
  if (!Number.isInteger(count) || count < 2) return;
  const toneFor = scene => {
    const color = Array.isArray(colors) ? colors[scene - 1] : null;
    return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#2a6fcb";
  };

  const first = openingBackdrop <= count ? openingBackdrop : 1;
  let order = shuffleBackdrops(count, first);
  let position = 0;
  let playing = true;
  let changing = false;
  let timer;
  let countdown;
  document.body.style.setProperty("--backdrop-tone", toneFor(first));
  if (first !== openingBackdrop) await showBackdrop(first, toneFor(first), false);

  try {
    if (!document.body.classList.contains("home-page")) {
      const saved = JSON.parse(sessionStorage.getItem(backdropShuffleKey));
      if (Array.isArray(saved?.order) && saved.order.length === count && saved.order[0] === first &&
          new Set(saved.order).size === count &&
          saved.order.every(scene => Number.isInteger(scene) && scene >= 1 && scene <= count) &&
          Number.isInteger(saved.position) && saved.position >= 0 && saved.position < count) {
        const scene = saved.order[saved.position];
        if (scene !== first) await showBackdrop(scene, toneFor(scene), false);
        order = saved.order;
        position = saved.position;
      }
    }
  } catch {
    // The opening backdrop remains visible if the saved selection is unavailable.
  }

  function saveShuffle() {
    try { sessionStorage.setItem(backdropShuffleKey, JSON.stringify({ order, position })); } catch {}
  }

  saveShuffle();

  function stopCountdown() {
    window.clearTimeout(timer);
    countdown?.cancel();
    countdown = undefined;
  }

  function scheduleNext() {
    stopCountdown();
    if (playing && !changing && !document.hidden) {
      if (!reducedMotion.matches) {
        countdown = backdropProgress.animate?.(
          [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
          { duration: backdropInterval }
        );
      }
      timer = window.setTimeout(() => advance(1, false), backdropInterval);
      warmBackdrop(order[(position + 1) % count]);
    }
  }

  function setPlaying(value) {
    playing = value;
    const label = playing ? "Pause" : "Play";
    backdropToggleLabel.textContent = label;
    backdropToggle.setAttribute("aria-label", label + " backdrop");
    scheduleNext();
  }

  async function advance(direction, manual) {
    if (changing) return;
    stopCountdown();
    changing = true;
    backdropPrevious.setAttribute("aria-disabled", "true");
    backdropNext.setAttribute("aria-disabled", "true");
    const nextPosition = (position + direction + count) % count;
    const nextScene = order[nextPosition];
    try {
      await showBackdrop(nextScene, toneFor(nextScene), true);
      position = nextPosition;
      if (manual) backdropStatus.textContent = "Backdrop " + nextScene + " of " + count;
      saveShuffle();
    } catch {
      if (manual) backdropStatus.textContent = "Backdrop could not load. Try again.";
    } finally {
      changing = false;
      backdropPrevious.removeAttribute("aria-disabled");
      backdropNext.removeAttribute("aria-disabled");
      scheduleNext();
    }
  }

  backdropPrevious.addEventListener("click", () => advance(-1, true));
  backdropNext.addEventListener("click", () => advance(1, true));
  backdropToggle.addEventListener("click", () => {
    setPlaying(!playing);
  });
  enableBackdropGestures(direction => advance(direction, true));
  document.addEventListener("visibilitychange", scheduleNext);
  reducedMotion.addEventListener("change", scheduleNext);
  setPlaying(playing);
  for (const button of [backdropPrevious, backdropToggle, backdropNext]) {
    button.hidden = false;
  }
}

if (backdropControls) {
  enablePhotosOnly();
  backdropControls.hidden = false;
  enableSectionReveal();
  enableStoryFocus();
  enableGlassResponse();

  document.addEventListener("contextmenu", event => {
    const target = event.target;
    const portfolioPhoto = target.closest(".hero-portrait, .featured-image");
    const bareBackdrop = !target.closest(".container, .site-header, .site-footer, .backdrop-controls");
    if (portfolioPhoto || bareBackdrop) event.preventDefault();
  });

  enableBackdrops().catch(() => {
    // The first scene stays visible when the other backdrops are unavailable.
  });
}
