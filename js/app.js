/** Switchboard — hash-routed SPA */

import {
  loadState,
  setLastTab,
  getLastTab,
  progressForIds,
  exportState,
  importState,
  clearCompanyProgress,
  clearAll,
  getQuietChrome,
  setQuietChrome,
} from "./storage.js?v=35";
import {
  TAB_LABELS,
  TAB_ICONS,
  tabLabel,
  pageHeading,
  renderHome,
  bindHome,
  updateHomeProgress,
  renderOverview,
  renderTips,
  renderQuestionList,
  renderBackend,
  bindInteractive,
  bindSearch,
  collectQuestionIds,
  tabProgress,
  escapeHtml,
  companyLogoHtml,
  siteTitleHtml,
} from "./render.js?v=35";

const app = document.getElementById("app");
let state = loadState();
let companies = [];
const cache = {}; // slug -> data
const inflight = {}; // slug -> Promise
let routeGen = 0;

/** Bust browser cache for ES modules + JSON after deploys */
const ASSET_V = "35";

function withV(path) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}v=${ASSET_V}`;
}

function applyQuietChrome() {
  document.body.classList.toggle("quiet-chrome", getQuietChrome(state));
}

function closeSectionsMenu() {
  const root = document.querySelector("[data-sections-root]");
  if (!root) return;
  root.classList.remove("open");
  const toggle = root.querySelector("[data-sections-toggle]");
  const pop = root.querySelector("[data-sections-popover]");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  if (pop) pop.hidden = true;
}

function bindSectionsMenu(shell) {
  const root = shell.querySelector("[data-sections-root]");
  if (!root) return;
  const toggle = root.querySelector("[data-sections-toggle]");
  const pop = root.querySelector("[data-sections-popover]");

  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !root.classList.contains("open");
    closeSectionsMenu();
    if (open) {
      root.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      if (pop) pop.hidden = false;
    }
  });
}

function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "") || "/";
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { view: "home" };
  const slug = parts[0];
  const tab = parts[1] || null;
  return { view: "company", slug, tab };
}

function navigate(path) {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}

function closeSidebar() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.querySelector(".sidebar-backdrop")?.classList.remove("open");
  document.body.classList.remove("sidebar-open");
}

function openSidebar() {
  document.querySelector(".sidebar")?.classList.add("open");
  document.querySelector(".sidebar-backdrop")?.classList.add("open");
  document.body.classList.add("sidebar-open");
}

function toggleSidebar() {
  const open = document.querySelector(".sidebar")?.classList.contains("open");
  if (open) closeSidebar();
  else openSidebar();
}

function renderSidebarHtml(activeSlug) {
  const companyLinks = companies
    .map((c) => {
      const active = c.slug === activeSlug ? "active" : "";
      const logo = companyLogoHtml(c, { className: "sidebar-logo" });
      const displayName = c.name || c.shortName || c.slug;
      return `
        <button type="button" class="sidebar-link sidebar-company ${active}" data-nav-company="${escapeHtml(c.slug)}">
          ${logo || `<span class="sidebar-link-icon">🏢</span>`}
          <span>
            <span class="sidebar-company-name">${escapeHtml(displayName)}</span>
            <span class="sidebar-company-role">${escapeHtml(c.role || "")}</span>
          </span>
        </button>`;
    })
    .join("");

  return `
    <div class="sidebar-backdrop" data-sidebar-close></div>
    <aside class="sidebar" aria-label="Main menu">
      <div class="sidebar-head">
        <button type="button" class="sidebar-brand" data-nav-home aria-label="Switchboard home">
          <img class="site-mark" src="assets/logos/site-mark.svg" alt="" />Switchboard
        </button>
        <button type="button" class="sidebar-close" data-sidebar-close aria-label="Close menu">×</button>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Companies</div>
        ${companyLinks || `<p class="muted" style="padding:8px 12px;font-size:13px">No companies yet.</p>`}
      </nav>
    </aside>`;
}

function bindSidebar() {
  document.querySelectorAll("[data-sidebar-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSidebar();
    });
  });
  document.querySelectorAll("[data-sidebar-close]").forEach((el) => {
    el.addEventListener("click", () => closeSidebar());
  });
  document.querySelector("[data-nav-home]")?.addEventListener("click", () => {
    closeSidebar();
    navigate("/");
  });
  document.querySelectorAll("[data-nav-company]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.dataset.navCompany;
      const c = companyBySlug(slug);
      const tab = getLastTab(state, c?.id || slug) || "overview";
      closeSidebar();
      navigate(`/${slug}/${tab}`);
    });
  });
}

function withSidebar(contentHtml, activeSlug) {
  return `${renderSidebarHtml(activeSlug)}${contentHtml}`;
}

async function fetchJson(path) {
  const res = await fetch(withV(path), { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadCompanies() {
  const data = await fetchJson("data/companies.json");
  companies = data.companies || [];
}

async function loadCompanyData(slug) {
  if (cache[slug]) return cache[slug];
  if (inflight[slug]) return inflight[slug];
  const base = `data/${slug}`;
  inflight[slug] = Promise.all([
    fetchJson(`${base}/meta.json`),
    fetchJson(`${base}/dsa.json`),
    fetchJson(`${base}/backend.json`),
    fetchJson(`${base}/lld.json`),
    fetchJson(`${base}/hld.json`),
  ])
    .then(([meta, dsa, backend, lld, hld]) => {
      cache[slug] = { meta, dsa, backend, lld, hld };
      return cache[slug];
    })
    .finally(() => {
      delete inflight[slug];
    });
  return inflight[slug];
}

function companyBySlug(slug) {
  return companies.find((c) => c.slug === slug);
}

function showSettings(companyId) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const quietOn = getQuietChrome(state);
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-labelledby="settings-title">
      <h3 id="settings-title">Settings</h3>

      <section class="settings-group" aria-labelledby="settings-appearance">
        <h4 id="settings-appearance" class="settings-group-title">Appearance</h4>
        <label class="settings-row">
          <span class="settings-row-copy">
            <span class="settings-row-label">Quiet chrome</span>
            <span class="settings-row-hint">Hide section labels from the sticky bar and bottom dock. Switch sections from the top-bar menu instead.</span>
          </span>
          <span class="switch">
            <input type="checkbox" role="switch" data-quiet-chrome ${quietOn ? "checked" : ""} aria-label="Quiet chrome" />
            <span class="switch-track" aria-hidden="true"></span>
          </span>
        </label>
      </section>

      <section class="settings-group" aria-labelledby="settings-progress">
        <h4 id="settings-progress" class="settings-group-title">Progress &amp; backup</h4>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" data-export>Export progress JSON</button>
          <button type="button" class="btn" data-import>Import progress JSON</button>
          <button type="button" class="btn btn-danger" data-clear-company>Clear this company</button>
          <button type="button" class="btn btn-danger" data-clear-all>Clear all progress</button>
        </div>
      </section>

      <button type="button" class="btn modal-close" data-close>Done</button>
      <input type="file" accept="application/json,.json" hidden data-file />
    </div>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("[data-close]").addEventListener("click", close);

  backdrop.querySelector("[data-quiet-chrome]").addEventListener("change", (e) => {
    setQuietChrome(state, e.target.checked);
    applyQuietChrome();
    closeSectionsMenu();
    // Retitle + soften page chrome without a full reload when possible
    const shell = document.querySelector(".company-shell");
    if (shell && document.body.classList.contains("view-company")) {
      const slug = parseHash().slug;
      const company = companyBySlug(slug);
      const tab = parseHash().tab || getLastTab(state, company?.id || slug);
      if (company) {
        const quiet = getQuietChrome(state);
        document.title = quiet
          ? company.shortName || company.name || "Switchboard"
          : `${company.shortName || company.name} — ${TAB_LABELS[tab] || tab}`;
        const h1 = shell.querySelector("[data-page] > h1");
        if (h1) {
          if (PAGE_HEADINGS_SAFE.includes(tab)) {
            h1.innerHTML = pageHeading(tab, quiet);
          } else if (tab === "tips") {
            h1.textContent = quiet ? "Notes" : "Strategy & Preparation";
          }
        }
        // Soft labels inside the sections popover
        shell.querySelectorAll("[data-sections-popover] [data-tab]").forEach((btn) => {
          const t = btn.dataset.tab;
          btn.querySelector(".sections-item-label").textContent = tabLabel(t, quiet);
        });
      }
    }
  });

  backdrop.querySelector("[data-export]").addEventListener("click", () => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `switchboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const fileInput = backdrop.querySelector("[data-file]");
  backdrop.querySelector("[data-import]").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      state = importState(text);
      applyQuietChrome();
      close();
      route();
    } catch (err) {
      alert("Import failed: " + (err.message || err));
    }
  });

  backdrop.querySelector("[data-clear-company]").addEventListener("click", () => {
    if (!confirm("Clear progress for this company?")) return;
    clearCompanyProgress(state, companyId);
    close();
    route();
  });

  backdrop.querySelector("[data-clear-all]").addEventListener("click", () => {
    if (!confirm("Clear ALL progress for every company?")) return;
    state = clearAll(state);
    applyQuietChrome();
    close();
    route();
  });
}

const PAGE_HEADINGS_SAFE = ["dsa", "backend", "lld", "hld"];

async function renderHomeView() {
  document.body.classList.add("view-home");
  document.body.classList.remove("view-company");
  applyQuietChrome();
  closeSidebar();
  document.title = "Switchboard";

  app.innerHTML = withSidebar(renderHome(companies, state), null);
  bindSidebar();
  bindHome(app, (slug) => {
    const c = companyBySlug(slug);
    const tab = getLastTab(state, c?.id || slug) || "overview";
    navigate(`/${slug}/${tab}`);
  });

  for (const c of companies) {
    try {
      const data = await loadCompanyData(c.slug);
      const ids = collectQuestionIds(data);
      const prog = progressForIds(state, c.id, ids);
      updateHomeProgress(app, c.slug, prog);
    } catch {
      /* ignore missing */
    }
  }
}

function renderCompanyShell(company, tab, progressLabel, quiet) {
  const tabs = company.tabs || ["overview", "dsa", "backend", "lld", "hld", "tips"];
  const chips = tabs
    .map(
      (t) =>
        `<button type="button" class="chip ${t === tab ? "active" : ""}" data-tab="${t}">${TAB_LABELS[t] || t}</button>`
    )
    .join("");

  const sectionItems = tabs
    .map(
      (t) => `
      <button type="button" class="sections-item ${t === tab ? "active" : ""}" role="menuitem" data-tab="${t}">
        <span class="sections-item-icon" aria-hidden="true">${TAB_ICONS[t] || "•"}</span>
        <span class="sections-item-label">${escapeHtml(tabLabel(t, quiet))}</span>
      </button>`
    )
    .join("");

  const bottom = tabs
    .map(
      (t) => `
      <button type="button" class="bn-item ${t === tab ? "active" : ""}" data-tab="${t}">
        <span class="bn-icon">${TAB_ICONS[t] || "•"}</span>
        <span>${TAB_LABELS[t] || t}</span>
      </button>`
    )
    .join("");

  const needsSearch = ["dsa", "backend", "lld", "hld"].includes(tab);

  return `
    <div class="company-shell" data-company="${escapeHtml(company.id)}">
      <div class="company-chrome">
        <header class="topbar">
          <button type="button" class="topbar-menu-btn" data-sidebar-open aria-label="Open menu">☰</button>
          ${siteTitleHtml()}
          <span class="topbar-progress" data-top-progress>${escapeHtml(progressLabel)}</span>
          <div class="sections-menu" data-sections-root>
            <button type="button" class="topbar-sections" data-sections-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="sections-popover" aria-label="Sections">
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                <path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
            <div id="sections-popover" class="sections-popover" role="menu" hidden data-sections-popover>
              <div class="sections-popover-label">Sections</div>
              ${sectionItems}
            </div>
          </div>
          <button type="button" class="topbar-settings" data-settings aria-label="Settings">⋮</button>
        </header>
        <nav class="chip-tabs" aria-label="Sections" data-chip-tabs>
          <div class="chip-tabs-scroll">${chips}</div>
          ${
            needsSearch
              ? `<div class="chip-search-wrap" data-search-wrap>
            <button type="button" class="chip-search-toggle" data-search-toggle aria-label="Filter questions" aria-expanded="false" aria-controls="chip-search-input">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.2 10.2 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <div class="chip-search-panel" data-search-panel>
              <svg class="chip-search-leading" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.2 10.2 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              <input id="chip-search-input" class="search-box chip-search" type="search" placeholder="Filter…" data-search inputmode="search" aria-label="Filter questions" />
              <button type="button" class="chip-search-close" data-search-close aria-label="Close filter">×</button>
            </div>
          </div>`
              : ""
          }
        </nav>
      </div>
      <main class="page" data-page></main>
      <nav class="bottom-nav" aria-label="Sections">${bottom}</nav>
    </div>`;
}

function updateProgressUI(shell, state, company, data) {
  const ids = collectQuestionIds(data);
  const prog = progressForIds(state, company.id, ids);
  const el = shell.querySelector("[data-top-progress]");
  if (el) el.textContent = prog.total ? `${prog.done}/${prog.total}` : "—";
}

async function renderCompanyView(slug, tabIn, gen = routeGen) {
  document.body.classList.remove("view-home");
  document.body.classList.add("view-company");
  closeSidebar();

  const company = companyBySlug(slug);
  if (!company) {
    navigate("/");
    return;
  }

  const tabs = company.tabs || [];
  let tab = tabIn || getLastTab(state, company.id) || "overview";
  if (!tabs.includes(tab)) {
    tab = tabs[0] || "overview";
    history.replaceState(null, "", `#/${slug}/${tab}`);
  } else if (!tabIn) {
    const desired = `#/${slug}/${tab}`;
    if (location.hash !== desired) history.replaceState(null, "", desired);
  }

  setLastTab(state, company.id, tab);
  const quiet = getQuietChrome(state);
  applyQuietChrome();
  document.title = quiet
    ? company.shortName || company.name || "Switchboard"
    : `${company.shortName || company.name} — ${TAB_LABELS[tab] || tab}`;

  let data;
  try {
    data = await loadCompanyData(slug);
  } catch (err) {
    if (gen !== routeGen) return;
    app.innerHTML = withSidebar(
      `<div class="page"><p class="muted">Failed to load company data: ${escapeHtml(err.message)}</p>
      <button type="button" class="btn" data-error-home>← Home</button></div>`,
      slug
    );
    bindSidebar();
    app.querySelector("[data-error-home]")?.addEventListener("click", () => navigate("/"));
    return;
  }

  if (gen !== routeGen) return;

  const ids = collectQuestionIds(data);
  const prog = progressForIds(state, company.id, ids);
  const progressLabel = prog.total ? `${prog.done}/${prog.total}` : "—";

  app.innerHTML = withSidebar(renderCompanyShell(company, tab, progressLabel, quiet), slug);
  bindSidebar();
  const shell = app.querySelector(".company-shell");
  const page = shell.querySelector("[data-page]");

  if (tab === "overview") {
    const logo = companyLogoHtml(company, { className: "overview-logo" });
    page.innerHTML = `
      <div class="overview-brand">
        ${logo}
        <div class="overview-brand-text">
          <div class="overview-brand-name">${escapeHtml(company.name)}</div>
          <div class="overview-brand-role">${escapeHtml(company.role || "")}</div>
        </div>
      </div>
      ${renderOverview(data.meta)}`;
  } else if (tab === "tips") {
    page.innerHTML = renderTips(data.meta, quiet);
  } else if (tab === "backend") {
    const tp = tabProgress(state, company.id, data, "backend");
    page.innerHTML = `
      <h1>${pageHeading("backend", quiet)}</h1>
      <div class="page-intro">
        <strong>${tp.done}/${tp.total}</strong> done. Expand a topic → tap a question title → use <strong>Show answer</strong> / <strong>Add notes</strong>.
        Java / Spring Boot oriented.
      </div>
      <div data-list>${renderBackend(data.backend.topics, state, company.id)}</div>`;
  } else if (tab === "dsa") {
    const tp = tabProgress(state, company.id, data, "dsa");
    page.innerHTML = `
      <h1>${pageHeading("dsa", quiet)}</h1>
      <div class="page-intro">
        Ordered by frequency. <strong>${tp.done}/${tp.total}</strong> done.
        Tap a title to open the question, then <strong>Show answer</strong> or <strong>Add notes</strong>.
      </div>
      <div data-list>${renderQuestionList(data.dsa.categories, "dsa", state, company.id)}</div>`;
  } else if (tab === "lld") {
    const tp = tabProgress(state, company.id, data, "lld");
    page.innerHTML = `
      <h1>${pageHeading("lld", quiet)}</h1>
      <div class="page-intro">
        <strong>${tp.done}/${tp.total}</strong> done. Tap a title → <strong>Show answer</strong> for Java solutions / <strong>Add notes</strong>.
      </div>
      <div data-list>${renderQuestionList(data.lld.categories, "lld", state, company.id)}</div>`;
  } else if (tab === "hld") {
    const tp = tabProgress(state, company.id, data, "hld");
    page.innerHTML = `
      <h1>${pageHeading("hld", quiet)}</h1>
      <div class="page-intro">
        <strong>${tp.done}/${tp.total}</strong> done. Tap a title → <strong>Show answer</strong> for design notes / <strong>Add notes</strong>.
      </div>
      <div data-list>${renderQuestionList(data.hld.categories, "hld", state, company.id)}</div>`;
  }

  const listRoot = page.querySelector("[data-list]") || page;
  bindInteractive(page, state, company.id, () => updateProgressUI(shell, state, company, data));
  bindSearch(shell.querySelector("[data-search-wrap]"), listRoot);

  shell.querySelector("[data-settings]").addEventListener("click", () => showSettings(company.id));
  bindSectionsMenu(shell);

  shell.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeSectionsMenu();
      navigate(`/${slug}/${btn.dataset.tab}`);
    });
  });
}

async function route() {
  const gen = ++routeGen;
  const r = parseHash();
  try {
    if (r.view === "home") {
      await renderHomeView();
    } else {
      await renderCompanyView(r.slug, r.tab, gen);
    }
  } catch (err) {
    if (gen !== routeGen) return;
    console.error(err);
    app.innerHTML = `<div class="page"><p class="muted">Something went wrong.</p><pre style="color:var(--muted);font-size:12px">${escapeHtml(err.stack || err.message)}</pre></div>`;
  }
}

async function boot() {
  try {
    await loadCompanies();
    await route();
  } catch (err) {
    app.innerHTML = `<div class="boot">Failed to start. Serve this folder over HTTP<br><small style="color:var(--muted)">${escapeHtml(err.message)}</small></div>`;
  }
}

window.addEventListener("hashchange", () => route());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.querySelector("[data-sections-root].open")) {
      closeSectionsMenu();
      return;
    }
    if (document.querySelector(".sidebar.open")) {
      closeSidebar();
      return;
    }
    const openSearch = document.querySelector("[data-search-wrap].open");
    if (openSearch) {
      const input = openSearch.querySelector("[data-search]");
      if (input?.value) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        openSearch.classList.remove("open", "has-query");
        openSearch.closest(".chip-tabs")?.classList.remove("search-open");
        openSearch.querySelector("[data-search-toggle]")?.setAttribute("aria-expanded", "false");
      }
      return;
    }
    document.querySelectorAll(".q-card.open").forEach((el) => {
      el.classList.remove("open", "show-hint", "show-answer", "show-notes");
      el.querySelectorAll(".q-hint-panel, .q-answer-panel, .q-notes-panel").forEach((p) => {
        p.hidden = true;
      });
      const hintBtn = el.querySelector("[data-show-hint]");
      if (hintBtn) hintBtn.textContent = "Show hint";
      const ansBtn = el.querySelector("[data-show-answer]");
      if (ansBtn && !ansBtn.disabled) ansBtn.textContent = "Show answer";
    });
  }
  if (!document.body.classList.contains("view-company")) return;
  const tag = document.activeElement?.tagName;
  if (e.key === "/" && tag !== "TEXTAREA" && tag !== "INPUT") {
    const wrap = document.querySelector("[data-search-wrap]");
    const search = wrap?.querySelector("[data-search]");
    if (search) {
      e.preventDefault();
      wrap.classList.add("open");
      wrap.closest(".chip-tabs")?.classList.add("search-open");
      const toggle = wrap.querySelector("[data-search-toggle]");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      search.focus();
    }
  }
});

document.addEventListener("click", (e) => {
  const root = document.querySelector("[data-sections-root].open");
  if (root && !root.contains(e.target)) closeSectionsMenu();
});

boot();
applyQuietChrome();
