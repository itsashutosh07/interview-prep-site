/** Render helpers for interview prep UI */

import {
  getQuestionState,
  setDone,
  setNote,
  progressForIds,
} from "./storage.js?v=15";
import { highlight } from "./highlight.js?v=22";

const FREQ_LABEL = { high: "🔥 High", med: "⚡ Med", low: "🟢 Once" };
const TAB_LABELS = {
  overview: "Overview",
  dsa: "DSA",
  backend: "Backend",
  lld: "LLD",
  hld: "HLD",
  tips: "Tips",
};
const TAB_ICONS = {
  overview: "🏠",
  dsa: "💻",
  backend: "⚙️",
  lld: "🧩",
  hld: "🏗",
  tips: "🎯",
};

export { TAB_LABELS, TAB_ICONS };

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainText(s) {
  return String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** DSA statements are authored HTML (examples + expected output). Other tabs stay escaped text. */
function renderQuestionBody(body) {
  if (!body) return "";
  const raw = String(body).trim();
  if (raw.startsWith("<")) return `<div class="q-body-html">${raw}</div>`;
  return `<p class="q-body-text">${escapeHtml(body)}</p>`;
}

function pillClass(tab) {
  if (tab === "dsa") return "pill-dsa";
  if (tab === "backend") return "pill-backend";
  if (tab === "lld") return "pill-lld";
  if (tab === "hld") return "pill-hld";
  return "pill-dsa";
}

function freqBadge(freq) {
  const f = freq || "low";
  return `<span class="freq freq-${escapeHtml(f)}">${FREQ_LABEL[f] || f}</span>`;
}

function tagPills(tags, tab) {
  return (tags || [])
    .map((t) => `<span class="pill ${pillClass(tab)}">${escapeHtml(t)}</span>`)
    .join("");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function updateCatProgress(section) {
  if (!section) return;
  const cards = section.querySelectorAll("[data-qid]");
  const total = cards.length;
  let done = 0;
  cards.forEach((c) => {
    if (c.classList.contains("done") || c.querySelector("[data-done]")?.checked) done++;
  });
  const text = section.querySelector("[data-cat-progress]");
  if (text) {
    text.innerHTML = `<span class="cat-done">${done}</span> / ${total}`;
  }
  const bar = section.querySelector(".cat-progress-bar > span");
  if (bar) {
    bar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
  }
  section.classList.toggle("complete", total > 0 && done === total);
}

export function collectQuestionIds(data) {
  const ids = [];
  if (data.dsa?.categories) {
    for (const c of data.dsa.categories) {
      for (const q of c.questions) ids.push(q.id);
    }
  }
  if (data.lld?.categories) {
    for (const c of data.lld.categories) {
      for (const q of c.questions) ids.push(q.id);
    }
  }
  if (data.hld?.categories) {
    for (const c of data.hld.categories) {
      for (const q of c.questions) ids.push(q.id);
    }
  }
  if (data.backend?.topics) {
    for (const t of data.backend.topics) {
      for (const it of t.items) ids.push(it.id);
    }
  }
  return ids;
}

export function siteTitleHtml() {
  return `<div class="topbar-title"><img class="site-mark" src="assets/logos/site-mark.svg" alt="" />Switchboard</div>`;
}

export function companyLogoHtml(c, { className = "company-logo" } = {}) {
  const src = c.logo;
  if (!src) return "";
  const alt = escapeHtml(c.shortName || c.name || "Logo");
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" />`;
}

export function renderHome(companies, state, onOpen) {
  const cards = companies
    .map((c) => {
      const logo = companyLogoHtml(c, { className: "company-card-logo" });
      return `
      <button type="button" class="company-card" data-slug="${escapeHtml(c.slug)}" style="--card-accent:${escapeHtml(c.accent || "#f78166")}">
        <div class="company-card-top">
          ${logo || `<div class="company-card-name">${escapeHtml(c.name || c.shortName)}</div>`}
        </div>
        <div class="company-card-role">${escapeHtml(c.role || "")}</div>
        <div class="company-card-desc">${escapeHtml(c.description || "")}</div>
        <div class="company-card-foot">
          <div class="progress-bar" data-progress-for="${escapeHtml(c.slug)}"><span style="width:0%"></span></div>
          <span class="progress-label" data-progress-label="${escapeHtml(c.slug)}">—</span>
        </div>
      </button>`;
    })
    .join("");

  return `
      <header class="topbar">
      <button type="button" class="topbar-menu-btn" data-sidebar-open aria-label="Open menu">☰</button>
      ${siteTitleHtml()}
    </header>
    <div class="home">
      <div class="home-hero">
        <h1>Switchboard</h1>
        <p>Company tracks for DSA, backend, LLD &amp; HLD. Progress stays in this browser.</p>
      </div>
      <div class="company-grid">${cards}</div>
    </div>`;
}

export function bindHome(root, onOpen) {
  root.querySelectorAll(".company-card").forEach((btn) => {
    btn.addEventListener("click", () => onOpen(btn.dataset.slug));
  });
}

export function updateHomeProgress(root, slug, { done, total, pct }) {
  const bar = root.querySelector(`[data-progress-for="${slug}"] > span`);
  const label = root.querySelector(`[data-progress-label="${slug}"]`);
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = total ? `${done}/${total}` : "—";
}

function renderSolution(sol) {
  const lang = sol.lang || "";
  const highlighted = highlight(sol.code || "", lang);
  return `
    <div class="code-block">
      <div class="code-toolbar">
        <span class="code-lang">${escapeHtml(sol.label || sol.lang)}</span>
        <button type="button" class="copy-btn" data-copy>Copy</button>
      </div>
      <pre><code class="lang-${escapeHtml(lang)}">${highlighted}</code></pre>
    </div>`;
}

function renderNotes(qid, note) {
  return `
    <div class="note-wrap">
      <div class="note-label">Your notes</div>
      <textarea class="note-area" data-note-for="${escapeHtml(qid)}" placeholder="Approach, edge cases, follow-ups…" rows="3">${escapeHtml(note)}</textarea>
    </div>`;
}

function renderRevealActions({ hasHint, hasAnswer, hasNote }) {
  const buttons = [];
  if (hasHint) {
    buttons.push(
      `<button type="button" class="action-btn action-btn-ghost" data-show-hint aria-expanded="false">Show hint</button>`
    );
  }
  buttons.push(
    `<button type="button" class="action-btn" data-show-answer ${!hasAnswer ? "disabled" : ""} aria-expanded="false">
        ${hasAnswer ? "Show answer" : "No answer yet"}
      </button>`
  );
  buttons.push(
    `<button type="button" class="action-btn action-btn-ghost" data-show-notes aria-expanded="false">
        ${hasNote ? "Notes" : "Add notes"}
      </button>`
  );
  return `<div class="q-actions">${buttons.join("")}</div>`;
}

function renderHintPanel(hintHtml) {
  if (!hintHtml) return "";
  return `
    <div class="q-hint-panel" hidden>
      <div class="reveal-inner">
        <div class="q-section-label">Hint</div>
        <div class="hint-text">${hintHtml}</div>
      </div>
    </div>`;
}

function renderAnswerPanel(answerHtml, solsHtml) {
  const parts = [];
  if (answerHtml) {
    parts.push(`<div class="q-section-label">Explanation</div>${answerHtml}`);
  }
  if (solsHtml) {
    parts.push(`<div class="q-section-label">${answerHtml ? "Code" : "Answer"}</div>${solsHtml}`);
  }
  if (!parts.length) return "";
  return `
    <div class="q-answer-panel" hidden>
      <div class="reveal-inner">
        ${parts.join("")}
      </div>
    </div>`;
}

function renderNotesPanel(qid, note) {
  return `
    <div class="q-notes-panel" hidden>
      <div class="reveal-inner">
        ${renderNotes(qid, note)}
      </div>
    </div>`;
}

function renderQuestionCard(q, idx, tab, state, companyId) {
  const st = getQuestionState(state, companyId, q.id);
  const links = (q.links || [])
    .map((l) => `<a class="lc-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`)
    .join("");
  const sols = (q.solutions || []).map(renderSolution).join("");
  const hasHint = !!q.hint;
  const hasAnswer = !!(q.answer || (q.solutions && q.solutions.length));
  const answerHtml = q.answer ? `<div class="ans-text">${q.answer}</div>` : "";
  const hintHtml = q.hint ? escapeHtml(q.hint) : "";
  const body = renderQuestionBody(q.body);
  const source = q.source
    ? `<span class="source-tag">${escapeHtml(q.source)}</span>`
    : "";
  const prompt =
    body || links || source
      ? `<div class="q-prompt">
            <div class="q-section-label">Question</div>
            ${body}
            <div class="q-links">${links}</div>
            ${source}
          </div>`
      : "";

  return `
    <div class="q-card ${st.done ? "done" : ""}" data-qid="${escapeHtml(q.id)}" data-search="${escapeHtml(plainText(q.title + " " + (q.body || "") + " " + (q.hint || "") + " " + (q.tags || []).join(" ")).toLowerCase())}">
      <div class="q-header" data-toggle>
        <input type="checkbox" class="q-check" data-done ${st.done ? "checked" : ""} aria-label="Mark done" />
        <div class="q-main">
          <div class="q-title-row">
            <span class="q-num">#${idx}</span>
            <span class="q-title">${escapeHtml(q.title)}</span>
          </div>
          <div class="q-meta">
            ${freqBadge(q.freq)}
            ${tagPills(q.tags, tab)}
          </div>
        </div>
        <span class="q-expand" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.75 4.25 10.25 8 5.75 11.75" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
      <div class="q-panel">
        <div class="q-panel-inner">
          ${prompt}
          ${renderRevealActions({ hasHint, hasAnswer, hasNote: !!st.note })}
          ${renderHintPanel(hintHtml)}
          ${renderAnswerPanel(answerHtml, sols)}
          ${renderNotesPanel(q.id, st.note)}
        </div>
      </div>
    </div>`;
}

function renderSectionShell({ title, icon, done, total, searchBlob, bodyHtml, collapsed = false }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  return `
    <div class="cat-section ${collapsed ? "collapsed" : ""} ${complete ? "complete" : ""}" data-cat data-search="${searchBlob}">
      <div class="cat-header" data-cat-toggle role="button" tabindex="0" aria-expanded="${collapsed ? "false" : "true"}" title="Expand / collapse topic">
        <span class="cat-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.75 4.25 10.25 8 5.75 11.75" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        ${icon ? `<span class="cat-icon">${icon}</span>` : ""}
        <span class="cat-title">${escapeHtml(title)}</span>
        <span class="cat-meta">
          <span class="cat-progress-text" data-cat-progress>
            <span class="cat-done">${done}</span> / ${total}
          </span>
          <span class="cat-progress-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
        </span>
      </div>
      <div class="cat-body-wrap">
        <div class="cat-body">${bodyHtml}</div>
      </div>
    </div>`;
}

export function renderQuestionList(categories, tab, state, companyId) {
  let n = 0;
  const parts = [];
  for (const cat of categories || []) {
    const qs = cat.questions || [];
    if (!qs.length) continue;
    const doneCount = qs.filter((q) => getQuestionState(state, companyId, q.id).done).length;
    const cards = qs
      .map((q) => {
        n++;
        return renderQuestionCard(q, n, tab, state, companyId);
      })
      .join("");
    const searchBlob = escapeHtml(
      (cat.title + " " + qs.map((q) => q.title).join(" ")).toLowerCase()
    );
    parts.push(
      renderSectionShell({
        title: cat.title,
        done: doneCount,
        total: qs.length,
        searchBlob,
        bodyHtml: cards,
      })
    );
  }
  return parts.join("") || `<div class="empty-filter">No questions yet.</div>`;
}

function renderQaItem(item, state, companyId, idx) {
  const st = getQuestionState(state, companyId, item.id);
  const sols = (item.solutions || []).map(renderSolution).join("");
  const hasHint = !!item.hint;
  const hasAnswer = !!(item.answer || (item.solutions && item.solutions.length));
  // Prefer highlighted solutions; skip answer HTML that is just a leftover code-panel dump.
  const answerLooksLikeCodeDump =
    typeof item.answer === "string" && /class="code-panel"|<pre[\s>]/.test(item.answer);
  const answerHtml =
    item.answer && !(answerLooksLikeCodeDump && sols)
      ? `<div class="ans-text">${item.answer}</div>`
      : "";
  const hintHtml = item.hint ? escapeHtml(item.hint) : "";

  return `
    <div class="q-card qa-card ${st.done ? "done" : ""}" data-qid="${escapeHtml(item.id)}" data-search="${escapeHtml((item.question + " " + (item.hint || "") + " " + (item.answer || "")).toLowerCase())}">
      <div class="q-header" data-toggle>
        <input type="checkbox" class="q-check" data-done ${st.done ? "checked" : ""} aria-label="Mark done" />
        <div class="q-main">
          <div class="q-title-row">
            <span class="q-num">#${idx}</span>
            <span class="q-title">${escapeHtml(item.question)}</span>
          </div>
        </div>
        <span class="q-expand" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.75 4.25 10.25 8 5.75 11.75" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
      <div class="q-panel">
        <div class="q-panel-inner">
          ${renderRevealActions({ hasHint, hasAnswer, hasNote: !!st.note })}
          ${renderHintPanel(hintHtml)}
          ${renderAnswerPanel(answerHtml, sols)}
          ${renderNotesPanel(item.id, st.note)}
        </div>
      </div>
    </div>`;
}

export function renderBackend(topics, state, companyId) {
  return (topics || [])
    .map((t) => {
      const items = t.items || [];
      const doneCount = items.filter((it) => getQuestionState(state, companyId, it.id).done).length;
      const body = items.map((it, i) => renderQaItem(it, state, companyId, i + 1)).join("");
      const searchBlob = escapeHtml(
        (t.title + " " + items.map((i) => i.question).join(" ")).toLowerCase()
      );
      return renderSectionShell({
        title: t.title,
        icon: t.icon || "📘",
        done: doneCount,
        total: items.length,
        searchBlob,
        bodyHtml: body || `<p class="muted" style="padding:8px">No questions.</p>`,
        collapsed: true,
      });
    })
    .join("");
}

export function renderOverview(meta) {
  const stats = (meta.stats || [])
    .map(
      (s) =>
        `<div class="stat-card"><div class="stat-num">${escapeHtml(s.num)}</div><div class="stat-label">${escapeHtml(s.label)}</div></div>`
    )
    .join("");
  const process = (meta.process || [])
    .map(
      (p) => `
      <div class="process-step">
        <div class="step-num">${escapeHtml(p.num)}</div>
        <div>
          <div class="step-title">${escapeHtml(p.title)}</div>
          <div class="step-desc">${escapeHtml(p.desc)}</div>
        </div>
      </div>`
    )
    .join("");
  const warn = meta.overviewWarn
    ? `<div class="warn-box"><div class="tip-title">${escapeHtml(meta.overviewWarn.title)}</div>${escapeHtml(meta.overviewWarn.body)}</div>`
    : "";

  return `
    <h1>${escapeHtml(meta.title)}</h1>
    <p class="muted" style="margin-bottom:16px;font-size:13px">${escapeHtml(meta.intro)}</p>
    <div class="stats-grid">${stats}</div>
    <h2>Interview Process</h2>
    <div class="process-timeline">${process}</div>
    ${warn}`;
}

export function renderTips(meta) {
  const boxes = (meta.tipBoxes || [])
    .map(
      (b) =>
        `<div class="tip-box"><div class="tip-title">${escapeHtml(b.title)}</div>${escapeHtml(b.body)}</div>`
    )
    .join("");
  const sections = (meta.tipSections || [])
    .map((s) => {
      const items = (s.items || [])
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join("");
      return `<h2>${escapeHtml(s.title)}</h2><div class="tip-box"><ul class="tip-list">${items}</ul></div>`;
    })
    .join("");
  const warn = meta.tipWarn
    ? `<div class="warn-box"><div class="tip-title">${escapeHtml(meta.tipWarn.title)}</div><ul class="tip-list">${(meta.tipWarn.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>`
    : "";

  return `<h1>Strategy &amp; Preparation</h1>${boxes}${sections}${warn}`;
}

export function bindInteractive(root, state, companyId, onProgressChange) {
  const resetCardReveals = (card) => {
    card.classList.remove("show-hint", "show-answer", "show-notes");
    card.querySelectorAll(".q-hint-panel, .q-answer-panel, .q-notes-panel").forEach((p) => {
      p.hidden = true;
    });
    const hintBtn = card.querySelector("[data-show-hint]");
    const ansBtn = card.querySelector("[data-show-answer]");
    const noteBtn = card.querySelector("[data-show-notes]");
    if (hintBtn) {
      hintBtn.textContent = "Show hint";
      hintBtn.setAttribute("aria-expanded", "false");
    }
    if (ansBtn && !ansBtn.disabled) {
      ansBtn.textContent = "Show answer";
      ansBtn.setAttribute("aria-expanded", "false");
    }
    if (noteBtn) {
      const hasNote = !!card.querySelector("[data-note-for]")?.value?.trim();
      noteBtn.textContent = hasNote ? "Notes" : "Add notes";
      noteBtn.setAttribute("aria-expanded", "false");
    }
  };

  // Expand question cards (title → reveal prompt + actions)
  root.querySelectorAll(".q-card > .q-header[data-toggle]").forEach((hdr) => {
    hdr.addEventListener("click", (e) => {
      if (e.target.closest("[data-done]")) return;
      const card = hdr.closest(".q-card");
      card.classList.toggle("open");
      if (!card.classList.contains("open")) resetCardReveals(card);
    });
  });

  root.querySelectorAll("[data-show-hint]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".q-card");
      const panel = card.querySelector(".q-hint-panel");
      const on = card.classList.toggle("show-hint");
      if (panel) panel.hidden = !on;
      btn.textContent = on ? "Hide hint" : "Show hint";
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  });

  // Show answer / Add notes — toggle class + hidden attr so code stays fully collapsed
  root.querySelectorAll("[data-show-answer]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      const card = btn.closest(".q-card");
      const panel = card.querySelector(".q-answer-panel");
      const on = card.classList.toggle("show-answer");
      if (panel) panel.hidden = !on;
      btn.textContent = on ? "Hide answer" : "Show answer";
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    });
  });

  root.querySelectorAll("[data-show-notes]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".q-card");
      const panel = card.querySelector(".q-notes-panel");
      const on = card.classList.toggle("show-notes");
      if (panel) panel.hidden = !on;
      btn.textContent = on ? "Hide notes" : (card.querySelector("[data-note-for]")?.value?.trim() ? "Notes" : "Add notes");
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) card.querySelector("[data-note-for]")?.focus();
    });
  });

  // Category / topic collapse
  root.querySelectorAll("[data-cat-toggle]").forEach((hdr) => {
    const toggle = () => {
      const section = hdr.closest(".cat-section");
      section.classList.toggle("collapsed");
      hdr.setAttribute("aria-expanded", section.classList.contains("collapsed") ? "false" : "true");
    };
    hdr.addEventListener("click", toggle);
    hdr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });

  // Done checkboxes
  root.querySelectorAll("[data-done]").forEach((cb) => {
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", () => {
      const host = cb.closest("[data-qid]");
      const qid = host.dataset.qid;
      setDone(state, companyId, qid, cb.checked);
      host.classList.toggle("done", cb.checked);
      updateCatProgress(host.closest(".cat-section"));
      onProgressChange?.();
    });
  });

  const saveNote = debounce((qid, value) => {
    setNote(state, companyId, qid, value);
  }, 300);

  root.querySelectorAll("[data-note-for]").forEach((ta) => {
    ta.addEventListener("click", (e) => e.stopPropagation());
    ta.addEventListener("input", () => {
      saveNote(ta.dataset.noteFor, ta.value);
      const btn = ta.closest(".q-card")?.querySelector("[data-show-notes]");
      if (btn && !ta.closest(".q-card")?.classList.contains("show-notes")) {
        btn.textContent = ta.value.trim() ? "Notes" : "Add notes";
      }
    });
  });

  root.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pre = btn.closest(".code-block")?.querySelector("pre code, pre");
      const text = pre?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      } catch {
        btn.textContent = "Failed";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      }
    });
  });
}

export function bindSearch(wrap, listRoot) {
  if (!wrap || !listRoot) return;
  const input = wrap.querySelector("[data-search]");
  const toggle = wrap.querySelector("[data-search-toggle]");
  const closeBtn = wrap.querySelector("[data-search-close]");
  const tabs = wrap.closest(".chip-tabs");
  if (!input) return;

  const setOpen = (open) => {
    wrap.classList.toggle("open", open);
    tabs?.classList.toggle("search-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      // Wait one frame so the width transition has started before focusing
      requestAnimationFrame(() => input.focus());
    } else {
      input.blur();
    }
  };

  const applyFilter = () => {
    const q = input.value.trim().toLowerCase();
    wrap.classList.toggle("has-query", !!q);
    const cards = listRoot.querySelectorAll("[data-qid]");
    let visible = 0;
    cards.forEach((el) => {
      const hay = el.dataset.search || el.textContent.toLowerCase();
      const show = !q || hay.includes(q);
      el.style.display = show ? "" : "none";
      if (show) visible++;
    });
    listRoot.querySelectorAll(".cat-section[data-cat]").forEach((section) => {
      const any = [...section.querySelectorAll("[data-qid]")].some(
        (c) => c.style.display !== "none"
      );
      section.style.display = !q || any ? "" : "none";
      if (q && any) section.classList.remove("collapsed");
    });
    let empty = listRoot.querySelector(".empty-filter-dyn");
    if (!visible && q) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "empty-filter empty-filter-dyn";
        empty.textContent = "No matches.";
        listRoot.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  };

  toggle?.addEventListener("click", () => setOpen(true));
  closeBtn?.addEventListener("click", () => {
    input.value = "";
    applyFilter();
    setOpen(false);
  });
  input.addEventListener("input", applyFilter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (input.value) {
        input.value = "";
        applyFilter();
      } else {
        setOpen(false);
      }
    }
  });
  // Collapse when leaving an empty field (not when a query is active)
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!wrap.contains(document.activeElement) && !input.value.trim()) {
        setOpen(false);
      }
    }, 120);
  });
}

export function tabProgress(state, companyId, data, tab) {
  let ids = [];
  if (tab === "dsa") {
    ids = (data.dsa?.categories || []).flatMap((c) => c.questions.map((q) => q.id));
  } else if (tab === "lld") {
    ids = (data.lld?.categories || []).flatMap((c) => c.questions.map((q) => q.id));
  } else if (tab === "hld") {
    ids = (data.hld?.categories || []).flatMap((c) => c.questions.map((q) => q.id));
  } else if (tab === "backend") {
    ids = (data.backend?.topics || []).flatMap((t) => t.items.map((i) => i.id));
  }
  return progressForIds(state, companyId, ids);
}
