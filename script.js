const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const root = document.documentElement;

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
// "-full" where the page's <head> chose the full-quality backdrop photos for this screen.
const photoSuffix = document.documentElement.dataset.photoSize === "full" ? "-full" : "";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// Stop a video and drop its source so the browser frees the decoder and buffered frames straight away,
// rather than holding them until the element is garbage collected.
function releaseVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.remove();
}

// The backdrop scenes currently on screen, read by the live accent colour (see enableLiveTone). Stills use
// their precomputed colour from scenes.json, so their full-size images never need decoding for it.
const onScreen = { still: 0, incoming: 0, blendStart: 0, toneFor: null };

// Opening titles on the home page: the name resolves over black, then ten Live Photo scenes play in turn
// behind it (never a still) while skills drop through beneath. The montage ends on the opening scene's
// Live Photo, whose last frame matches the still underneath, so the hand-off to the page is seamless.
// Any click, key or scroll skips ahead.
function playIntro() {
  const html = document.documentElement;
  const intro = document.querySelector(".opening-titles");
  if (!intro || !html.classList.contains("intro")) return null;
  window.clearTimeout(window.introFailsafe); // The script loaded, so the head's fallback isn't needed.
  window.scrollTo(0, 0); // Start, and so finish, at the top of the page.
  try { sessionStorage.setItem("introSeen", "1"); } catch {}

  let introFinished;
  const done = new Promise(resolve => { introFinished = resolve; });
  // What I do, how I think and work, and where I want to take it.
  const skills = [
    "Building things", "Thinking logically", "Electrical installation", "Solving problems",
    "Networking", "Starting businesses", "Linux servers", "Planning ahead", "Structured cabling",
    "Building brands", "Lighting control", "Attention to detail", "Thinking in systems", "Growing ideas",
    "Troubleshooting", "Taking initiative", "Automation", "Creating from scratch", "Web development",
    "Never giving up", "Growing businesses", "Taking over",
  ];
  const skill = intro.querySelector(".intro-skill");
  const timers = [];
  const later = (callback, delay) => timers.push(window.setTimeout(callback, delay));
  const skipEvents = ["pointerdown", "keydown", "wheel", "touchmove"];
  let finished = false;

  // The skills sit in a column that rolls up one line at a time: the current line is bright in the
  // middle, with the previous line faintly above and the next one faintly below. It starts out of sight
  // below, so nothing shows until the first line rises in.
  const track = document.createElement("div");
  track.className = "intro-skill-track";
  track.innerHTML = skills.map(text => `<div>${text}</div>`).join("");
  skill.append(track);
  const lines = [...track.children];
  function showSkill(index) {
    track.style.setProperty("--at", index);
    lines.forEach((line, other) => line.classList.toggle("is-current", other === index));
  }

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(window.clearTimeout);
    skipEvents.forEach(type => window.removeEventListener(type, finish, true));
    window.scrollTo(0, 0);
    if ("scrollRestoration" in history) history.scrollRestoration = "auto"; // Back to normal after the intro.

    // Hand the name over: it glides from the middle of the screen into the home page's title, which
    // uses the same type, while the skills, bars and blur fade away around it.
    // Switch off the title's own entrance first, so it's measured where it will actually sit.
    html.classList.add("intro-played");
    const introName = intro.querySelector(".intro-name");
    const heroName = document.querySelector(".home-hero h1");
    const from = introName.getBoundingClientRect();
    const to = heroName?.getBoundingClientRect();
    const handOff = to && to.width > 0 && from.width > 0;
    const glide = 900;
    intro.classList.add("is-lit", "is-leaving");
    if (handOff) {
      intro.classList.add("is-handoff");
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      introName.animate(
        [{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})` }],
        { duration: glide, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" });
    }
    const reveal = () => {
      html.classList.remove("intro"); // The page appears; its title is exactly where the name landed.
      introFinished();
      window.setTimeout(() => {
        intro.querySelectorAll("video").forEach(releaseVideo); // Free every intro clip's memory.
        intro.remove();
      }, handOff ? 50 : 1100);
    };
    if (handOff) window.setTimeout(reveal, glide); else reveal();
  }

  skipEvents.forEach(type => window.addEventListener(type, finish, { capture: true, passive: true }));
  window.setTimeout(finish, 16000); // Hard limit, whatever happens with the clips.

  // Roll through every skill between `from` and `to` (ms from now), easing slightly slower towards the
  // end to land on the last one as the titles lift.
  function runSkills(from, to) {
    const span = to - from;
    const last = skills.length - 1;
    skills.forEach((text, index) => {
      const x = index / last;
      later(() => showSkill(index), from + span * (.8 * x + .2 * x ** 2));
    });
  }

  buildReel(intro).then(reel => {
    if (finished) return;
    if (!reel) { // No Live Photos available: a short titles-only version over the backdrop.
      intro.classList.add("is-lit");
      runSkills(900, 3900);
      later(finish, 4400);
      return;
    }
    // The montage (ten quick cuts, built ahead of time as one video) plays first, then the opening
    // scene's own clip runs to its last frame as the titles lift.
    const montageTime = 4000;
    const finalTime = 700;
    const { clips, showClip } = reel;
    const reelStart = 600;  // Let the name begin over black first.
    const montage = clips.length > 1;
    if (montage) later(() => showClip(0), reelStart);
    later(() => showClip(clips.length - 1, finalTime), reelStart + (montage ? montageTime : 0));
    const end = reelStart + (montage ? montageTime : 0) + finalTime;
    runSkills(reelStart, end - 150);
    later(finish, end);
  });
  return done;
}

// Prepares the intro's two videos: a montage of ten Live Photo scenes (one of several built ahead of time
// by tools/make_intro_montages.py) and the opening scene's own clip. Two video players instead of one per
// scene keeps memory use down. Resolves once the first can play (or after a short wait), or null.
async function buildReel(intro) {
  let variants = 4;
  try {
    const response = await fetch(backdropDirectory + "scenes.json");
    if (response.ok) variants = (await response.json()).introVariants ?? variants;
  } catch {
    // Opened straight from disk (file://): assume the default number of montages.
  }
  const kind = smallBackdrop.matches ? "mobile-" : "desktop-";
  const sources = [
    { src: `${backdropDirectory}intro-${kind}${1 + Math.floor(Math.random() * variants)}.mp4`, rate: 1 },
    { src: `${backdropDirectory}${kind}${String(openingBackdrop).padStart(2, "0")}.mp4`, rate: 1.6 },
  ];

  const holder = document.createElement("div");
  holder.className = "intro-reel";
  intro.prepend(holder);
  let clips = sources.map(({ src, rate }) => {
    const video = document.createElement("video");
    video.className = "intro-clip";
    // Attributes as well as properties: Safari checks the attributes before it will autoplay.
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.dataset.rate = rate;
    video.defaultPlaybackRate = video.playbackRate = rate;
    video.src = src;
    holder.append(video);
    return video;
  });

  // Wait until each video knows its length (or fails), but not for long. Safari on iPhone often won't
  // download the actual frames until a video is asked to play, so this only waits for the metadata.
  await new Promise(resolve => {
    let pending = clips.length;
    const settle = () => { if (--pending === 0) resolve(); };
    for (const video of clips) {
      if (video.readyState >= 1) settle();
      else {
        video.addEventListener("loadedmetadata", settle, { once: true });
        video.addEventListener("error", settle, { once: true });
      }
    }
    window.setTimeout(resolve, 2000);
  });
  clips.filter(video => video.error).forEach(releaseVideo);
  clips = clips.filter(video => !video.error);
  if (!clips.length) return null;

  // If no video manages to play (Low Power Mode blocks autoplay on iPhone, for example), light the
  // titles over the backdrop photo instead of leaving the screen black.
  const fallback = window.setTimeout(() => intro.classList.add("is-lit"), 2200);
  let current = -1;
  // `endIn` (ms): start part-way through so the clip reaches its last frame exactly then. The opening
  // scene's last frame matches the still underneath, so the reveal lands on it without a jump.
  // Playing is what makes Safari load a video, so each clip is started straight away and only shown
  // once it is actually moving; until then the previous clip stays up.
  const reveal = (video, endIn, index) => {
    video.playbackRate = Number(video.dataset.rate) || 1;
    if (endIn && video.duration) video.currentTime = Math.max(0, video.duration - (endIn / 1000) * video.playbackRate);
    const show = () => {
      if (current !== index) return; // The next clip's turn has already come.
      for (const other of clips) {
        if (other.classList.contains("is-on") && other !== video) {
          other.classList.remove("is-on");
          window.setTimeout(() => releaseVideo(other), 450); // Free it once it has faded out.
        }
      }
      video.classList.add("is-on");
      window.clearTimeout(fallback);
      intro.classList.add("is-lit"); // Fade up from black on the first clip.
    };
    const playing = video.play();
    if (playing?.then) playing.then(show, () => intro.classList.add("is-lit"));
    else show();
  };
  function showClip(index, endIn = 0) {
    current = index;
    reveal(clips[index], endIn, index);
  }
  return { clips, showClip };
}

const backdropInterval = 9000;
const backdropDuration = 1200;
// The scene a page opens on: the home page picks one at random in its <head>; other pages use 52.
const openingBackdrop = Number(document.documentElement.dataset.opening) || 52;
const backdropShuffleKey = "portfolioBackdropShuffle";
const introDone = playIntro(); // Resolves once the opening titles have lifted (null when they don't play).

// Panels and the cards inside them rise into place as they scroll into view.
const revealTargets = [
  ".hero-copy", ".story-panel:not(.home-hero)", "main > .container:not(.story-panel)", ".page-nav",
  ".experience-entry", ".focus-list > div", ".project-overview", ".project-work-grid > section",
  ".project-outcomes > div", ".expertise-card", ".school-card", ".nav-card", ".contact-panel", ".tag-list > .tag",
  ".work-gallery > li", ".project-facts > div", ".project-card", ".about-focus > div"
].join(", ");

function enableSectionReveal() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target;
      element.classList.replace("awaiting-reveal", "is-revealing");
      observer.unobserve(element);
      // Hand transitions back to the element once it has arrived, so hover effects stay snappy.
      window.setTimeout(() => {
        element.classList.remove("is-revealing");
        element.style.removeProperty("--reveal-delay");
      }, 1500);
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  // Arriving at a #section link: leave whatever contains that section in place. Its entrance animation
  // starts it shrunk and lowered, which throws off where the browser scrolls to.
  let linked = null;
  try { linked = location.hash && document.querySelector(decodeURIComponent(location.hash)); } catch {}

  const siblingCounts = new Map();
  for (const element of document.querySelectorAll(revealTargets)) {
    if (linked && (element.contains(linked) || linked.contains(element))) continue;
    // Stagger siblings so groups of cards cascade instead of appearing together.
    const order = siblingCounts.get(element.parentElement) ?? 0;
    siblingCounts.set(element.parentElement, order + 1);
    const step = element.parentElement.matches(".work-gallery") ? order % 4 : Math.min(order, 8);
    element.style.setProperty("--reveal-delay", step * 110 + "ms");
    element.classList.add("awaiting-reveal");
    observer.observe(element);
  }
}

// A soft light follows the pointer across cards.
function enableCardSpotlight() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const cards = ".nav-card, .expertise-card, .school-card, .project-work-grid > section, " +
    ".project-outcomes > div, .featured-project, .project-overview, .contact-panel, .page-nav-link, .project-card, .work-gallery a";

  document.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || reducedMotion.matches) return;
    const card = event.target.closest?.(cards);
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    card.classList.add("has-spotlight");

    // Tilt toward the cursor once the card has finished arriving; large panels tilt less.
    if (card.matches(".awaiting-reveal, .is-revealing")) return;
    const strength = bounds.width > 520 ? 2.5 : 7;
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    card.style.setProperty("--tilt-x", (-y * strength).toFixed(2) + "deg");
    card.style.setProperty("--tilt-y", (x * strength).toFixed(2) + "deg");
    card.classList.add("is-tilting");
  }, { passive: true });
  document.addEventListener("pointerout", event => {
    const card = event.target.closest?.(cards);
    if (card && !card.contains(event.relatedTarget)) card.classList.remove("has-spotlight", "is-tilting");
  });
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
    document.body.classList.toggle("is-photos-only", active);
    surroundingContent.forEach(element => { element.hidden = active; });
    backdropView.querySelector(".backdrop-view-label").textContent = active ? "Show content" : "Photos only";
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

async function showBackdrop(scene, tone, animate, keepMotion = false) {
  const suffix = String(scene).padStart(2, "0") + photoSuffix + ".webp";
  const desktop = 'url("' + backdropDirectory + "desktop-" + suffix + '")';
  const mobile = 'url("' + backdropDirectory + "mobile-" + suffix + '")';
  const image = new Image();
  image.src = backdropDirectory + (smallBackdrop.matches ? "mobile-" : "desktop-") + suffix;
  await image.decode();

  const body = document.body;
  if (animate && !reducedMotion.matches) {
    onScreen.incoming = scene;
    onScreen.blendStart = performance.now();
    body.style.setProperty("--backdrop-incoming-desktop", desktop);
    body.style.setProperty("--backdrop-incoming-mobile", mobile);
    body.style.setProperty("--backdrop-duration", backdropDuration + "ms");
    body.classList.add("is-blending-backdrop");
    body.style.setProperty("--backdrop-tone", tone);
    await new Promise(resolve => window.setTimeout(resolve, backdropDuration));
  } else {
    body.style.setProperty("--backdrop-tone", tone);
  }
  onScreen.still = scene;
  onScreen.incoming = 0;
  if (!keepMotion) clearMotion();
  body.style.setProperty("--backdrop-desktop", desktop);
  body.style.setProperty("--backdrop-mobile", mobile);
  body.classList.remove("is-blending-backdrop");
  body.style.removeProperty("--backdrop-incoming-desktop");
  body.style.removeProperty("--backdrop-incoming-mobile");
}

// Moving to a Live Photo scene: the Live Photo appears straight away on top and plays,
// while the stills crossfade underneath, so it always settles onto the new scene's still.
async function crossfadeIntoMotion(scene, tone, video) {
  playMotion(video, 250);
  await showBackdrop(scene, tone, true, true);
}

// Live Photo motion: each scene opens on its moving Live Photo, plays it once, then settles on the still.
let motionVideo;
let motionScenes = null; // null when unknown (page opened from disk), so every scene is tried.
let motionSettled = () => {}; // Set by the slideshow: called once the motion has given way to the still.
const stillHold = 3500; // How long the still stays up after its Live Photo finishes.
const motionStartLimit = 4000; // Give up on motion that has not started by then (e.g. autoplay blocked).

function clearMotion() {
  releaseVideo(motionVideo);
  motionVideo = undefined;
}

// True while the current scene's Live Photo still has to play, so the slideshow waits for it.
function motionPending() {
  return Boolean(motionVideo && !motionVideo.ended && !motionVideo.error);
}

// Keep the video's slow drift in step with the still underneath so the fade lines up.
function syncDrift(video) {
  const still = document.getAnimations().find(animation =>
    animation.animationName === "backdrop-drift" && animation.effect?.pseudoElement === "::before");
  const own = video.getAnimations().find(animation => animation.animationName === "backdrop-drift");
  if (still && own) own.currentTime = still.currentTime;
}

function wantsMotion(scene) {
  if (reducedMotion.matches || navigator.connection?.saveData) return false;
  return !motionScenes || motionScenes.has(scene);
}

// Load a scene's Live Photo so it can start the moment the scene appears.
// Resolves with the video once its first frame is ready, or undefined if it cannot be used.
function prepareMotion(scene) {
  if (!wantsMotion(scene)) return Promise.resolve();
  const video = document.createElement("video");
  video.className = "backdrop-motion";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");
  video.src = backdropDirectory + (smallBackdrop.matches ? "mobile-" : "desktop-") +
    String(scene).padStart(2, "0") + ".mp4";
  return new Promise(resolve => {
    const finish = ready => {
      window.clearTimeout(limit);
      resolve(ready ? video : undefined);
    };
    const limit = window.setTimeout(() => finish(false), motionStartLimit);
    video.addEventListener("loadeddata", () => finish(true), { once: true });
    video.addEventListener("error", () => finish(false), { once: true });
    video.load();
  });
}

// Fade a prepared Live Photo in over whatever is showing, play it once, then ease into the still.
function playMotion(video, fadeMs) {
  const previous = motionVideo;
  if (previous) previous.after(video); else document.body.prepend(video);
  motionVideo = video;
  video.style.transitionDuration = fadeMs + "ms";
  syncDrift(video);

  const giveUp = () => {
    if (motionVideo !== video) return;
    clearMotion();
    motionSettled();
  };
  video.addEventListener("playing", () => {
    syncDrift(video);
    video.classList.add("is-playing");
    window.setTimeout(() => { if (previous !== motionVideo) releaseVideo(previous); }, fadeMs + 50);
  }, { once: true });
  video.addEventListener("ended", () => {
    video.style.transitionDuration = "";
    video.classList.remove("is-playing");
    window.setTimeout(() => {
      if (motionVideo === video) clearMotion();
    }, 1300);
    if (motionVideo === video) motionSettled();
  }, { once: true });
  video.addEventListener("error", giveUp);
  // If the browser refuses to autoplay, show the still and carry on.
  video.play().catch(giveUp);
}

const warmedBackdrops = new Set();

// Fetch the upcoming backdrop during the countdown so the crossfade starts on time.
function warmBackdrop(scene) {
  const src = backdropDirectory + (smallBackdrop.matches ? "mobile-" : "desktop-") +
    String(scene).padStart(2, "0") + photoSuffix + ".webp";
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

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

// The slideshow order: the opening scene, then Live Photo scenes favoured two to one over stills.
// Every still appears once per cycle; Live Photo scenes come round more often to fill their share,
// reshuffled each time and never repeated within a few scenes of each other.
function shuffleBackdrops(count, openingScene, liveScenes) {
  const all = Array.from({ length: count }, (_, index) => index + 1).filter(scene => scene !== openingScene);
  const live = liveScenes ? all.filter(scene => liveScenes.has(scene)) : [];
  const stills = shuffle(all.filter(scene => !live.includes(scene)));
  if (!live.length || !stills.length) return [openingScene, ...shuffle(all)];

  const order = [openingScene];
  let deck = [];
  const nextLive = () => {
    if (!deck.length) deck = shuffle([...live]);
    // Skip anything shown in the last few slots, so the same scene doesn't come straight back.
    const recent = new Set(order.slice(-Math.min(6, live.length - 1)));
    const index = deck.findIndex(scene => !recent.has(scene));
    return deck.splice(index === -1 ? 0 : index, 1)[0];
  };
  for (const still of stills) order.push(nextLive(), nextLive(), still);
  return order;
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
  if (scenes.colors) motionScenes = new Set(Array.isArray(scenes.motion) ? scenes.motion : []);
  const toneFor = scene => {
    const color = Array.isArray(colors) ? colors[scene - 1] : null;
    return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#2a6fcb";
  };

  const first = openingBackdrop <= count ? openingBackdrop : 1;
  let order = shuffleBackdrops(count, first, motionScenes);
  let position = 0;
  let playing = true;
  let changing = false;
  let timer;
  let countdown;
  document.body.style.setProperty("--backdrop-tone", toneFor(first));
  onScreen.still = first;
  onScreen.toneFor = toneFor;
  enableLiveTone();
  if (first !== openingBackdrop) await showBackdrop(first, toneFor(first), false);

  try {
    if (!document.body.classList.contains("home-page")) {
      const saved = JSON.parse(sessionStorage.getItem(backdropShuffleKey));
      if (Array.isArray(saved?.order) && saved.order.length >= count &&
          new Set(saved.order).size === count &&
          saved.order.every(scene => Number.isInteger(scene) && scene >= 1 && scene <= count) &&
          Number.isInteger(saved.position) && saved.position >= 0 && saved.position < saved.order.length) {
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
  if (introDone) {
    introDone.then(() => motionSettled()); // The montage already played the opening Live Photo.
  } else {
    prepareMotion(order[position]).then(video => {
      if (video && !changing) playMotion(video, 600); else if (!video) motionSettled();
    });
  }

  function stopCountdown() {
    window.clearTimeout(timer);
    countdown?.cancel();
    countdown = undefined;
  }

  // Scenes with a Live Photo: play it, settle on the still, hold briefly, then move on.
  // Scenes without one keep the regular interval.
  let sceneHadMotion = false;
  motionSettled = () => {
    sceneHadMotion = true;
    scheduleNext();
  };

  // The next scene's Live Photo loads during the current one so it can start straight away.
  let upcoming;
  function prepareUpcoming(scene) {
    if (upcoming?.scene === scene) return;
    upcoming?.video.then(releaseVideo); // Not needed any more: free it.
    upcoming = { scene, video: prepareMotion(scene) };
  }
  async function takeMotion(scene) {
    prepareUpcoming(scene);
    const { video } = upcoming;
    upcoming = undefined;
    return video;
  }

  function scheduleNext() {
    stopCountdown();
    if (!playing || changing || document.hidden) return;
    if (document.documentElement.classList.contains("intro")) return; // Wait for the opening titles.
    if (playingLive) return; // A Live Photo is playing on request: carry on once it ends.
    warmBackdrop(order[(position + 1) % order.length]);
    prepareUpcoming(order[(position + 1) % order.length]);
    if (motionPending()) return; // The countdown starts when the Live Photo has finished.
    const delay = sceneHadMotion ? stillHold : backdropInterval;
    if (!reducedMotion.matches) {
      countdown = backdropProgress.animate?.(
        [{ "--progress": 0 }, { "--progress": 1 }], // Fills the ring around the pause button.
        { duration: delay }
      );
    }
    timer = window.setTimeout(() => advance(1, false), delay);
  }

  function setPlaying(value) {
    playing = value;
    const label = playing ? "Pause" : "Play";
    backdropToggleLabel.textContent = label;
    backdropToggle.setAttribute("aria-label", label + " backdrop");
    if (playing) motionVideo?.play().catch(() => {}); else motionVideo?.pause();
    scheduleNext();
  }

  async function advance(direction, manual) {
    if (changing) return;
    stopCountdown();
    changing = true;
    backdropPrevious.setAttribute("aria-disabled", "true");
    backdropNext.setAttribute("aria-disabled", "true");
    const nextPosition = (position + direction + order.length) % order.length;
    const nextScene = order[nextPosition];
    sceneHadMotion = false;
    try {
      const video = playing ? await takeMotion(nextScene) : undefined;
      if (video) {
        await crossfadeIntoMotion(nextScene, toneFor(nextScene), video);
      } else {
        await showBackdrop(nextScene, toneFor(nextScene), true);
      }
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

  // Press and hold the background (anywhere in Photos only) for a moment, or press L, and the current
  // scene's Live Photo plays once through, then fades back to the still. The slideshow waits for it.
  let playingLive = false;
  // Which scenes have a Live Photo. Normally from scenes.json; when that can't be read (a page opened
  // straight from disk), each scene's clip is checked once by loading just its header.
  const hasLive = new Map();
  function checkLive(scene) {
    if (motionScenes) return Promise.resolve(motionScenes.has(scene));
    if (hasLive.has(scene)) return hasLive.get(scene);
    const probe = new Promise(resolve => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const done = found => { resolve(found); video.removeAttribute("src"); video.load(); };
      video.addEventListener("loadedmetadata", () => done(true), { once: true });
      video.addEventListener("error", () => done(false), { once: true });
      video.src = backdropDirectory + (smallBackdrop.matches ? "mobile-" : "desktop-") + String(scene).padStart(2, "0") + ".mp4";
    });
    hasLive.set(scene, probe);
    return probe;
  }
  async function playLive() {
    const scene = order[position];
    if (playingLive || changing || !wantsMotion(scene)) return;
    playingLive = true;
    const finish = () => { playingLive = false; scheduleNext(); };
    if (!(await checkLive(scene))) { playingLive = false; toast("This one isn\u2019t a Live Photo"); return; }
    stopCountdown();
    const video = await prepareMotion(scene);
    if (!video) { finish(); return; }
    if (motionVideo) motionVideo.after(video); else document.body.prepend(video);
    syncDrift(video);
    video.addEventListener("playing", () => { syncDrift(video); video.classList.add("is-playing"); }, { once: true });
    video.addEventListener("ended", () => {
      video.classList.remove("is-playing"); // Fades back to the still underneath.
      window.setTimeout(() => releaseVideo(video), 1300);
      finish();
    }, { once: true });
    video.play().catch(() => { releaseVideo(video); finish(); });
  }
  // A steady press on the background (not a tap or a swipe) starts it.
  let press;
  const backdropSurface = target => document.getElementById("main")?.hidden ||
    !target.closest(".container, .site-header, .site-footer, .backdrop-controls, dialog, .section-dots, .back-to-top, .page-nav, a, button");
  document.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || !backdropSurface(event.target)) return;
    press = { x: event.clientX, y: event.clientY, timer: window.setTimeout(() => { press = null; playLive(); }, 350) };
  });
  document.addEventListener("pointermove", event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) { window.clearTimeout(press.timer); press = null; }
  }, { passive: true });
  for (const type of ["pointerup", "pointercancel"]) {
    document.addEventListener(type, () => { if (press) { window.clearTimeout(press.timer); press = null; } });
  }
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() !== "l" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest?.("input, textarea, [contenteditable]") || document.querySelector("dialog[open]")) return;
    playLive();
  });
  backdropToggle.addEventListener("click", () => {
    setPlaying(!playing);
  });
  enableBackdropGestures(direction => advance(direction, true));
  document.addEventListener("visibilitychange", scheduleNext);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) clearMotion();
    scheduleNext();
  });
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
  enableCardSpotlight();
  enableFallingQualities();
  enableHeadingDecode();
  enableMagneticButtons();
  enableBackdropDepth();

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

// Hands-on work gallery: open photos in a viewer instead of leaving the page.
function enableWorkViewer(gallery) {
  const links = [...gallery.querySelectorAll("a")];
  if (!links.length || typeof HTMLDialogElement !== "function") return;
  const viewer = document.createElement("dialog");
  viewer.className = "work-viewer";
  viewer.setAttribute("aria-label", "Photo viewer");
  viewer.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<div class="work-viewer-bar">' +
    '<button type="button" data-step="-1">Previous</button>' +
    '<button type="button" data-close>Close</button>' +
    '<button type="button" data-step="1">Next</button></div>';
  document.body.append(viewer);
  const image = viewer.querySelector("img");
  const caption = viewer.querySelector("figcaption");
  let current = 0;

  const animate = !reducedMotion.matches;

  // Moves the big photo between its own spot and a thumbnail's, so it seems to grow out of (or shrink
  // back into) the gallery. Plain fades are used if the thumbnail is off screen.
  const thumbRect = index => {
    const rect = links[index].querySelector("img").getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.width ? rect : null;
  };
  const zoom = (from, to, reverse) => image.animate([
    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: ".65rem" },
    { transform: "none", borderRadius: ".5rem" },
  ], { duration: reverse ? 320 : 440, easing: "cubic-bezier(.2, .8, .2, 1)", direction: reverse ? "reverse" : "normal", fill: reverse ? "forwards" : "none" });

  // Fade the viewer out before closing it, so it doesn't vanish abruptly.
  const close = () => {
    if (animate && !viewer.classList.contains("is-closing")) {
      const to = thumbRect(current);
      if (to) {
        viewer.classList.add("is-closing", "is-zooming");
        zoom(to, image.getBoundingClientRect(), true).finished.then(() => {
          viewer.classList.remove("is-closing", "is-zooming");
          image.getAnimations().forEach(animation => animation.cancel());
          viewer.close();
        });
        return;
      }
    }
    if (!animate || viewer.classList.contains("is-closing")) { viewer.close(); return; }
    viewer.classList.add("is-closing");
    viewer.addEventListener("animationend", () => {
      viewer.classList.remove("is-closing");
      viewer.close();
    }, { once: true });
  };

  const show = (index, direction = 0) => {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.href;
    image.alt = link.querySelector("img").alt;
    if (animate && direction) {
      image.decode().catch(() => {}).then(() => image.animate(
        [{ opacity: 0, transform: `translateX(${direction * 36}px)` }, { opacity: 1, transform: "none" }],
        { duration: 320, easing: "cubic-bezier(.16, 1, .3, 1)" }));
    }
    caption.textContent = link.parentElement.querySelector("span")?.textContent ?? "";
    new Image().src = links[(current + 1) % links.length].href; // Preload the next photo.
  };

  links.forEach((link, index) => link.addEventListener("click", async event => {
    event.preventDefault();
    const thumb = link.querySelector("img");
    const from = animate ? thumbRect(index) : null;
    if (!from) { show(index); viewer.showModal(); return; }
    // Open with the thumbnail (already loaded, same shape) so the zoom can start straight away, then
    // swap in the full-size photo once it has loaded.
    current = index;
    image.src = thumb.currentSrc || thumb.src;
    image.alt = thumb.alt;
    caption.textContent = link.parentElement.querySelector("span")?.textContent ?? "";
    viewer.classList.add("is-zooming");
    viewer.showModal();
    await image.decode().catch(() => {});
    zoom(from, image.getBoundingClientRect()).finished.then(() => viewer.classList.remove("is-zooming"));
    const full = new Image();
    full.src = link.href;
    full.decode().then(() => { if (current === index) image.src = link.href; }).catch(() => {});
    new Image().src = links[(index + 1) % links.length].href; // Preload the next photo.
  }));
  viewer.addEventListener("click", event => {
    const step = event.target.closest("[data-step]")?.dataset.step;
    if (step) show(current + Number(step), Number(step));
    else if (event.target.closest("[data-close]") || event.target === viewer) close();
  });
  viewer.addEventListener("cancel", event => {
    event.preventDefault(); // Esc: close with the same fade.
    close();
  });
  viewer.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") show(current - 1, -1);
    if (event.key === "ArrowRight") show(current + 1, 1);
  });
  viewer.addEventListener("close", () => links[current].focus({ preventScroll: true }));
}

const workGallery = document.querySelector(".work-gallery");
if (workGallery) enableWorkViewer(workGallery);

// Personal qualities drifting faintly down the backdrop, a few at a time.
function enableFallingQualities() {
  if (reducedMotion.matches) return;
  const qualities = [
    "Independent learning", "Technical problem-solving", "Logical thinking", "Troubleshooting",
    "Creativity", "Attention to detail", "Initiative", "Project planning", "Research", "Adaptability",
    "Entrepreneurial thinking", "Technical curiosity", "Systems thinking", "Practical ability", "Persistence",
  ];
  // All the words are drawn on one canvas rather than as separate animated elements: a single layer
  // instead of one per word, which uses far less graphics memory for the same look.
  const layer = document.createElement("canvas");
  layer.className = "backdrop-qualities";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  const context = layer.getContext("2d");
  const narrow = window.matchMedia("(max-width: 800px)");
  let scale = 1;
  function resize() {
    scale = Math.min(window.devicePixelRatio || 1, 1.5); // Faint, small text: 1.5x is sharp enough.
    layer.width = Math.round(window.innerWidth * scale);
    layer.height = Math.round(window.innerHeight * scale);
  }
  resize();
  window.addEventListener("resize", resize);

  // The longer someone stays on the site, the less noticeable the words become. The start time is
  // kept for the browser tab, so the fade carries on across pages instead of resetting on each one.
  let arrived = Date.now();
  try {
    const saved = Number(sessionStorage.getItem("qualitiesArrived"));
    if (saved > 0 && saved <= arrived) arrived = saved;
    else sessionStorage.setItem("qualitiesArrived", String(arrived));
  } catch {}
  const presence = () => .15 + .85 * Math.exp(-(Date.now() - arrived) / 150000);
  const updatePresence = () => layer.style.setProperty("--qualities-presence", presence().toFixed(3));
  updatePresence();
  window.setInterval(updatePresence, 5000);

  const words = [];
  let queue = [];
  let recent = [];
  const fontFor = size => `300 ${size}px "Space Grotesk", system-ui, sans-serif`;

  // The space either side of the page content, measured each time since it differs per page.
  function sideSpaces() {
    const blocks = [...document.querySelectorAll("main > :not(.story-marker)")]
      .map(block => block.getBoundingClientRect())
      .filter(rect => rect.width > 0);
    if (!blocks.length) return [];
    const left = Math.min(...blocks.map(rect => rect.left));
    const right = Math.max(...blocks.map(rect => rect.right));
    return [[8, left - 8], [right + 8, window.innerWidth - 8]];
  }

  // Most words fall beside the content, the rest anywhere, avoiding columns the last few words used.
  function placeWord(wordWidth) {
    const fits = sideSpaces().filter(([start, end]) => end - start >= wordWidth);
    const useSides = fits.length > 0 && Math.random() < .8;
    let x = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (useSides) {
        const [start, end] = fits[Math.floor(Math.random() * fits.length)];
        x = start + Math.random() * (end - start - wordWidth);
      } else {
        x = 8 + Math.random() * Math.max(0, window.innerWidth - wordWidth - 16);
      }
      if (recent.every(used => Math.abs(used - x) > 90)) break;
    }
    recent = [x, ...recent].slice(0, 4);
    return Math.round(x);
  }

  // A ghost is a smaller, fainter duplicate that falls more slowly, as if further away.
  function drop(progress = 0, ghost = false) {
    if (Math.random() > presence()) return; // Fewer new words as time goes on.
    const limit = ghost ? (narrow.matches ? 2 : 4) : (narrow.matches ? 3 : 6);
    if (words.filter(word => word.ghost === ghost).length >= limit) return;
    let text;
    if (ghost) {
      text = qualities[Math.floor(Math.random() * qualities.length)];
    } else {
      if (!queue.length) queue = shuffle([...qualities]); // Every quality appears before any repeats.
      text = queue.pop();
    }
    text = "\u201C" + text + "\u201D";
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const size = (narrow.matches ? .85 : 1) * (ghost ? .6 + Math.random() * .15 : .75 + Math.random() * .3) * rem;
    context.font = fontFor(size);
    const width = context.measureText(text).width;
    const duration = (ghost ? 15 + Math.random() * 5 : 9 + Math.random() * 4) * 1000;
    // Always tilted (8–22° either way), never level, but still easy to read.
    const tilt = (8 + Math.random() * 14) * (Math.random() < .5 ? -1 : 1) * Math.PI / 180;
    words.push({ text, size, width, ghost, tilt, duration, x: placeWord(width),
      start: performance.now() - progress * duration }); // Words already on screen at page load.
    if (!frame) frame = requestAnimationFrame(draw);
  }

  let frame = 0;
  let lastDraw = 0;
  function draw(now) {
    frame = 0;
    if (document.hidden) return;
    if (now - lastDraw >= 33) { // About 30 frames a second is plenty for slowly falling words.
      lastDraw = now;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, layer.width, layer.height);
      const height = window.innerHeight;
      for (let index = words.length - 1; index >= 0; index--) {
        const word = words[index];
        const t = (now - word.start) / word.duration;
        if (t >= 1) { words.splice(index, 1); continue; }
        const y = -.12 * height + t * 1.24 * height;
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.translate(word.x + word.width / 2, y + word.size / 2);
        context.rotate(word.tilt);
        context.font = fontFor(word.size);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.filter = word.ghost ? "blur(.6px)" : "none";
        context.shadowColor = "rgb(0 0 0 / .25)";
        context.shadowBlur = 10 * scale;
        context.shadowOffsetY = scale;
        context.fillStyle = word.ghost ? "rgb(242 243 239 / .36)" : "rgb(242 243 239 / .8)";
        context.fillText(word.text, 0, 0);
      }
    }
    if (words.length) frame = requestAnimationFrame(draw);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && words.length && !frame) frame = requestAnimationFrame(draw);
  });

  // Start once the site's font has loaded, so the canvas doesn't draw the words in a fallback font.
  const start = () => {
    for (let index = 0; index < (narrow.matches ? 2 : 4); index++) drop(Math.random() * .85);
    drop(Math.random() * .85, true);
    window.setInterval(() => { if (!document.hidden) drop(); }, 2000);
    window.setInterval(() => { if (!document.hidden && Math.random() < .6) drop(0, true); }, 3800);
  };
  (document.fonts?.load(fontFor(16)) ?? Promise.resolve()).then(start, start);
}

// About me: the highlighted phrases sweep in, one after another, when the panel comes into view.
function enableHighlights() {
  const panel = document.querySelector(".home-about-me");
  if (!panel) return;
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    panel.classList.add("is-highlighted");
    return;
  }
  // Only once someone has scrolled the panel into the middle of the screen, never on load by itself.
  let inView = false;
  let scrolled = false;
  const play = () => {
    if (!inView || !scrolled) return;
    panel.classList.add("is-highlighted");
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
  };
  const onScroll = () => { scrolled = true; play(); };
  const observer = new IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting);
    play();
  }, { rootMargin: "-25% 0px -25% 0px" }); // The panel has to reach the middle half of the screen.
  observer.observe(panel);
  window.addEventListener("scroll", onScroll, { passive: true });
}
enableHighlights();

// Live accent colour: a few times a second, sample whatever the backdrop is showing (a playing Live
// Photo, an intro clip, two stills mid-crossfade, or the still) and ease the accent towards its strongest
// colour. Kept at the same lightness and strength as the per-scene colours, so accented text stays readable.

function enableLiveTone() {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 15;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let last = "";

  // The most common vivid colour across the middle band of the picture, where the subject usually is
  // (trains, rides, buildings), rather than the sky above or the ground below. Returned as a direction
  // on the colour wheel.
  function strongestHue(source) {
    const { width, height } = canvas;
    context.drawImage(source, 0, 0, width, height);
    const top = Math.floor(height * .27), bottom = Math.ceil(height * .73);
    const data = context.getImageData(0, top, width, bottom - top).data;
    const bins = new Array(24).fill(0);
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index] / 255, g = data[index + 1] / 255, b = data[index + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
      if (chroma < .08) continue; // Greys don't count.
      const hue = (max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) * 60;
      bins[Math.floor(((hue % 360) + 360) % 360 / 15)] += chroma ** 3; // Vivid pixels count far more.
    }
    const score = index => bins[index] + .5 * (bins[(index + 23) % 24] + bins[(index + 1) % 24]);
    let best = 0;
    for (let index = 1; index < 24; index++) if (score(index) > score(best)) best = index;
    if (score(best) < .05) return null; // Almost no colour in view: keep the current accent.
    const angle = ((best * 15 + 7.5) * Math.PI) / 180;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  const ready = video => video && video.readyState >= 2;

  // A scene's precomputed colour as a direction on the colour wheel.
  function sceneHue(scene) {
    const hex = scene && onScreen.toneFor ? onScreen.toneFor(scene) : null;
    if (!hex) return null;
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), chroma = max - Math.min(r, g, b);
    if (!chroma) return null;
    const hue = (max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) * Math.PI / 3;
    return { x: Math.cos(hue), y: Math.sin(hue) };
  }

  function toneHex(hue) {
    // Same normalisation as the scene colours: lightness .48, saturation .65.
    const l = .48, s = .65, c = (1 - Math.abs(2 * l - 1)) * s;
    const h = ((hue / (Math.PI * 2)) * 6 + 6) % 6, x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }

  function sample() {
    if (document.hidden) return;
    let colour;
    // Only moving pictures are sampled live (at 24x15 pixels); stills use their stored colour.
    const clip = document.querySelector(".opening-titles .intro-clip.is-on");
    const live = motionVideo && !motionVideo.paused && motionVideo.classList.contains("is-playing") ? motionVideo : null;
    if (ready(clip)) colour = strongestHue(clip);
    else if (ready(live)) colour = strongestHue(live);
    else if (onScreen.incoming) {
      // Mid-crossfade: blend the two scenes' colours by how far the fade has got.
      const t = Math.min(1, (performance.now() - onScreen.blendStart) / backdropDuration);
      const from = sceneHue(onScreen.still), to = sceneHue(onScreen.incoming);
      colour = from && to ? { x: from.x * (1 - t) + to.x * t, y: from.y * (1 - t) + to.y * t } : to || from;
    } else colour = sceneHue(onScreen.still);
    if (!colour) return;
    const hex = toneHex(Math.atan2(colour.y, colour.x));
    if (hex !== last) {
      last = hex;
      document.body.style.setProperty("--backdrop-tone", hex);
    }
  }

  try {
    sample();
  } catch {
    return; // Opened from disk (file://), where browsers block reading pixels: keep the per-scene colours.
  }
  window.setInterval(() => { try { sample(); } catch {} }, 200);
}

// Headings decode into place as they scroll into view: random characters settle left to right.
function enableHeadingDecode() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>";
  const headings = [...document.querySelectorAll("main h2, main h1")]
    .filter(heading => !heading.closest(".home-hero") && !heading.children.length && heading.textContent.trim());

  function decode(heading) {
    const text = heading.textContent;
    heading.setAttribute("aria-label", text); // Screen readers get the real heading throughout.
    const length = text.length;
    const duration = 450 + length * 22;
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const settled = Math.floor(progress * length);
      let out = text.slice(0, settled);
      for (let index = settled; index < length; index++) {
        out += text[index] === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      heading.textContent = out;
      if (progress < 1) requestAnimationFrame(tick);
      else { heading.textContent = text; heading.removeAttribute("aria-label"); }
    };
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const run = () => decode(entry.target);
      // On the home page, wait for the opening titles to lift first.
      if (introDone) introDone.then(run); else run();
    }
  }, { threshold: .6 });
  headings.forEach(heading => observer.observe(heading));
}

// The main buttons lean gently towards the cursor as it approaches.
function enableMagneticButtons() {
  if (reducedMotion.matches || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const buttons = [...document.querySelectorAll(".hero-button, .home-contact .button")];
  if (!buttons.length) return;
  const reach = 70; // How close (px) the cursor has to be before the pull starts.
  document.addEventListener("pointermove", event => {
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect();
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height / 2);
      const near = Math.abs(dx) < bounds.width / 2 + reach && Math.abs(dy) < bounds.height / 2 + reach;
      button.style.translate = near
        ? `${Math.max(-8, Math.min(8, dx * .2)).toFixed(1)}px ${Math.max(-6, Math.min(6, dy * .3)).toFixed(1)}px`
        : "";
    }
  }, { passive: true });
}

// Depth: the backdrop shifts a few pixels against the cursor, so the glass seems to float in front of it.
function enableBackdropDepth() {
  if (reducedMotion.matches || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const body = document.body;
  let targetX = 0, targetY = 0, x = 0, y = 0, frame = 0;
  const step = () => {
    x += (targetX - x) * .08;
    y += (targetY - y) * .08;
    body.style.setProperty("--depth-x", x.toFixed(2) + "px");
    body.style.setProperty("--depth-y", y.toFixed(2) + "px");
    frame = Math.abs(targetX - x) > .05 || Math.abs(targetY - y) > .05 ? requestAnimationFrame(step) : 0;
  };
  document.addEventListener("pointermove", event => {
    targetX = (event.clientX / window.innerWidth - .5) * -14;
    targetY = (event.clientY / window.innerHeight - .5) * -10;
    if (!frame) frame = requestAnimationFrame(step);
  }, { passive: true });
}

// Buttons send out a quick ripple from exactly where they're pressed, in their own text colour.
function enableRipples() {
  if (reducedMotion.matches) return;
  const selector = ".button, .hero-button, .backdrop-button, .work-viewer button";
  document.addEventListener("pointerdown", event => {
    const button = event.target.closest?.(selector);
    if (!button || event.button !== 0) return;
    const bounds = button.getBoundingClientRect();
    const size = Math.max(bounds.width, bounds.height) * 2.2;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = event.clientX - bounds.left - size / 2 + "px";
    ripple.style.top = event.clientY - bounds.top - size / 2 + "px";
    button.append(ripple);
    ripple.animate([{ transform: "scale(0)", opacity: .32 }, { transform: "scale(1)", opacity: 0 }],
      { duration: 560, easing: "cubic-bezier(.2, .7, .3, 1)" }).finished.then(() => ripple.remove());
  });
}
enableRipples();

// Home page: a slim column of dots on the right edge, one per section. The current section's dot lights
// up in the accent colour; hovering shows its name and clicking glides there.
function enableSectionDots() {
  const story = document.querySelector("main.story");
  if (!story) return;
  const sections = [
    ["Top", ".home-hero"], ["About me", ".home-about-me"], ["Projects", ".home-projects"],
    ["Places", ".places-map"], ["Let\u2019s talk", ".home-contact"],
  ].map(([label, selector]) => ({ label, el: story.querySelector(selector) })).filter(section => section.el);
  if (sections.length < 2) return;

  const nav = document.createElement("nav");
  nav.className = "section-dots";
  nav.setAttribute("aria-label", "Sections");
  for (const section of sections) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<span class="section-dot" aria-hidden="true"></span><span class="section-dot-label">${section.label}</span>`;
    button.setAttribute("aria-label", section.label);
    button.addEventListener("click", () => {
      const smooth = reducedMotion.matches ? "auto" : "smooth";
      if (section.el.matches(".home-hero")) window.scrollTo({ top: 0, behavior: smooth });
      else section.el.scrollIntoView({ behavior: smooth, block: "center" });
    });
    section.button = button;
    nav.append(button);
  }
  document.body.append(nav);

  let frame = 0;
  const update = () => {
    frame = 0;
    const middle = window.innerHeight / 2;
    let best = sections[0], distance = Infinity;
    for (const section of sections) {
      const rect = section.el.getBoundingClientRect();
      const d = Math.abs(rect.top + rect.height / 2 - middle);
      if (d < distance) { distance = d; best = section; }
    }
    for (const section of sections) {
      if (section === best) section.button.setAttribute("aria-current", "true");
      else section.button.removeAttribute("aria-current");
    }
  };
  window.addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  window.addEventListener("resize", update);
  update();
}
enableSectionDots();

// ---------------------------------------------------------------------------------------------
// Interactions: small conveniences that make the site quick to get around.

// A short glass message near the bottom of the screen that confirms an action, then fades away.
const toast = (() => {
  let element, timer;
  return message => {
    if (!element) {
      element = document.createElement("div");
      element.className = "toast";
      element.setAttribute("role", "status");
      document.body.append(element);
    }
    element.textContent = message;
    element.classList.add("is-showing");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => element.classList.remove("is-showing"), 1800);
  };
})();

const email = "me@alexcutrupi.com";
async function copyEmail() {
  try {
    await navigator.clipboard.writeText(email);
    toast("Email copied");
  } catch {
    window.location.href = "mailto:" + email; // Clipboard unavailable: open an email instead.
  }
}

// Clicks a backdrop control if this page has it, and confirms what happened.
function backdropAction(selector, message) {
  const button = document.querySelector(selector);
  if (!button || button.hidden) return false;
  button.click();
  if (message) toast(typeof message === "function" ? message() : message);
  return true;
}
const backdropPaused = () => document.querySelector(".backdrop-toggle")?.getAttribute("aria-label")?.startsWith("Play");

// Quick search (Cmd/Ctrl+K, "/", or the search button in the navigation): type to jump anywhere.
function enableQuickSearch() {
  const onHome = Boolean(document.querySelector("main.story"));
  const go = href => () => {
    const [page, hash] = href.split("#");
    if (onHome && page === "index.html" && hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
    } else window.location.href = href;
  };
  const items = [
    { group: "Pages", label: "Home", hint: "", run: go("index.html") },
    { group: "Pages", label: "Projects", run: go("past-projects.html") },
    { group: "Pages", label: "Skills", run: go("skills.html") },
    { group: "Pages", label: "Education & Career", run: go("education-career.html") },
    { group: "Pages", label: "Contact", run: go("contact.html") },
    { group: "Sections", label: "About me", run: go("index.html#about-me") },
    { group: "Sections", label: "Places I\u2019ve photographed", keywords: "map photography", run: go("index.html#places-explored") },
    { group: "Projects", label: "Home network & room build", keywords: "electrical wiring cabling plastering gallery photos", run: go("past-projects.html#hands-on") },
    { group: "Projects", label: "BlastHost", keywords: "linux servers hosting networking", run: go("past-projects.html#blasthost") },
    { group: "Projects", label: "Pistopass", keywords: "loyalty cards business", run: go("past-projects.html#pistopass") },
    { group: "Actions", label: "Copy my email", keywords: "contact", run: copyEmail },
    { group: "Actions", label: "Send me an email", keywords: "contact mail", run: () => { window.location.href = "mailto:" + email; } },
    { group: "Backdrop", label: "Photos only", hint: "P", keywords: "hide content backdrop", run: () => backdropAction(".backdrop-view") },
    { group: "Backdrop", label: "Next photo", hint: "\u2192", run: () => backdropAction(".backdrop-next", "Next photo") },
    { group: "Backdrop", label: "Previous photo", hint: "\u2190", run: () => backdropAction(".backdrop-previous", "Previous photo") },
    { group: "Backdrop", label: "Pause or play the slideshow", hint: "K", run: () => backdropAction(".backdrop-toggle", () => backdropPaused() ? "Slideshow paused" : "Slideshow playing") },
    { group: "Elsewhere", label: "GitHub", run: () => window.open("https://github.com/alexcutrupi", "_blank", "noopener") },
    { group: "Elsewhere", label: "Instagram", run: () => window.open("https://www.instagram.com/cutrupi.alex/", "_blank", "noopener") },
    { group: "Elsewhere", label: "YouTube", run: () => window.open("https://www.youtube.com/@alexcutrupi", "_blank", "noopener") },
  ];

  // Full-text search: the first time the search opens, read every page and index its headings,
  // paragraphs, list items and captions. Reading the live pages keeps it in step with any edits.
  const pages = [["index.html", "Home"], ["past-projects.html", "Projects"], ["skills.html", "Skills"],
    ["education-career.html", "Education & Career"], ["contact.html", "Contact"]];
  const blocks = "h1, h2, h3, h4, p, li:not(.work-gallery li), dt, dd, figcaption, .work-gallery li span";
  let textIndex = null;
  let indexing = null;
  // An element's text with a space between each piece, so side-by-side tags don't run together.
  const readText = element => {
    const parts = [];
    const walker = doc => doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let walk = walker(element.ownerDocument), node = walk.nextNode(); node; node = walk.nextNode()) parts.push(node.nodeValue);
    return parts.join(" ").replace(/\s+/g, " ").replace(/ ([,.;:!?\u2019])/g, "$1").trim();
  };
  function extract(doc, url, pageName) {
    const main = doc.querySelector("main");
    if (!main) return [];
    const entries = [];
    const seen = new Set();
    let heading = { text: pageName, id: "" };
    for (const element of main.querySelectorAll("*")) {
      if (element.closest("svg, script, style, [aria-hidden='true']")) continue;
      if (/^H[1-4]$/.test(element.tagName)) {
        const section = element.id ? element : element.closest("[id]:not(main)");
        heading = { text: element.textContent.replace(/\s+/g, " ").trim(), id: section?.id ?? "" };
      }
      if (!element.matches(blocks) || element.querySelector("p, li, h1, h2, h3, h4, dt, dd")) continue;
      const text = readText(element);
      if (text.length < 3 || seen.has(text)) continue;
      seen.add(text);
      const anchor = element.closest("[id]:not(main)")?.id || heading.id;
      const lower = text.toLowerCase();
      entries.push({ url, page: pageName, anchor, heading: heading.text, text, lower,
        headingLower: heading.text.toLowerCase(), tokens: lower.match(/[a-z0-9]+/g) ?? [] });
    }
    return entries;
  }
  function loadIndex() {
    indexing ??= Promise.all(pages.map(async ([url, name]) => {
      const response = await fetch(url);
      if (!response.ok) return [];
      return extract(new DOMParser().parseFromString(await response.text(), "text/html"), url, name);
    })).then(lists => {
      textIndex = lists.flat();
      if (dialog.open && input.value.trim()) render();
    }).catch(() => { textIndex = []; }); // Opened from disk (file://): only the quick actions work.
  }

  // Within one typo: one letter added, removed or changed.
  function nearly(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  // Everyday short forms of words used on the site.
  const synonyms = { maths: "mathematics", math: "mathematics", it: "infrastructure", pc: "pc", wifi: "wi-fi",
    compsci: "computer", sparky: "electrical", electrician: "electrical", coding: "programming", code: "programming",
    lights: "lighting", trains: "train", servers: "server", photos: "photography", pics: "photography" };
  // Every word has to match: whole words score best, then the start of a word, then anywhere, then a typo.
  // If nothing matches every word, the closest partial matches are shown instead.
  function searchText(words) {
    if (!textIndex || !words.length) return [];
    words = words.map(word => synonyms[word] ?? word);
    const all = rank(words, false);
    return all.length || words.length < 2 ? all : rank(words, true);
  }
  function rank(words, partial) {
    const results = [];
    for (const entry of textIndex) {
      let score = 0;
      const marks = [];
      let ok = true;
      for (const word of words) {
        if (entry.tokens.includes(word)) { score += 4; marks.push(word); }
        else if (entry.tokens.some(token => token.startsWith(word))) { score += 3; marks.push(word); }
        else if (word.length >= 3 && entry.lower.includes(word)) { score += 2; marks.push(word); }
        else {
          const close = word.length >= 4 && entry.tokens.find(token => token.length >= 4 && nearly(token, word));
          if (close) { score += 1; marks.push(close); }
          else if (!partial) { ok = false; break; }
        }
        if (entry.headingLower.includes(word)) score += 2;
      }
      if (ok && marks.length) results.push({ entry, score: score - entry.text.length / 400, marks });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  }
  const escapeHtml = text => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // A short extract around the first match, with every matched word marked.
  function snippet(text, marks) {
    const lower = text.toLowerCase();
    const at = Math.max(0, Math.min(...marks.map(mark => lower.indexOf(mark)).filter(i => i >= 0)));
    const start = Math.max(0, at - 50);
    const end = Math.min(text.length, at + 100);
    let html = escapeHtml((start ? "\u2026" : "") + text.slice(start, end) + (end < text.length ? "\u2026" : ""));
    for (const mark of [...new Set(marks)].sort((a, b) => b.length - a.length)) {
      html = html.replace(new RegExp(`(${mark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
    }
    return html;
  }
  // Go to a text result, then scroll its text into view and flash it.
  function goToText(entry, word) {
    try { sessionStorage.setItem("searchFlash", JSON.stringify({ text: entry.text.slice(0, 80), word })); } catch {}
    const here = location.pathname.endsWith(entry.url) || (entry.url === "index.html" && /\/$/.test(location.pathname));
    if (here) flashSearchResult();
    else window.location.href = entry.url + (entry.anchor ? "#" + entry.anchor : "");
  }

  const dialog = document.createElement("dialog");
  dialog.className = "quick-search";
  dialog.setAttribute("aria-label", "Quick search");
  dialog.innerHTML = '<div class="quick-search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
    '<input type="text" placeholder="Search everything on the site\u2026" aria-label="Search" autocomplete="off" spellcheck="false">' +
    '<kbd>Esc</kbd></div><ul class="quick-search-results" role="listbox"></ul>' +
    '<p class="quick-search-foot"><span><kbd>\u2191</kbd><kbd>\u2193</kbd> move</span><span><kbd>\u21B5</kbd> open</span><span><kbd>\u2190</kbd><kbd>\u2192</kbd> photos \u00B7 <kbd>P</kbd> photos only \u00B7 <kbd>K</kbd> pause</span></p>';
  document.body.append(dialog);
  const input = dialog.querySelector("input");
  const list = dialog.querySelector("ul");
  let shown = [];
  let active = 0;

  function render() {
    const words = input.value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    shown = items.filter(item => {
      const text = `${item.label} ${item.group} ${item.keywords ?? ""}`.toLowerCase();
      return words.every(word => text.includes(word));
    });
    // Matching text from across the site, below the quick actions.
    for (const { entry, marks } of searchText(words)) {
      shown.push({ group: "On this site", label: entry.heading, page: entry.page, html: snippet(entry.text, marks),
        run: () => goToText(entry, marks[0]) });
    }
    if (words.length && !textIndex) shown.push({ group: "On this site", label: "Searching the site\u2026", pending: true, run: () => {} });
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.innerHTML = "";
    let group = "";
    shown.forEach((item, index) => {
      if (item.group !== group) {
        group = item.group;
        const heading = document.createElement("li");
        heading.className = "quick-search-group";
        heading.setAttribute("role", "presentation");
        heading.textContent = group;
        list.append(heading);
      }
      const option = document.createElement("li");
      option.className = "quick-search-item";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === active));
      if (item.html) {
        option.classList.add("is-text-result");
        option.innerHTML = `<span class="quick-search-title"></span><span class="quick-search-snippet">${item.html}</span>`;
        option.firstChild.textContent = `${item.label} \u00B7 ${item.page}`;
      } else {
        option.innerHTML = `<span></span>${item.hint ? `<kbd>${item.hint}</kbd>` : ""}`;
        option.firstChild.textContent = item.label;
        if (item.pending) option.classList.add("is-pending");
      }
      option.addEventListener("pointermove", () => { if (active !== index) { active = index; highlight(); } });
      option.addEventListener("click", () => choose(index));
      list.append(option);
    });
    if (!shown.length) {
      const empty = document.createElement("li");
      empty.className = "quick-search-empty";
      empty.textContent = "Nothing found";
      list.append(empty);
    }
  }
  function highlight() {
    list.querySelectorAll(".quick-search-item").forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === active));
      if (index === active) option.scrollIntoView({ block: "nearest" });
    });
  }
  function choose(index) {
    const item = shown[index];
    if (!item) return;
    dialog.close();
    item.run();
  }
  function open(text = "") {
    if (dialog.open) return;
    loadIndex();
    input.value = text;
    active = 0;
    render();
    dialog.showModal();
    input.focus();
  }

  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { event.preventDefault(); active = (active + 1) % Math.max(1, shown.length); highlight(); }
    if (event.key === "ArrowUp") { event.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); highlight(); }
    if (event.key === "Enter") { event.preventDefault(); choose(active); }
  });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

  // A search button in the navigation bar, on every page.
  const nav = document.querySelector(".site-header .nav");
  if (nav) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-button";
    button.setAttribute("aria-label", "Quick search");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
      '<span class="search-button-label">Search</span>' +
      `<kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318" : "Ctrl "}K</kbd>`;
    button.addEventListener("click", () => open());
    nav.append(button);
  }
  return open;
}
const openQuickSearch = enableQuickSearch();

// Keyboard shortcuts: Cmd/Ctrl+K or "/" search, "?" shortcuts, arrows change photo, P photos only, K pause.
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openQuickSearch();
    return;
  }
  const typing = event.target.closest?.("input, textarea, select, [contenteditable]");
  if (typing || event.metaKey || event.ctrlKey || event.altKey || document.querySelector("dialog[open]")) return;
  if (document.documentElement.classList.contains("intro")) return;
  const main = document.getElementById("main");
  if (event.key === "/") { event.preventDefault(); openQuickSearch(); }
  else if (event.key === "?") { event.preventDefault(); openQuickSearch(); }
  else if (event.key.toLowerCase() === "p") { if (backdropAction(".backdrop-view")) event.preventDefault(); }
  else if (event.key.toLowerCase() === "k") {
    if (backdropAction(".backdrop-toggle", () => backdropPaused() ? "Slideshow paused" : "Slideshow playing")) event.preventDefault();
  } else if (!main?.hidden && (event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.shiftKey) {
    // (In Photos only mode the arrows are already handled by the backdrop itself.)
    if (backdropAction(event.key === "ArrowLeft" ? ".backdrop-previous" : ".backdrop-next")) event.preventDefault();
  }
});

// One-click copy beside the email address on the Contact page.
for (const link of document.querySelectorAll(".contact-email")) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Copy</span>';
  button.setAttribute("aria-label", "Copy email address");
  button.addEventListener("click", copyEmail);
  link.after(button);
}

// Back to top: a small round button once you've scrolled a screen's worth down.
(() => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "back-to-top";
  button.setAttribute("aria-label", "Back to top");
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }));
  document.body.append(button);
  let frame = 0;
  const update = () => { frame = 0; button.classList.toggle("is-showing", window.scrollY > window.innerHeight * .9); };
  window.addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  update();
})();

// After a text search result: scroll the matching text into view and flash it in the accent colour.
function flashSearchResult() {
  let target;
  try { target = JSON.parse(sessionStorage.getItem("searchFlash")); sessionStorage.removeItem("searchFlash"); } catch {}
  if (!target?.text) return;
  const run = () => {
    const main = document.getElementById("main");
    // Compare without spaces: the search adds spaces between side-by-side tags that the page doesn't have.
    const want = target.text.replace(/\s+/g, "");
    const element = [...main.querySelectorAll("h1, h2, h3, h4, p, li, dt, dd, figcaption, span")]
      .find(candidate => candidate.textContent.replace(/\s+/g, "").startsWith(want));
    if (!element) return;
    element.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
    element.classList.remove("search-flash");
    void element.offsetWidth; // Restart the animation if it's the same element again.
    element.classList.add("search-flash");
    window.setTimeout(() => element.classList.remove("search-flash"), 2600);
  };
  if (introDone) introDone.then(() => window.setTimeout(run, 300)); else window.setTimeout(run, 350);
}
flashSearchResult();

// Clicking a project card on the home page marks it, so the page transition can morph that card into
// the project's header on the Projects page (see .is-morphing in styles.css). Only the clicked card is
// marked, so the other two don't move.
for (const card of document.querySelectorAll(".project-card")) {
  card.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    document.querySelectorAll(".project-card.is-morphing").forEach(other => other.classList.remove("is-morphing"));
    card.classList.add("is-morphing");
  });
}
// Coming back to the home page, nothing should still be marked.
window.addEventListener("pageshow", () => {
  document.querySelectorAll(".project-card.is-morphing").forEach(card => card.classList.remove("is-morphing"));
});

// Navigation pill: sits behind the current page's link, follows the pointer across the links, and glides
// back when the pointer leaves.
(() => {
  const list = document.querySelector(".nav-links");
  if (!list || !window.matchMedia("(min-width: 961px)").matches) return;
  const links = [...list.querySelectorAll("a")];
  const current = list.querySelector('a[aria-current="page"]');
  const pill = document.createElement("span");
  pill.className = "nav-pill";
  pill.setAttribute("aria-hidden", "true");
  list.prepend(pill);
  document.body.classList.add("has-nav-pill");
  const moveTo = link => {
    if (!link) { pill.style.opacity = "0"; return; }
    const box = list.getBoundingClientRect(), r = link.getBoundingClientRect();
    const pad = 12;
    pill.style.setProperty("--pill-x", r.left - box.left - pad + "px");
    pill.style.setProperty("--pill-w", r.width + pad * 2 + "px");
    pill.style.opacity = "";
  };
  moveTo(current);
  requestAnimationFrame(() => pill.classList.add("is-ready"));
  links.forEach(link => {
    link.addEventListener("pointerenter", () => moveTo(link));
    link.addEventListener("focus", () => moveTo(link));
  });
  list.addEventListener("pointerleave", () => moveTo(current));
  list.addEventListener("focusout", event => { if (!list.contains(event.relatedTarget)) moveTo(current); });
  window.addEventListener("resize", () => moveTo(current));
  document.fonts?.ready.then(() => moveTo(current));
})();

// Home page: a gentle snap. Scrolling is completely free; once it stops, the nearest section eases slowly
// into the middle of the screen. Scrolling again lets go at once. A section taller than the screen that
// you've stopped inside is left alone, and nothing moves for people who prefer reduced motion.
(() => {
  const story = document.querySelector("main.story");
  if (!story || reducedMotion.matches) return;
  const sections = [...story.querySelectorAll(":scope > .story-panel")];
  const top = 80, bottom = 72; // Keep clear of the navigation bar and the controls bar.
  let animating = false, frame = 0, settle = 0;

  // A section's position in the page layout, ignoring transforms (sections slide and scale in as they
  // arrive, which would otherwise move the target while it's being worked out).
  const layoutTop = element => {
    let y = 0;
    for (let node = element; node; node = node.offsetParent) y += node.offsetTop;
    return y;
  };
  // Where each section sits when settled: the title at the very top, the rest centred on screen.
  function targets() {
    const area = window.innerHeight - top - bottom;
    const middle = top + area / 2;
    return sections.map(section => {
      const y = layoutTop(section), h = section.offsetHeight;
      const at = section.classList.contains("home-hero") ? 0 : y + h / 2 - middle;
      const viewTop = y - window.scrollY;
      return { at, inside: h > area && viewTop < top && viewTop + h > window.innerHeight - bottom };
    });
  }
  // Follow the direction of the scroll: even a short scroll down carries on to the next section down (and
  // up to the one above); a tiny nudge eases back to where it was.
  let anchor = window.scrollY;
  function target() {
    const list = targets();
    if (list.some(item => item.inside)) return null; // Stopped inside a tall section: leave it.
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const now = window.scrollY, moved = now - anchor;
    let pool = list;
    if (Math.abs(moved) >= 30) {
      const ahead = list.filter(item => moved > 0 ? item.at > anchor + 10 : item.at < anchor - 10);
      if (ahead.length) pool = ahead;
    }
    const best = pool.reduce((a, b) => Math.abs(b.at - now) < Math.abs(a.at - now) ? b : a);
    const to = Math.max(0, Math.min(max, best.at));
    return Math.abs(to - now) < 6 ? null : to;
  }

  function glide(to) {
    const from = window.scrollY;
    if (Math.abs(to - from) < 6) return;
    const duration = Math.min(1100, 500 + Math.abs(to - from) * .9); // Slow and soft, longer for longer moves.
    const start = performance.now();
    animating = true;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = now => {
      if (!animating) return;
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo({ top: from + (to - from) * ease(t), behavior: "instant" });
      if (t < 1) frame = requestAnimationFrame(step);
      else { animating = false; frame = 0; anchor = to; }
    };
    frame = requestAnimationFrame(step);
  }

  const letGo = () => { if (animating) { animating = false; cancelAnimationFrame(frame); } };
  for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(type, letGo, { passive: true });

  // Wait for scrolling (including momentum on trackpads and phones) to stop, then settle.
  window.addEventListener("scroll", () => {
    if (animating || document.documentElement.classList.contains("intro") || document.getElementById("main")?.hidden) return;
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      const to = target();
      if (to !== null) glide(to); else anchor = window.scrollY;
    }, 220);
  }, { passive: true });
})();
