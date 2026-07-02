/* ============================================================
   store.js — loads static portfolio content from JSON.
   ============================================================ */

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
  empty() {
    return structuredClone(emptyPortfolio());
  },

  async load() {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("fetch failed");
    return structuredClone(normalizeData(await res.json()));
  }
};

window.Store = Store;
