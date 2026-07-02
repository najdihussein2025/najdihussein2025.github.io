/* site.js — renders the page from Store.load() (data.js + your local draft) */

const data = Store.load();

/* ---------- Hero / profile ---------- */
/* The old text hero was replaced by the cinematic 3D hero
   (js/cinematic-hero.js), so every hero element is optional now. */
function renderProfile() {
  const p = data.profile;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("hero-location", p.location + " — " + p.title);
  const nameEl = document.getElementById("hero-name");
  if (nameEl) nameEl.innerHTML = p.name.replace(" ", "<br />");
  setText("hero-tagline", p.tagline);
  setText("hero-intro", p.intro);
  setText("hero-title", p.title);

  const availability = document.getElementById("availability");
  if (availability && p.available) availability.hidden = false;

  const img = document.getElementById("profile-photo");
  if (img) {
    img.src = p.photo || "assets/me.jpg";
    img.addEventListener("error", () => {
      img.style.display = "none";
      document.querySelector(".portrait-fallback").style.display = "flex";
    });
  }

  document.getElementById("contact-email").href = "mailto:" + p.email;
  document.getElementById("contact-phone").href =
    "tel:" + p.phone.replace(/\s/g, "");
  const li = document.getElementById("contact-linkedin");
  if (p.linkedin && p.linkedin !== "#") li.href = p.linkedin;
  else li.style.display = "none";
}

/* ---------- Services ---------- */
function renderServices() {
  document.getElementById("services-grid").innerHTML = data.services
    .map(
      (s) => `
      <article class="service-card reveal">
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.description)}</p>
      </article>`
    )
    .join("");
}

/* ---------- Work ---------- */
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

function renderWork() {
  document.getElementById("work-list").innerHTML = data.projects
    .map(
      (p, idx) => `
      <article class="work-item reveal">
        <span class="work-index">${ROMAN[idx] || idx + 1}</span>
        <div class="work-main">
          <h3>${
            p.link
              ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.title)} ↗</a>`
              : esc(p.title)
          }</h3>
          <p>${esc(p.description)}</p>
          <div class="work-stack">
            ${p.stack.map((s) => `<span class="work-chip">${esc(s)}</span>`).join("")}
          </div>
        </div>
        <span class="work-type">${esc(p.type)}</span>
      </article>`
    )
    .join("");
}

/* ---------- Skills ---------- */
function renderSkills() {
  document.getElementById("skills-panel").innerHTML = data.skills
    .map(
      (row) => `
      <div class="skills-row">
        <span class="label">${esc(row.group)}</span>
        <div class="skills-items">
          ${row.items.map((s) => `<span class="work-chip">${esc(s)}</span>`).join("")}
        </div>
      </div>`
    )
    .join("");
}

/* ---------- Helpers ---------- */
function esc(str) {
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  items.forEach((el) => io.observe(el));
}

renderProfile();
renderServices();
renderWork();
renderSkills();
setupReveal();
document.getElementById("year").textContent = new Date().getFullYear();
