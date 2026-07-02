/* ============================================================
   store.js — shared data access for site + admin.

   All content lives in data/portfolio.json.
   Admin edits → localStorage draft → download JSON → push to repo.
   ============================================================ */

const STORE_KEY = "hn_portfolio_draft";
const DATA_URL = "data/portfolio.json";

function emptyPortfolio() {
  return {
    site: {
      monogram: "H·N",
      introHint: "scroll to enter the workspace",
      emailButton: "Email me",
      phoneButton: "Call / WhatsApp",
      navCta: "Start a project"
    },
    profile: {
      name: "",
      title: "",
      location: "",
      tagline: "",
      intro: "",
      email: "",
      phone: "",
      linkedin: "",
      photo: "assets/me.jpg",
      available: false
    },
    about: {
      heading: "",
      bio: "",
      badges: []
    },
    contact: {
      terminalLine1: "",
      terminalLine2: "",
      footer: ""
    },
    desktop: {
      brand: "HN-OS",
      path: "",
      location: "",
      aboutPath: "~/about-me/",
      projectsPath: "~/projects/",
      contactTitle: "",
      wallpaper: "",
      monitorCode: []
    },
    projects: []
  };
}

function normalizeData(data) {
  const base = emptyPortfolio();
  const profile = data?.profile || {};
  const about = data?.about || {};
  const contact = data?.contact || {};
  const desktop = data?.desktop || {};
  const site = data?.site || {};

  return {
    site: { ...base.site, ...site },
    profile: { ...base.profile, ...profile, available: !!profile.available },
    about: {
      heading: about.heading ?? profile.name ?? "",
      bio: about.bio ?? profile.intro ?? "",
      badges: Array.isArray(about.badges) ? about.badges : []
    },
    contact: { ...base.contact, ...contact },
    desktop: {
      ...base.desktop,
      ...desktop,
      monitorCode: Array.isArray(desktop.monitorCode) ? desktop.monitorCode : []
    },
    projects: (data?.projects || []).map((project) => ({
      title: project.title || "Untitled project",
      slug: project.slug || "",
      type: project.type || "Personal",
      description: project.description || "",
      stack: Array.isArray(project.stack) ? project.stack : [],
      github: project.github || project.link || "",
      url: project.url || ""
    }))
  };
}

const Store = {
  _cached: null,

  empty() {
    return structuredClone(emptyPortfolio());
  },

  async load() {
    try {
      const draft = localStorage.getItem(STORE_KEY);
      if (draft) {
        this._cached = normalizeData(JSON.parse(draft));
        return structuredClone(this._cached);
      }
    } catch (e) {
      /* corrupted draft → fall back to file */
    }

    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch failed");
    const data = normalizeData(await res.json());
    this._cached = data;
    return structuredClone(data);
  },

  saveDraft(data) {
    this._cached = normalizeData(data);
    localStorage.setItem(STORE_KEY, JSON.stringify(this._cached));
  },

  hasDraft() {
    return localStorage.getItem(STORE_KEY) !== null;
  },

  discardDraft() {
    localStorage.removeItem(STORE_KEY);
    this._cached = null;
  },

  exportFile(data) {
    return JSON.stringify(normalizeData(data), null, 2) + "\n";
  }
};

window.Store = Store;
