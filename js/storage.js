/** localStorage persistence for interview prep progress */

const STORAGE_KEY = "interview-prep:v1";

function emptyState() {
  return { companies: {} };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    if (!parsed.companies) parsed.companies = {};
    return parsed;
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureCompany(state, companyId) {
  if (!state.companies[companyId]) {
    state.companies[companyId] = { questions: {}, lastTab: "overview" };
  }
  if (!state.companies[companyId].questions) {
    state.companies[companyId].questions = {};
  }
  return state.companies[companyId];
}

export function getQuestionState(state, companyId, questionId) {
  const c = state.companies[companyId];
  const q = c?.questions?.[questionId];
  return { done: !!q?.done, note: q?.note || "" };
}

export function setDone(state, companyId, questionId, done) {
  const c = ensureCompany(state, companyId);
  const prev = c.questions[questionId] || {};
  c.questions[questionId] = { ...prev, done: !!done, note: prev.note || "" };
  saveState(state);
}

export function setNote(state, companyId, questionId, note) {
  const c = ensureCompany(state, companyId);
  const prev = c.questions[questionId] || {};
  c.questions[questionId] = { ...prev, done: !!prev.done, note: note ?? "" };
  saveState(state);
}

export function setLastTab(state, companyId, tab) {
  const c = ensureCompany(state, companyId);
  c.lastTab = tab;
  saveState(state);
}

export function getLastTab(state, companyId) {
  return state.companies[companyId]?.lastTab || "overview";
}

/** Count done among a list of question ids */
export function progressForIds(state, companyId, ids) {
  const total = ids.length;
  let done = 0;
  for (const id of ids) {
    if (getQuestionState(state, companyId, id).done) done++;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importState(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || !parsed.companies) {
    throw new Error("Invalid backup file");
  }
  saveState(parsed);
  return parsed;
}

export function clearCompanyProgress(state, companyId) {
  if (state.companies[companyId]) {
    state.companies[companyId].questions = {};
    saveState(state);
  }
}

export function clearAll(state) {
  const next = emptyState();
  saveState(next);
  return next;
}
