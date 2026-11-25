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
  menu.addEventListener("keydown", closeMenuOnEscape);
  menuToggle.addEventListener("keydown", closeMenuOnEscape);
  window.matchMedia("(max-width: 900px)").addEventListener("change", () => setMenuOpen(false));
}

function closeMenuOnEscape(event) {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuToggle.focus();
  }
}
