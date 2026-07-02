/* ============================================================
   admin.js — private dashboard logic

   PASSWORD: Huss@400
   Session expires after 8 hours (sessionStorage, this tab only).
   ============================================================ */

const PASS_HASH =
  "533ecc807be68b8f65b8a285ea57f21898107c331d5ff817699be0295b91cf7c";

const SESSION_KEY = "hn_admin_session";
const SESSION_MS = 8 * 60 * 60 * 1000;

let draft = null;
let editingIndex = null;
let loginAttempts = 0;

const loginScreen = document.getElementById("login-screen");
const dash = document.getElementById("dash");

/* ---------------- Auth ---------------- */

async function sha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  if (raw === "1") {
    const session = { v: 1, t: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }
  try {
    const session = JSON.parse(raw);
    if (session?.v !== 1 || typeof session.t !== "number") return null;
    if (Date.now() - session.t > SESSION_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function isAuthed() {
  return readSession() !== null;
}

function createSession() {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ v: 1, t: Date.now() })
  );
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function applyAuthView() {
  const authed = isAuthed();
  document.body.classList.toggle("auth-locked", !authed);
  document.body.classList.remove("auth-loading");
  loginScreen.setAttribute("aria-hidden", authed ? "true" : "false");
  dash.setAttribute("aria-hidden", authed ? "false" : "true");
}

function requireAuth(action) {
  if (isAuthed()) return true;
  applyAuthView();
  toast("Please log in to continue");
  document.getElementById("password").focus();
  return false;
}

async function tryLogin() {
  const input = document.getElementById("password");
  const error = document.getElementById("login-error");

  if (loginAttempts >= 5) {
    error.textContent = "Too many attempts. Refresh the page and try again.";
    error.hidden = false;
    return;
  }

  const hash = await sha256(input.value);
  if (hash === PASS_HASH) {
    loginAttempts = 0;
    createSession();
    error.hidden = true;
    input.value = "";
    showDash();
    return;
  }

  loginAttempts += 1;
  error.textContent = "Wrong password.";
  error.hidden = false;
  input.value = "";
  input.focus();
}

function showDash() {
  if (!isAuthed()) {
    showLogin();
    return;
  }
  applyAuthView();
  renderAll();
  scrollToSection(location.hash);
}

function showLogin() {
  clearSession();
  applyAuthView();
  document.getElementById("password").value = "";
  document.getElementById("login-error").hidden = true;
  document.getElementById("password").focus();
}

function scrollToSection(hash) {
  if (!hash || hash === "#") return;
  const id = hash.slice(1);
  const target =
    document.getElementById(id) ||
    document.querySelector(`[data-section="${id}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------- Rendering ---------------- */

function renderAll() {
  if (!requireAuth()) return;
  renderProfileFields();
  renderAboutFields();
  renderContactFields();
  renderDesktopFields();
  renderProjects();
}

function renderProfileFields() {
  const p = draft.profile;
  document.getElementById("f-name").value = p.name;
  document.getElementById("f-title").value = p.title;
  document.getElementById("f-location").value = p.location;
  document.getElementById("f-tagline").value = p.tagline;
  document.getElementById("f-intro").value = p.intro;
  document.getElementById("f-available").checked = !!p.available;

  const img = document.getElementById("admin-photo");
  const empty = document.getElementById("photo-empty");
  if (p.photo && p.photo.startsWith("data:")) {
    img.src = p.photo;
    img.style.display = "block";
    empty.style.display = "none";
  } else {
    img.src = p.photo || "assets/me.jpg";
    img.onerror = () => {
      img.style.display = "none";
      empty.style.display = "flex";
    };
  }
}

function renderAboutFields() {
  const a = draft.about;
  document.getElementById("a-heading").value = a.heading;
  document.getElementById("a-bio").value = a.bio;
  document.getElementById("a-badges").value = a.badges.join(", ");
}

function renderContactFields() {
  const p = draft.profile;
  const c = draft.contact;
  document.getElementById("c-email").value = p.email;
  document.getElementById("c-phone").value = p.phone;
  document.getElementById("c-term1").value = c.terminalLine1;
  document.getElementById("c-term2").value = c.terminalLine2;
  document.getElementById("c-footer").value = c.footer;
}

function renderDesktopFields() {
  const d = draft.desktop;
  document.getElementById("d-brand").value = d.brand;
  document.getElementById("d-path").value = d.path;
  document.getElementById("d-location").value = d.location;
  document.getElementById("d-wallpaper").value = d.wallpaper;
  document.getElementById("d-monitor").value = (d.monitorCode || []).join("\n");
}

function renderProjects() {
  const wrap = document.getElementById("admin-projects");
  if (!draft.projects.length) {
    wrap.innerHTML = `<p class="hint">No projects yet. Click “Add project”.</p>`;
    return;
  }

  wrap.innerHTML = draft.projects
    .map(
      (p, i) => `
      <div class="admin-project">
        <div>
          <h4>${esc(p.title)}</h4>
          <span class="meta">${esc(p.slug || slugFromTitle(p.title))} · ${esc(p.type)} · ${p.stack.map(esc).join(", ")}</span>
          ${projectLinksMeta(p)}
        </div>
        <div class="admin-project-actions">
          <button class="btn btn--quiet btn--small" data-edit="${i}">Edit</button>
          <button class="btn btn--danger btn--small" data-delete="${i}">Delete</button>
        </div>
      </div>`
    )
    .join("");

  wrap.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!requireAuth()) return;
      const i = Number(btn.dataset.delete);
      if (confirm(`Delete "${draft.projects[i].title}"?`)) {
        draft.projects.splice(i, 1);
        persist("Project deleted");
        renderProjects();
      }
    })
  );

  wrap.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openForm(Number(btn.dataset.edit)))
  );
}

function projectLinksMeta(p) {
  const parts = [];
  if (p.github) parts.push("GitHub");
  if (p.url) parts.push("Live");
  if (!parts.length) return "";
  return `<span class="meta">${parts.join(" · ")} linked</span>`;
}

/* ---------------- Project form ---------------- */

function openForm(index) {
  if (!requireAuth()) return;
  editingIndex = index === undefined ? null : index;
  const panel = document.getElementById("project-form-panel");
  panel.hidden = false;

  const isEdit = editingIndex !== null;
  document.getElementById("form-title").textContent = isEdit
    ? "Edit project"
    : "New project";

  const p = isEdit
    ? draft.projects[editingIndex]
    : { title: "", slug: "", type: "", description: "", stack: [], github: "", url: "" };

  document.getElementById("p-title").value = p.title;
  document.getElementById("p-slug").value = p.slug;
  document.getElementById("p-type").value = p.type;
  document.getElementById("p-description").value = p.description;
  document.getElementById("p-stack").value = p.stack.join(", ");
  document.getElementById("p-github").value = p.github;
  document.getElementById("p-url").value = p.url;

  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("p-title").focus();
}

function closeForm() {
  document.getElementById("project-form-panel").hidden = true;
  editingIndex = null;
}

function saveProject() {
  if (!requireAuth()) return;
  const title = document.getElementById("p-title").value.trim();
  const project = {
    title,
    slug: document.getElementById("p-slug").value.trim() || slugFromTitle(title),
    type: document.getElementById("p-type").value.trim() || "Personal",
    description: document.getElementById("p-description").value.trim(),
    stack: document
      .getElementById("p-stack")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    github: document.getElementById("p-github").value.trim(),
    url: document.getElementById("p-url").value.trim()
  };

  if (!project.title) {
    toast("Title is required");
    return;
  }

  if (editingIndex !== null) draft.projects[editingIndex] = project;
  else draft.projects.unshift(project);

  persist(editingIndex !== null ? "Project updated" : "Project added");
  closeForm();
  renderProjects();
}

function slugFromTitle(title) {
  const base = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `${base || "project"}.sys`;
}

/* ---------------- Photo ---------------- */

function handlePhoto(file) {
  if (!requireAuth()) return;
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast("Image too large — please use one under 5 MB");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    draft.profile.photo = reader.result;
    persist("Photo updated");
    renderProfileFields();
  };
  reader.readAsDataURL(file);
}

/* ---------------- Persistence ---------------- */

function persist(message) {
  if (!requireAuth()) return;
  Store.saveDraft(draft);
  if (message) toast(message + " — draft saved");
}

function downloadDataFile() {
  if (!requireAuth()) return;
  const blob = new Blob([Store.exportFile(draft)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "portfolio.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("portfolio.json downloaded — replace data/portfolio.json and push");
}

/* ---------------- Helpers ---------------- */

function esc(str) {
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

function bindField(id, apply) {
  const el = document.getElementById(id);
  el.addEventListener("change", () => {
    if (!requireAuth()) return;
    apply(el.value);
    persist();
  });
}

/* ---------------- Events ---------------- */

document.getElementById("login-btn").addEventListener("click", tryLogin);
document.getElementById("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryLogin();
});

document.getElementById("logout-btn").addEventListener("click", () => {
  showLogin();
});

bindField("f-name", (v) => { draft.profile.name = v; });
bindField("f-title", (v) => { draft.profile.title = v; });
bindField("f-location", (v) => { draft.profile.location = v; });
bindField("f-tagline", (v) => { draft.profile.tagline = v; });
bindField("f-intro", (v) => { draft.profile.intro = v; });

document.getElementById("f-available").addEventListener("change", (e) => {
  if (!requireAuth()) return;
  draft.profile.available = e.target.checked;
  persist("Availability updated");
});

bindField("a-heading", (v) => { draft.about.heading = v; });
bindField("a-bio", (v) => { draft.about.bio = v; });
bindField("a-badges", (v) => {
  draft.about.badges = v.split(",").map((s) => s.trim()).filter(Boolean);
});

bindField("c-email", (v) => { draft.profile.email = v; });
bindField("c-phone", (v) => { draft.profile.phone = v; });
bindField("c-term1", (v) => { draft.contact.terminalLine1 = v; });
bindField("c-term2", (v) => { draft.contact.terminalLine2 = v; });
bindField("c-footer", (v) => { draft.contact.footer = v; });

bindField("d-brand", (v) => { draft.desktop.brand = v; });
bindField("d-path", (v) => { draft.desktop.path = v; });
bindField("d-location", (v) => { draft.desktop.location = v; });
bindField("d-wallpaper", (v) => { draft.desktop.wallpaper = v; });
bindField("d-monitor", (v) => {
  draft.desktop.monitorCode = v.split("\n");
});

document.getElementById("delete-all-projects-btn").addEventListener("click", () => {
  if (!requireAuth()) return;
  if (!draft.projects.length) {
    toast("No projects to delete");
    return;
  }
  if (confirm(`Delete all ${draft.projects.length} projects?`)) {
    draft.projects = [];
    persist("All projects deleted");
    renderProjects();
  }
});

document.getElementById("photo-input").addEventListener("change", (e) => {
  handlePhoto(e.target.files[0]);
});

document.getElementById("add-project-btn").addEventListener("click", () => openForm());
document.getElementById("save-project-btn").addEventListener("click", saveProject);
document.getElementById("cancel-project-btn").addEventListener("click", closeForm);

document.getElementById("download-btn").addEventListener("click", downloadDataFile);

document.getElementById("discard-btn").addEventListener("click", async () => {
  if (!requireAuth()) return;
  if (confirm("Discard all local edits and go back to the published version?")) {
    Store.discardDraft();
    draft = await Store.load();
    renderAll();
    toast("Draft discarded");
  }
});

window.addEventListener("hashchange", () => {
  if (isAuthed()) scrollToSection(location.hash);
});

/* ---------------- Init ---------------- */

async function init() {
  try {
    draft = await Store.load();
  } catch (e) {
    toast("Could not load portfolio.json — using empty template");
    draft = Store.empty();
  }

  if (isAuthed()) showDash();
  else showLogin();
}

init();
