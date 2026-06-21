const FIELD_LABELS = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
};

const MODE_LABELS = {
  multiCloze: "複数穴埋め",
  originalChoice: "原文選択確認",
  original: "原文○確認",
  false: "生成×問題",
  memory: "暗記カード",
};

const STORAGE_KEY = "adjusterStudyMvpProgress.v1";
const MEMO_STORAGE_KEY = "study_question_memos_v1";
const SEED_DB_NAME = "adjusterStudySeed.v1";
const SEED_STORE_NAME = "seed";
const SEED_RECORD_KEY = "app_seed_v10";
const LEGACY_SEED_RECORD_KEYS = ["app_seed_v9", "app_seed_v6", "app_seed_v2"];
const DEV_SEED_URL = "data/app_seed/app_seed_v10.json";
const EXPECTED_SEED_COUNTS = {
  original_questions: 947,
  memory_points: 947,
  cloze_questions: 2412,
  generated_false_questions: 947,
  test_sets: 57,
  original_choice_questions: 344,
  multi_cloze_questions: 947,
  term_candidates: 3005,
};
const REQUIRED_SEED_KEYS = ["original_questions", "memory_points", "cloze_questions", "generated_false_questions", "test_sets"];
const V10_SEED_KEYS = ["multi_cloze_questions", "term_candidates"];
const GENERIC_MEMORY_TEXTS = new Set([
  "原文で示された条件、対象範囲、役割の組合せとして成立するため。",
  "原文中の重要語、数値、対象範囲、役割の対応",
]);
const GENERIC_TRAP_POINTS = new Set([
  "対象範囲を広げすぎない",
  "数値・単位・大小関係を入れ替えない",
  "似た名称や近い部品名と混同しない",
]);

const state = {
  seed: null,
  seedCounts: null,
  progress: loadProgress(),
  memos: loadMemos(),
  mode: "multiCloze",
  field: "all",
  review: "all",
  testCount: "practice",
  testSession: null,
  testComplete: false,
  queue: [],
  currentIndex: 0,
  answered: false,
  multiSelections: {},
};

const el = {
  loadStatus: document.querySelector("#loadStatus"),
  todayAttempts: document.querySelector("#todayAttempts"),
  todayAccuracy: document.querySelector("#todayAccuracy"),
  weakCount: document.querySelector("#weakCount"),
  setupPanel: document.querySelector("#setupPanel"),
  controlPanel: document.querySelector("#controlPanel"),
  studyLayout: document.querySelector("#studyLayout"),
  dataPanel: document.querySelector("#dataPanel"),
  checkUpdateBtn: document.querySelector("#checkUpdateBtn"),
  reloadAppBtn: document.querySelector("#reloadAppBtn"),
  loadSeedBtn: document.querySelector("#loadSeedBtn"),
  reloadSeedBtn: document.querySelector("#reloadSeedBtn"),
  reloadSeedTopBtn: document.querySelector("#reloadSeedTopBtn"),
  reloadSeedSideBtn: document.querySelector("#reloadSeedSideBtn"),
  deleteSeedBtn: document.querySelector("#deleteSeedBtn"),
  resetProgressBtn: document.querySelector("#resetProgressBtn"),
  resetProgressSideBtn: document.querySelector("#resetProgressSideBtn"),
  seedFileInput: document.querySelector("#seedFileInput"),
  setupMessage: document.querySelector("#setupMessage"),
  appUpdateMessage: document.querySelector("#appUpdateMessage"),
  seedCounts: document.querySelector("#seedCounts"),
  loadedSeedCounts: document.querySelector("#loadedSeedCounts"),
  fieldSelect: document.querySelector("#fieldSelect"),
  modeSelect: document.querySelector("#modeSelect"),
  reviewSelect: document.querySelector("#reviewSelect"),
  testCountSelect: document.querySelector("#testCountSelect"),
  resetQueueBtn: document.querySelector("#resetQueueBtn"),
  modeBadge: document.querySelector("#modeBadge"),
  fieldBadge: document.querySelector("#fieldBadge"),
  progressBadge: document.querySelector("#progressBadge"),
  questionArea: document.querySelector("#questionArea"),
  choicesArea: document.querySelector("#choicesArea"),
  resultArea: document.querySelector("#resultArea"),
  testSummaryArea: document.querySelector("#testSummaryArea"),
  showAnswerBtn: document.querySelector("#showAnswerBtn"),
  memoToggleBtn: document.querySelector("#memoToggleBtn"),
  memoPanel: document.querySelector("#memoPanel"),
  memoTypeSelect: document.querySelector("#memoTypeSelect"),
  memoTextInput: document.querySelector("#memoTextInput"),
  saveMemoBtn: document.querySelector("#saveMemoBtn"),
  cancelMemoBtn: document.querySelector("#cancelMemoBtn"),
  memoStatus: document.querySelector("#memoStatus"),
  memoListPanel: document.querySelector("#memoListPanel"),
  openMemoCount: document.querySelector("#openMemoCount"),
  memoList: document.querySelector("#memoList"),
  copyMemosBtn: document.querySelector("#copyMemosBtn"),
  exportMemosBtn: document.querySelector("#exportMemosBtn"),
  memoListStatus: document.querySelector("#memoListStatus"),
  rememberBtn: document.querySelector("#rememberBtn"),
  weakBtn: document.querySelector("#weakBtn"),
  wrongBtn: document.querySelector("#wrongBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  statAttempts: document.querySelector("#statAttempts"),
  statCorrect: document.querySelector("#statCorrect"),
  statWrong: document.querySelector("#statWrong"),
  statWeak: document.querySelector("#statWeak"),
  currentItemStats: document.querySelector("#currentItemStats"),
};

init();
registerServiceWorker();

async function init() {
  bindEvents();
  renderSummary();
  renderStats();
  try {
    const stored = await loadSeedFromIndexedDb();
    if (stored) {
      activateSeed(stored.seed, "IndexedDBから教材データを読み込みました。");
      if (stored.key && stored.key !== SEED_RECORD_KEY) {
        setAppUpdateMessage("旧バージョンの教材データを読み込んでいます。v10に切り替える場合は「教材データ再読み込み」から app_seed_v10.json を選択してください。", false, true);
      }
      return;
    }

    if (isDevSeedFetchEnabled()) {
      const devSeedLoaded = await tryLoadDevSeed();
      if (devSeedLoaded) return;
    }

    showSetup("教材データが未読込です。app_seed_v10.json を選択してください。");
  } catch (error) {
    showSetup(`教材データの読み込みに失敗しました: ${error.message}`, true);
  }
}

function isDevSeedFetchEnabled() {
  return new URLSearchParams(window.location.search).get("dev") === "1";
}

async function tryLoadDevSeed() {
  try {
    const response = await fetch(DEV_SEED_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const seed = await response.json();
    const counts = validateSeed(seed);
    await saveSeedToIndexedDb(seed, counts);
    activateSeed(seed, "開発用ローカルJSONをfetchしてIndexedDBに保存しました。");
    return true;
  } catch (error) {
    console.info(`開発用教材データの自動読み込みをスキップしました: ${error.message}`);
    return false;
  }
}

function bindEvents() {
  el.loadSeedBtn.addEventListener("click", () => el.seedFileInput.click());
  el.checkUpdateBtn.addEventListener("click", () => checkAppUpdate());
  el.reloadAppBtn.addEventListener("click", () => window.location.reload());
  el.reloadSeedBtn.addEventListener("click", () => el.seedFileInput.click());
  el.reloadSeedTopBtn?.addEventListener("click", () => el.seedFileInput.click());
  el.reloadSeedSideBtn?.addEventListener("click", () => el.seedFileInput.click());
  el.seedFileInput.addEventListener("change", () => handleSeedFileSelected());
  el.deleteSeedBtn.addEventListener("click", () => deleteSeedData());
  el.resetProgressBtn.addEventListener("click", () => resetProgress());
  el.resetProgressSideBtn?.addEventListener("click", () => resetProgress());
  el.memoToggleBtn.addEventListener("click", () => toggleMemoPanel());
  el.cancelMemoBtn.addEventListener("click", () => closeMemoPanel());
  el.saveMemoBtn.addEventListener("click", () => saveCurrentMemo());
  el.copyMemosBtn.addEventListener("click", () => copyMemosAsMarkdown());
  el.exportMemosBtn.addEventListener("click", () => exportMemosAsJson());
  el.fieldSelect.addEventListener("change", () => {
    state.field = el.fieldSelect.value;
    rebuildQueue();
  });
  el.modeSelect.addEventListener("change", () => {
    state.mode = el.modeSelect.value;
    rebuildQueue();
  });
  el.reviewSelect.addEventListener("change", () => {
    state.review = el.reviewSelect.value;
    rebuildQueue();
  });
  el.testCountSelect.addEventListener("change", () => {
    state.testCount = el.testCountSelect.value;
    rebuildQueue();
  });
  el.resetQueueBtn.addEventListener("click", () => {
    rebuildQueue();
  });
  el.nextBtn.addEventListener("click", () => {
    if (state.testComplete) {
      rebuildQueue();
      return;
    }
    if (!state.queue.length) return;
    if (state.testSession && state.currentIndex >= state.queue.length - 1) {
      renderTestSummary();
      return;
    }
    state.currentIndex = state.testSession ? state.currentIndex + 1 : (state.currentIndex + 1) % state.queue.length;
    renderCurrent();
  });
  el.showAnswerBtn.addEventListener("click", () => revealOriginal());
  el.rememberBtn.addEventListener("click", () => markSelfReview("remembered"));
  el.weakBtn.addEventListener("click", () => markSelfReview("weak"));
  el.wrongBtn.addEventListener("click", () => markSelfReview("wrong"));
}

async function handleSeedFileSelected() {
  const file = el.seedFileInput.files?.[0];
  el.seedFileInput.value = "";
  if (!file) return;
  try {
    setSetupMessage("教材データを検証中です...");
    const text = await file.text();
    const seed = JSON.parse(text);
    const counts = validateSeed(seed);
    await saveSeedToIndexedDb(seed, counts);
    activateSeed(seed, "教材データを端末内に保存しました。");
  } catch (error) {
    showSetup(`教材データを読み込めませんでした: ${error.message}`, true);
  }
}

function activateSeed(seed, message) {
  const counts = validateSeed(seed);
  state.seed = seed;
  state.seedCounts = counts;
  indexSeed(state.seed);
  el.setupPanel.hidden = true;
  el.controlPanel.hidden = false;
  el.studyLayout.hidden = false;
  el.dataPanel.hidden = false;
  el.memoListPanel.hidden = false;
  el.loadStatus.textContent = "教材読込済み";
  el.loadStatus.classList.add("ready");
  setSetupMessage(message, false, true);
  renderSeedCounts(el.loadedSeedCounts, counts);
  renderSummary();
  renderMemoList();
  rebuildQueue();
}

function showSetup(message, isError = false) {
  state.seed = null;
  state.seedCounts = null;
  state.queue = [];
  el.setupPanel.hidden = false;
  el.controlPanel.hidden = true;
  el.studyLayout.hidden = true;
  el.dataPanel.hidden = true;
  el.memoListPanel.hidden = true;
  el.loadStatus.textContent = "教材未読込";
  el.loadStatus.classList.remove("ready");
  setSetupMessage(message, isError);
  el.seedCounts.hidden = true;
}

function setSetupMessage(message, isError = false, isOk = false) {
  el.setupMessage.textContent = message;
  el.setupMessage.className = `setup-message ${isError ? "error" : isOk ? "ok" : ""}`;
}

function validateSeed(seed) {
  if (!seed || typeof seed !== "object") throw new Error("JSONの形式が不正です。");
  const isV10 = seed.version === "v10" || V10_SEED_KEYS.some((key) => key in seed);
  const keysToValidate = isV10 ? Object.keys(EXPECTED_SEED_COUNTS) : REQUIRED_SEED_KEYS;
  const counts = Object.fromEntries(
    keysToValidate.map((key) => {
      if (!Array.isArray(seed[key])) throw new Error(`${key} が配列ではありません。`);
      return [key, seed[key].length];
    }),
  );
  const mismatches = Object.entries(EXPECTED_SEED_COUNTS).filter(([key, expected]) => {
    if (!(key in counts)) return false;
    if (typeof expected === "number") return counts[key] !== expected;
    return counts[key] < expected.min;
  });
  if (mismatches.length) {
    renderSeedCounts(el.seedCounts, counts);
    el.seedCounts.hidden = false;
    throw new Error(
      `件数が想定と異なります: ${mismatches.map(([key, expected]) => `${key}=${counts[key]} expected ${expectedLabel(expected)}`).join(", ")}`,
    );
  }
  renderSeedCounts(el.seedCounts, counts);
  el.seedCounts.hidden = false;
  return counts;
}

function renderSeedCounts(container, counts) {
  container.innerHTML = Object.entries(EXPECTED_SEED_COUNTS)
    .map(
      ([key, expected]) => `
        <div>
          <span>${escapeHtml(key)}</span>
          <strong>${counts?.[key] ?? "-"}</strong>
          <span>expected ${expectedLabel(expected)}</span>
        </div>
      `,
    )
    .join("");
}

function expectedLabel(expected) {
  return typeof expected === "number" ? String(expected) : `${expected.min}+`;
}

async function deleteSeedData() {
  if (!window.confirm("端末内の教材データを削除します。進捗は残ります。")) return;
  await deleteSeedFromIndexedDb();
  showSetup("教材データを削除しました。再度 app_seed_v10.json を読み込んでください。");
}

async function checkAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    setAppUpdateMessage("このブラウザはService Workerに対応していません。", true);
    return;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      setAppUpdateMessage("Service Workerはまだ登録されていません。ページを再読み込みしてください。", true);
      return;
    }
    await registration.update();
    setAppUpdateMessage("アプリ更新を確認しました。更新がある場合は、少し待ってから再読み込みしてください。", false, true);
  } catch (error) {
    setAppUpdateMessage(`アプリ更新の確認に失敗しました: ${error.message}`, true);
  }
}

function setAppUpdateMessage(message, isError = false, isOk = false) {
  el.appUpdateMessage.textContent = message;
  el.appUpdateMessage.className = `setup-message ${isError ? "error" : isOk ? "ok" : ""}`;
}

function resetProgress() {
  if (!window.confirm("学習進捗をリセットします。教材データは残ります。")) return;
  state.progress = { items: {}, daily: {} };
  persistProgress();
  renderSummary();
  renderStats();
  if (state.queue.length) renderItemStats(state.queue[state.currentIndex]);
}

function indexSeed(seed) {
  seed.originalById = Object.fromEntries(seed.original_questions.map((item) => [item.question_id, item]));
  seed.memoryBySourceId = Object.fromEntries(seed.memory_points.map((item) => [item.source_question_id, item]));
  seed.clozeBySourceId = groupBy(seed.cloze_questions, "source_question_id");
  seed.falseBySourceId = groupBy(seed.generated_false_questions, "source_question_id");
  seed.multiClozeBySourceId = groupBy(seed.multi_cloze_questions || [], "source_question_id");
  seed.termCandidateById = Object.fromEntries((seed.term_candidates || []).map((item) => [item.term_id, item]));
  seed.termCandidateByTerm = Object.fromEntries((seed.term_candidates || []).map((item) => [item.term, item]));
  seed.original_choice_questions = seed.original_choice_questions || [];
  seed.multi_cloze_questions = seed.multi_cloze_questions || [];
  seed.term_candidates = seed.term_candidates || [];
  seed.source_images = seed.source_images || {};
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    if (!acc[value]) acc[value] = [];
    acc[value].push(item);
    return acc;
  }, {});
}

function renderSummary() {
  const today = todayKey();
  const daily = state.progress.daily?.[today] || { attempts: 0, correct: 0, wrong: 0 };
  const weak = Object.values(state.progress.items).filter((item) => item.weak).length;
  const stats = { ...daily, weak };
  const answered = stats.correct + stats.wrong;
  el.todayAttempts.textContent = stats.attempts;
  el.todayAccuracy.textContent = answered ? `${Math.round((stats.correct / answered) * 100)}%` : "-";
  el.weakCount.textContent = stats.weak;
}

function rebuildQueue() {
  if (!state.seed) return;
  state.answered = false;
  state.currentIndex = 0;
  state.testComplete = false;
  const source = itemsForMode(state.mode);
  const filtered = source.filter((item) => matchesField(item) && matchesReview(item));
  state.queue = shuffleItems(filtered);
  const requestedCount = Number(state.testCount);
  state.testSession = Number.isFinite(requestedCount)
    ? {
        targetCount: Math.min(requestedCount, state.queue.length),
        correct: 0,
        wrong: [],
        answeredIds: new Set(),
      }
    : null;
  if (state.testSession) {
    state.queue = state.queue.slice(0, state.testSession.targetCount);
  }
  renderCurrent();
  renderStats();
}

function shuffleItems(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  for (let i = 1; i < copy.length; i += 1) {
    if (sourceIdFor(copy[i]) === sourceIdFor(copy[i - 1])) {
      const swapIndex = copy.findIndex((candidate, index) => index > i && sourceIdFor(candidate) !== sourceIdFor(copy[i - 1]));
      if (swapIndex > i) [copy[i], copy[swapIndex]] = [copy[swapIndex], copy[i]];
    }
  }
  return copy;
}

function shuffleChoices(choices, answer) {
  const normalizedAnswer = String(answer || "").trim();
  const unique = uniqueStrings([...(choices || []), normalizedAnswer]);
  for (let i = unique.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  // 選択肢生成データに正解が先頭固定で入っている場合でも、左上連打で解けないようにする。
  if (unique.length > 1 && unique[0] === normalizedAnswer) {
    const swapIndex = unique.findIndex((value, index) => index > 0 && value !== normalizedAnswer);
    if (swapIndex > 0) [unique[0], unique[swapIndex]] = [unique[swapIndex], unique[0]];
  }
  return unique;
}

function itemsForMode(mode) {
  if (mode === "multiCloze") return state.seed.multi_cloze_questions || [];
  if (mode === "originalChoice") return state.seed.original_choice_questions || [];
  if (mode === "original") return state.seed.original_questions;
  if (mode === "false") return state.seed.generated_false_questions;
  return state.seed.memory_points;
}

function itemId(item) {
  if (state.mode === "multiCloze") return item.multi_cloze_id;
  if (state.mode === "originalChoice") return item.original_choice_id;
  if (state.mode === "original") return item.question_id;
  if (state.mode === "false") return item.false_question_id;
  return item.memory_id;
}

function sourceIdFor(item) {
  return item.source_question_id || item.question_id;
}

function matchesField(item) {
  return state.field === "all" || item.field === state.field;
}

function matchesReview(item) {
  if (state.review === "all") return true;
  const stats = progressFor(itemId(item));
  if (state.review === "wrong") return stats.wrong > 0;
  if (state.review === "weak") return stats.weak === true;
  return true;
}

function renderCurrent() {
  clearQuestion();
  if (!state.seed) return;
  if (!state.queue.length) {
    el.modeBadge.textContent = MODE_LABELS[state.mode];
    el.fieldBadge.textContent = state.field === "all" ? "全分野" : FIELD_LABELS[state.field];
    el.progressBadge.textContent = "0 / 0";
    el.questionArea.textContent = "該当する問題がありません。";
    renderStats();
    return;
  }
  state.answered = false;
  const item = state.queue[state.currentIndex];
  el.modeBadge.textContent = MODE_LABELS[state.mode];
  el.fieldBadge.textContent = item.field ? FIELD_LABELS[item.field] : "-";
  el.progressBadge.textContent = `${state.currentIndex + 1} / ${state.queue.length}`;
  if (state.testSession) {
    el.progressBadge.textContent = `テスト ${state.currentIndex + 1} / ${state.queue.length}`;
  }

  if (state.mode === "multiCloze") renderMultiCloze(item);
  if (state.mode === "originalChoice") renderOriginalChoice(item);
  if (state.mode === "original") renderOriginal(item);
  if (state.mode === "false") renderFalse(item);
  if (state.mode === "memory") renderMemory(item);
  renderItemStats(item);
  prepareMemoForItem(item);
}

function clearQuestion() {
  el.questionArea.innerHTML = "";
  el.choicesArea.innerHTML = "";
  el.resultArea.hidden = true;
  el.resultArea.className = "result-area";
  el.resultArea.textContent = "";
  el.testSummaryArea.hidden = true;
  el.testSummaryArea.innerHTML = "";
  closeMemoPanel({ clear: true });
  el.memoToggleBtn.hidden = true;
  state.multiSelections = {};
  el.showAnswerBtn.hidden = true;
  el.rememberBtn.hidden = true;
  el.weakBtn.hidden = true;
  el.wrongBtn.hidden = true;
  el.nextBtn.textContent = "次へ";
}

function renderMultiCloze(item) {
  el.questionArea.innerHTML = "";
  const prompt = document.createElement("div");
  prompt.textContent = item.prompt;
  el.questionArea.append(prompt);
  if (item.quality_warning) {
    const warning = document.createElement("p");
    warning.className = "quality-warning";
    warning.textContent = `注意: ${item.quality_warning}`;
    el.questionArea.append(warning);
  }
  if (item.trap_intent) {
    const trap = document.createElement("p");
    trap.className = "subtle";
    trap.textContent = `狙い: ${item.trap_intent}`;
    el.questionArea.append(trap);
  }
  appendSourceImage(item);
  appendTermHelp(item);
  el.fieldBadge.textContent = FIELD_LABELS[item.field];
  el.modeBadge.textContent = `${MODE_LABELS.multiCloze} / ${item.difficulty_level || "-"}`;

  (item.blanks || []).forEach((blank) => {
    const card = document.createElement("section");
    card.className = "multi-blank-card";
    card.dataset.blankNo = String(blank.blank_no);
    const title = document.createElement("h3");
    title.textContent = `空欄${blank.blank_no}`;
    const choices = document.createElement("div");
    choices.className = "multi-choice-grid";
    shuffleChoices(blank.choices || [], blank.answer).forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = choice;
      button.addEventListener("click", () => selectMultiChoice(blank.blank_no, choice, choices));
      choices.append(button);
    });
    card.append(title, choices);
    el.choicesArea.append(card);
  });

  const answerButton = document.createElement("button");
  answerButton.type = "button";
  answerButton.className = "primary multi-answer-button";
  answerButton.textContent = "回答する";
  answerButton.addEventListener("click", () => answerMultiCloze(item));
  el.choicesArea.append(answerButton);
}

function selectMultiChoice(blankNo, choice, container) {
  if (state.answered) return;
  state.multiSelections[blankNo] = choice;
  [...container.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("selected", button.textContent === choice);
  });
}

function answerMultiCloze(item) {
  if (state.answered) return;
  const blanks = item.blanks || [];
  const missing = blanks.filter((blank) => !state.multiSelections[blank.blank_no]);
  if (missing.length) {
    el.resultArea.hidden = false;
    el.resultArea.className = "result-area warn";
    el.resultArea.textContent = `未選択の空欄があります: ${missing.map((blank) => blank.blank_no).join(", ")}`;
    return;
  }

  state.answered = true;
  let correctCount = 0;
  const lines = [];
  blanks.forEach((blank) => {
    const selected = state.multiSelections[blank.blank_no];
    const correct = selected === blank.answer;
    if (correct) correctCount += 1;
    lines.push(
      [
        `空欄${blank.blank_no}: ${correct ? "正解" : "不正解"}`,
        `あなたの回答: ${selected}`,
        `答え: ${blank.answer}`,
        blank.explanation ? `解説: ${blank.explanation}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    const card = el.choicesArea.querySelector(`.multi-blank-card[data-blank-no="${blank.blank_no}"]`);
    card?.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
      if (button.textContent === blank.answer) button.classList.add("correct");
      if (button.textContent === selected && !correct) button.classList.add("incorrect");
    });
  });

  const allCorrect = correctCount === blanks.length;
  saveAttempt(itemId(item), allCorrect, { partialCorrect: correctCount, partialTotal: blanks.length });
  recordTestAnswer(item, allCorrect);
  el.resultArea.hidden = false;
  el.resultArea.className = `result-area ${allCorrect ? "ok" : "bad"}`;
  el.resultArea.textContent = [`${correctCount} / ${blanks.length} 正解`, "", ...lines].join("\n");
  renderStats();
  renderSummary();
  renderItemStats(item);
}

function renderOriginal(item) {
  el.questionArea.innerHTML = "";
  const text = document.createElement("div");
  text.textContent = item.question_text;
  const meta = document.createElement("p");
  meta.className = "subtle";
  meta.textContent = `答え: ${item.answer || "-"} / review_status: ${item.review_status || "-"}`;
  el.questionArea.append(text, meta);
  appendSourceImage(item);
  appendTermHelp(item);
  el.showAnswerBtn.textContent = "覚えるポイントを見る";
  el.showAnswerBtn.hidden = false;
}

function renderOriginalChoice(item) {
  el.questionArea.innerHTML = "";
  const prompt = document.createElement("div");
  prompt.textContent = item.prompt;
  const note = document.createElement("p");
  note.className = "subtle";
  note.textContent = item.choices_need_source_image
    ? "選択肢のOCRが不安定なため、原本ページ画像で選択肢を確認してください。"
    : item.answer_note || "原文選択問題です。現段階では自己確認用です。";
  el.questionArea.append(prompt, note);

  const answerPanel = document.createElement("div");
  answerPanel.className = "answer-slots";
  const answerTitle = document.createElement("h3");
  answerTitle.textContent = "回答欄";
  answerPanel.append(answerTitle);
  const keys = item.answer_keys || [];
  if (keys.length) {
    keys.forEach((key, index) => {
      const row = document.createElement("div");
      row.className = "answer-slot";
      const label = document.createElement("span");
      label.textContent = key.blank ? `${key.blank}` : `正解${index + 1}`;
      const value = document.createElement("strong");
      value.dataset.answer = key.answer;
      value.textContent = "答えを見る";
      row.append(label, value);
      answerPanel.append(row);
    });
  } else {
    const row = document.createElement("p");
    row.className = "subtle";
    row.textContent = "正答キー未保持のため、原本ページ画像で自己確認してください。";
    answerPanel.append(row);
  }
  el.choicesArea.append(answerPanel);

  const choicesTitle = document.createElement("h3");
  choicesTitle.className = "choices-title";
  choicesTitle.textContent = "選択肢";
  el.choicesArea.append(choicesTitle);
  (item.choices || []).forEach((choice) => {
    const choiceLine = document.createElement("div");
    choiceLine.className = "choice-reference";
    choiceLine.textContent = `${choice.label}. ${choice.text}`;
    el.choicesArea.append(choiceLine);
  });
  if (!item.choices?.length) {
    const info = document.createElement("p");
    info.className = "subtle";
    info.textContent = "この問題は選択問題です。選択肢は下の原本ページ画像で確認し、「答えを見る」で正解例を確認してください。";
    el.choicesArea.append(info);
  }
  appendSourceImage(item);
  appendTermHelp(item);
  el.showAnswerBtn.textContent = "答えを見る";
  el.showAnswerBtn.hidden = false;
  el.rememberBtn.hidden = false;
  el.weakBtn.hidden = false;
  el.wrongBtn.hidden = false;
}

function revealOriginal() {
  const item = state.queue[state.currentIndex];
  if (state.mode === "originalChoice") {
    el.choicesArea.querySelectorAll("[data-answer]").forEach((node) => {
      const label = node.dataset.answer;
      node.textContent = `${label}${choiceTextForLabel(item, label)}`;
    });
    el.resultArea.hidden = false;
    el.resultArea.classList.add(item.answer_raw ? "ok" : "warn");
    el.resultArea.textContent = item.answer_raw
      ? `正解例: ${item.answer_raw}`
      : "この選択問題の正答キーはまだ教材データにありません。";
    el.rememberBtn.hidden = false;
    el.weakBtn.hidden = false;
    el.wrongBtn.hidden = false;
    return;
  }
  const memory = state.seed.memoryBySourceId[item.question_id];
  const memoryPanel = buildOriginalMemoryPanel(item, memory);
  el.resultArea.hidden = false;
  el.resultArea.className = "result-area ok";
  el.resultArea.innerHTML = "";
  el.resultArea.append(memoryPanel);
  el.rememberBtn.hidden = false;
  el.weakBtn.hidden = false;
  el.wrongBtn.hidden = false;
}

function buildOriginalMemoryPanel(item, memory) {
  const panel = document.createElement("div");
  panel.className = "memory-point-panel";
  const answer = document.createElement("p");
  answer.className = "memory-answer";
  answer.textContent = `答え: ${item.answer || "○"}`;
  panel.append(answer);

  if (item.review_status) {
    const status = document.createElement("p");
    status.className = "subtle";
    status.textContent = `review_status: ${item.review_status}`;
    panel.append(status);
  }

  if (!memory) {
    panel.append(fallbackMemoryMessage());
    return panel;
  }

  const usable = normalizedMemory(memory);
  let hasUsefulMemory = false;
  if (usable.oneLine) {
    panel.append(memorySection("一言ポイント", usable.oneLine));
    hasUsefulMemory = true;
  }
  if (usable.why) {
    panel.append(memorySection("なぜ○か", usable.why));
    hasUsefulMemory = true;
  }
  if (usable.keyTerms.length) {
    panel.append(listBlock("key_terms", usable.keyTerms));
    hasUsefulMemory = true;
  }
  if (usable.trapPoints.length) {
    panel.append(listBlock("trap_points", usable.trapPoints));
    hasUsefulMemory = true;
  }
  if (usable.examFocus) {
    panel.append(memorySection("exam_focus", usable.examFocus));
    hasUsefulMemory = true;
  }
  if (!hasUsefulMemory) panel.append(fallbackMemoryMessage());
  return panel;
}

function memorySection(label, value) {
  const section = document.createElement("section");
  section.className = "memory-section";
  const title = document.createElement("h3");
  title.textContent = label;
  const body = document.createElement("p");
  body.textContent = value;
  section.append(title, body);
  return section;
}

function fallbackMemoryMessage() {
  const message = document.createElement("p");
  message.textContent = "この問題の個別解説は未作成です。原文の重要語・条件・対象範囲を確認してください。";
  return message;
}

function normalizedMemory(memory) {
  const oneLine = isGenericMemoryText(memory.one_line_memory) ? "" : memory.one_line_memory || "";
  const why = isGenericMemoryText(memory.why_true_short) ? "" : memory.why_true_short || "";
  const examFocus = isGenericMemoryText(memory.exam_focus) ? "" : memory.exam_focus || "";
  const keyTerms = usefulTerms(memory.key_terms || []);
  const trapPoints = (memory.trap_points || []).filter((point) => !GENERIC_TRAP_POINTS.has(point));
  return { oneLine, why, keyTerms, trapPoints, examFocus };
}

function isGenericMemoryText(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (GENERIC_MEMORY_TEXTS.has(text)) return true;
  return /^[A-D]問\d+は、.+に関する原文の条件・対象・役割を押さえる。$/.test(text);
}

function choiceTextForLabel(item, label) {
  const choice = (item.choices || []).find((candidate) => candidate.label === label);
  return choice ? `（${choice.text}）` : "";
}

function renderFalse(item) {
  el.questionArea.textContent = item.false_question_text;
  appendSourceImage(item);
  appendTermHelp(item);
  ["○", "×"].forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = choice;
    button.addEventListener("click", () => answerFalse(item, choice));
    el.choicesArea.append(button);
  });
}

function answerFalse(item, choice) {
  if (state.answered) return;
  state.answered = true;
  const correct = choice === "×";
  saveAttempt(itemId(item), correct);
  recordTestAnswer(item, correct);
  [...el.choicesArea.children].forEach((button) => {
    button.disabled = true;
    if (button.textContent === "×") button.classList.add("correct");
    if (button.textContent === choice && !correct) button.classList.add("incorrect");
  });
  const changed = item.changed_point || {};
  el.resultArea.hidden = false;
  el.resultArea.classList.add(correct ? "ok" : "bad");
  el.resultArea.textContent = [
    correct ? "正解" : "不正解",
    `変更箇所: ${changed.original || "-"} → ${changed.changed_to || "-"}`,
    `正しい事実: ${item.correct_fact || "-"}`,
    `理由: ${item.why_false || "-"}`,
  ].join("\n");
  renderStats();
  renderSummary();
  renderItemStats(item);
}

function renderMemory(item) {
  el.questionArea.innerHTML = "";
  const title = document.createElement("h2");
  title.textContent = item.memory_title;
  const oneLine = document.createElement("p");
  oneLine.textContent = item.one_line_memory;
  const why = document.createElement("p");
  why.textContent = item.why_true_short;
  const focus = document.createElement("p");
  focus.textContent = `Focus: ${item.exam_focus}`;
  const terms = listBlock("key_terms", item.key_terms);
  const traps = listBlock("trap_points", item.trap_points);
  el.questionArea.append(title, oneLine, why, focus, terms, traps);
  appendSourceImage(item);
  appendTermHelp(item);
  el.rememberBtn.hidden = false;
  el.weakBtn.hidden = false;
  el.wrongBtn.hidden = false;
}

function appendSourceImage(item) {
  const source = state.seed.originalById?.[sourceIdFor(item)];
  const sourceImages = [...new Set([...(source?.figure_refs || []), source?.source_image].filter(Boolean))];
  const availableImages = sourceImages
    .map((sourceImage) => ({ sourceImage, dataUrl: state.seed.source_images?.[sourceImage] }))
    .filter((entry) => entry.dataUrl);
  if (!availableImages.length) return;
  const details = document.createElement("details");
  details.className = "source-image-panel";
  const summary = document.createElement("summary");
  summary.textContent = availableImages.length > 1 ? `原本ページ画像を表示（${availableImages.length}枚）` : "原本ページ画像を表示";
  details.append(summary);
  availableImages.forEach((entry, index) => {
    const label = document.createElement("p");
    label.className = "source-image-label";
    label.textContent = `${source.field} 問${source.question_number} 原本ページ ${index + 1}`;
    const img = document.createElement("img");
    img.src = entry.dataUrl;
    img.alt = `${source.field} 問${source.question_number} 原本ページ ${index + 1}`;
    img.loading = "lazy";
    details.append(label, img);
  });
  el.questionArea.append(details);
}

function appendTermHelp(item) {
  if (!state.seed?.term_candidates?.length) return;
  const candidates = termHelpCandidates(item);
  const keyTerms = termHelpKeyTerms(item);
  const relatedIds = termHelpRelatedIds(item);
  const comparisonTerms = uniqueStrings([
    ...(item.comparison_needed_terms || []),
    ...candidates.flatMap((candidate) => candidate.likely_compare_with || []),
  ]).slice(0, 8);
  if (!candidates.length && !keyTerms.length && !comparisonTerms.length && !relatedIds.length) return;

  const details = document.createElement("details");
  details.className = "term-help-panel compact";
  const summary = document.createElement("summary");
  summary.textContent = "用語ヘルプ";
  details.append(summary);

  const notice = document.createElement("p");
  notice.className = "subtle";
  notice.textContent = "この用語ヘルプは候補情報です。定義の確定版ではありません。";
  details.append(notice);

  if (keyTerms.length) {
    details.append(listBlock("key_terms", keyTerms.slice(0, 12)));
  }
  if (comparisonTerms.length) {
    details.append(listBlock("comparison_needed_terms", comparisonTerms));
  }
  if (relatedIds.length) {
    details.append(listBlock("related_term_ids", relatedIds.slice(0, 8)));
  }

  if (candidates.length) {
    const list = document.createElement("div");
    list.className = "term-help-list";
    candidates.slice(0, 6).forEach((candidate) => {
      const card = document.createElement("article");
      card.className = "term-help-card";
      const labels = [];
      if (candidate.definition_risk === "high") labels.push("要確認");
      if (candidate.comparison_needed) labels.push("比較注意");
      card.innerHTML = `
        <h3>${escapeHtml(candidate.term)}</h3>
        <p>category: ${escapeHtml(candidate.category || "-")}</p>
        <p>importance: ${escapeHtml(candidate.importance || "-")}</p>
        <p>definition_risk: ${escapeHtml(candidate.definition_risk || "-")}</p>
        <p>comparison_needed: ${candidate.comparison_needed ? "true" : "false"}</p>
        ${
          labels.length
            ? `<p class="term-labels">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</p>`
            : ""
        }
        ${
          candidate.likely_compare_with?.length
            ? `<p>似た用語: ${escapeHtml(candidate.likely_compare_with.join(" / "))}</p>`
            : ""
        }
      `;
      list.append(card);
    });
    details.append(list);
  }

  el.questionArea.append(details);
}

function termHelpCandidates(item) {
  const sourceId = sourceIdFor(item);
  const source = state.seed.originalById?.[sourceId];
  const memory = source ? state.seed.memoryBySourceId?.[source.question_id] : null;
  const multi = source ? state.seed.multiClozeBySourceId?.[source.question_id]?.[0] : null;
  const ids = uniqueStrings([
    ...(item.related_term_ids || []),
    ...(multi?.related_term_ids || []),
  ]);
  const terms = termHelpKeyTerms(item);
  const candidates = [];
  ids.forEach((id) => {
    const candidate = state.seed.termCandidateById?.[id];
    if (candidate) candidates.push(candidate);
  });
  terms.forEach((term) => {
    const candidate = state.seed.termCandidateByTerm?.[term];
    if (candidate) candidates.push(candidate);
  });
  if (source?.question_text) {
    state.seed.term_candidates
      .filter((candidate) => candidate.importance === "high" && source.question_text.includes(candidate.term))
      .slice(0, 8)
      .forEach((candidate) => candidates.push(candidate));
  }
  if (memory?.key_terms) {
    memory.key_terms.forEach((term) => {
      const candidate = state.seed.termCandidateByTerm?.[term];
      if (candidate) candidates.push(candidate);
    });
  }
  return uniqueBy(candidates, "term_id");
}

function termHelpKeyTerms(item) {
  const sourceId = sourceIdFor(item);
  const source = state.seed.originalById?.[sourceId];
  const memory = source ? state.seed.memoryBySourceId?.[source.question_id] : null;
  const multi = source ? state.seed.multiClozeBySourceId?.[source.question_id]?.[0] : null;
  return usefulTerms([
    ...(item.key_terms || []),
    ...(memory?.key_terms || []),
    ...(multi?.key_terms || []),
  ]);
}

function termHelpRelatedIds(item) {
  const sourceId = sourceIdFor(item);
  const source = state.seed.originalById?.[sourceId];
  const multi = source ? state.seed.multiClozeBySourceId?.[source.question_id]?.[0] : null;
  return uniqueStrings([...(item.related_term_ids || []), ...(multi?.related_term_ids || [])]);
}

function usefulTerms(values) {
  return uniqueStrings(values).filter((value) => {
    if (/^[\d.]+$/.test(value)) return false;
    if (/^[a-zA-Z]$/.test(value)) return false;
    if (/^[a-zA-Z/]+$/.test(value) && value.length <= 4) return false;
    if (/^[\d.]+(?:m|km|N|J|W|s|kg|kN|km\/h|m\/s|m\/s²)$/.test(value)) return false;
    return true;
  });
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item?.[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uniqueStrings(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function listBlock(label, values = []) {
  const wrap = document.createElement("div");
  const head = document.createElement("p");
  head.className = "subtle";
  head.textContent = label;
  const list = document.createElement("ul");
  list.className = "term-list";
  values.forEach((value) => {
    const li = document.createElement("li");
    li.textContent = value;
    list.append(li);
  });
  wrap.append(head, list);
  return wrap;
}

function markSelfReview(result) {
  const item = state.queue[state.currentIndex];
  const id = itemId(item);
  const stats = progressFor(id);
  stats.attempts += 1;
  stats.lastStudiedAt = new Date().toISOString();
  if (result === "remembered") {
    stats.correct += 1;
    stats.weak = false;
  }
  if (result === "weak") {
    stats.weak = true;
  }
  if (result === "wrong") {
    stats.wrong += 1;
    stats.weak = true;
  }
  incrementDaily(result === "remembered");
  state.progress.items[id] = stats;
  persistProgress();
  recordTestAnswer(item, result === "remembered");
  el.resultArea.hidden = false;
  el.resultArea.classList.add(result === "wrong" ? "bad" : "ok");
  el.resultArea.textContent = result === "remembered" ? "記録: 覚えた" : result === "weak" ? "記録: 怪しい" : "記録: 間違えた";
  renderStats();
  renderSummary();
  renderItemStats(item);
}

function recordTestAnswer(item, correct) {
  if (!state.testSession) return;
  const id = itemId(item);
  if (state.testSession.answeredIds.has(id)) return;
  state.testSession.answeredIds.add(id);
  if (correct) {
    state.testSession.correct += 1;
    return;
  }
  const source = state.seed.originalById[sourceIdFor(item)];
  state.testSession.wrong.push({
    id,
    label: source ? `${FIELD_LABELS[source.field]} 問${source.question_number}` : id,
  });
}

function renderTestSummary() {
  clearQuestion();
  const total = state.queue.length;
  const correct = state.testSession?.correct || 0;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  el.modeBadge.textContent = `${MODE_LABELS[state.mode]} テスト`;
  el.fieldBadge.textContent = state.field === "all" ? "全分野" : FIELD_LABELS[state.field];
  el.progressBadge.textContent = "終了";
  el.questionArea.textContent = "テスト終了";
  el.testSummaryArea.hidden = false;
  state.testComplete = true;
  const wrongItems = state.testSession?.wrong || [];
  el.testSummaryArea.innerHTML = `
    <h2>結果</h2>
    <p>出題数: ${total}</p>
    <p>正解数: ${correct}</p>
    <p>正答率: ${rate}%</p>
    <h2>間違えた問題</h2>
    ${
      wrongItems.length
        ? `<ul>${wrongItems.map((item) => `<li>${escapeHtml(item.label)}</li>`).join("")}</ul>`
        : "<p>なし</p>"
    }
  `;
  el.nextBtn.textContent = "もう一度";
}

function prepareMemoForItem(item) {
  el.memoToggleBtn.hidden = false;
  el.memoToggleBtn.textContent = openMemoCountForSource(sourceIdFor(item))
    ? `この問題をメモ（${openMemoCountForSource(sourceIdFor(item))}）`
    : "この問題をメモ";
}

function toggleMemoPanel() {
  if (!state.queue.length) return;
  const willOpen = el.memoPanel.hidden;
  if (willOpen) {
    el.memoPanel.hidden = false;
    el.memoStatus.textContent = "";
    el.memoStatus.className = "setup-message";
    el.memoTextInput.focus();
    return;
  }
  closeMemoPanel();
}

function closeMemoPanel(options = {}) {
  if (!el.memoPanel) return;
  el.memoPanel.hidden = true;
  el.memoStatus.textContent = "";
  el.memoStatus.className = "setup-message";
  if (options.clear) {
    el.memoTypeSelect.value = "用語が分からない";
    el.memoTextInput.value = "";
  }
}

function saveCurrentMemo() {
  if (!state.queue.length) return;
  const memoText = el.memoTextInput.value.trim();
  if (!memoText) {
    setMemoStatus("メモ本文を入力してください。", true);
    return;
  }
  const item = state.queue[state.currentIndex];
  const context = memoContextFor(item);
  const now = new Date().toISOString();
  const memo = {
    memo_id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: now,
    mode: state.mode,
    field: context.field,
    source_question_id: context.source_question_id,
    item_id: itemId(item),
    question_text: context.question_text,
    memo_type: el.memoTypeSelect.value,
    memo_text: memoText,
    resolved: false,
  };
  state.memos.unshift(memo);
  persistMemos();
  el.memoTextInput.value = "";
  setMemoStatus("メモを保存しました。", false, true);
  prepareMemoForItem(item);
  renderMemoList();
}

function setMemoStatus(message, isError = false, isOk = false) {
  el.memoStatus.textContent = message;
  el.memoStatus.className = `setup-message ${isError ? "error" : isOk ? "ok" : ""}`;
}

function memoContextFor(item) {
  const sourceId = sourceIdFor(item);
  const source = state.seed.originalById?.[sourceId];
  const questionText =
    source?.question_text ||
    item.question_text ||
    item.prompt ||
    item.false_question_text ||
    item.one_line_memory ||
    "";
  return {
    source_question_id: sourceId,
    field: source?.field || item.field || "-",
    question_text: questionText,
  };
}

function openMemoCountForSource(sourceId) {
  return state.memos.filter((memo) => memo.source_question_id === sourceId && !memo.resolved).length;
}

function renderMemoList() {
  if (!el.memoList) return;
  const openMemos = state.memos.filter((memo) => !memo.resolved);
  el.openMemoCount.textContent = `${openMemos.length}件`;
  if (!state.memos.length) {
    el.memoList.innerHTML = "<p class=\"subtle\">問題メモはまだありません。</p>";
    return;
  }
  el.memoList.innerHTML = "";
  state.memos.forEach((memo, index) => {
    const card = document.createElement("article");
    card.className = `memo-card ${memo.resolved ? "resolved" : ""}`;
    card.innerHTML = `
      <div class="memo-card-head">
        <strong>${escapeHtml(memo.memo_type)}</strong>
        <span>${escapeHtml(formatDateTime(memo.created_at))}</span>
      </div>
      <p class="memo-meta">${escapeHtml(memo.field)} / ${escapeHtml(MODE_LABELS[memo.mode] || memo.mode)} / ${escapeHtml(memo.source_question_id)}</p>
      <p class="memo-text">${escapeHtml(memo.memo_text)}</p>
      <details>
        <summary>問題文</summary>
        <p>${escapeHtml(memo.question_text)}</p>
      </details>
      <div class="memo-card-actions">
        <button type="button" data-memo-action="resolve" data-memo-index="${index}">${memo.resolved ? "未対応に戻す" : "解決済みにする"}</button>
        <button type="button" data-memo-action="delete" data-memo-index="${index}" class="secondary">削除</button>
      </div>
    `;
    el.memoList.append(card);
  });
  el.memoList.querySelectorAll("[data-memo-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.memoIndex);
      if (button.dataset.memoAction === "resolve") toggleMemoResolved(index);
      if (button.dataset.memoAction === "delete") deleteMemo(index);
    });
  });
}

function toggleMemoResolved(index) {
  if (!state.memos[index]) return;
  state.memos[index].resolved = !state.memos[index].resolved;
  persistMemos();
  renderMemoList();
  if (state.queue.length) prepareMemoForItem(state.queue[state.currentIndex]);
}

function deleteMemo(index) {
  if (!state.memos[index]) return;
  if (!window.confirm("このメモを削除します。")) return;
  state.memos.splice(index, 1);
  persistMemos();
  renderMemoList();
  if (state.queue.length) prepareMemoForItem(state.queue[state.currentIndex]);
}

async function copyMemosAsMarkdown() {
  const markdown = memosToMarkdown(state.memos);
  try {
    await navigator.clipboard.writeText(markdown);
    setMemoListStatus("Markdown形式でコピーしました。", false, true);
  } catch {
    fallbackCopyText(markdown);
    setMemoListStatus("Markdownを選択状態にしました。コピーしてください。", false, true);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "visually-hidden-copy";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function exportMemosAsJson() {
  const blob = new Blob([JSON.stringify(state.memos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `study-question-memos-${todayKey()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setMemoListStatus("メモJSONを書き出しました。", false, true);
}

function memosToMarkdown(memos) {
  if (!memos.length) return "## 問題メモ\n\nメモはありません。\n";
  const lines = ["## 問題メモ", ""];
  memos.forEach((memo, index) => {
    lines.push(`### ${index + 1}`);
    lines.push(`- 日時: ${formatDateTime(memo.created_at)}`);
    lines.push(`- 分野: ${memo.field}`);
    lines.push(`- モード: ${MODE_LABELS[memo.mode] || memo.mode}`);
    lines.push(`- source_question_id: ${memo.source_question_id}`);
    lines.push(`- 種別: ${memo.memo_type}`);
    lines.push(`- resolved: ${memo.resolved ? "true" : "false"}`);
    lines.push(`- メモ: ${memo.memo_text}`);
    lines.push(`- 問題文: ${memo.question_text}`);
    lines.push("");
  });
  return lines.join("\n");
}

function setMemoListStatus(message, isError = false, isOk = false) {
  el.memoListStatus.textContent = message;
  el.memoListStatus.className = `setup-message ${isError ? "error" : isOk ? "ok" : ""}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("ja-JP");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function saveAttempt(id, correct, extra = {}) {
  const stats = progressFor(id);
  stats.attempts += 1;
  stats.lastStudiedAt = new Date().toISOString();
  if (extra.partialTotal) {
    stats.partialCorrect += extra.partialCorrect || 0;
    stats.partialTotal += extra.partialTotal || 0;
  }
  if (correct) {
    stats.correct += 1;
  } else {
    stats.wrong += 1;
    stats.weak = true;
  }
  incrementDaily(correct);
  state.progress.items[id] = stats;
  persistProgress();
}

function incrementDaily(correct) {
  const today = todayKey();
  if (!state.progress.daily) state.progress.daily = {};
  const stats = state.progress.daily[today] || { attempts: 0, correct: 0, wrong: 0 };
  stats.attempts += 1;
  if (correct) stats.correct += 1;
  else stats.wrong += 1;
  state.progress.daily[today] = stats;
}

function progressFor(id) {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    partialCorrect: 0,
    partialTotal: 0,
    weak: false,
    lastStudiedAt: null,
    ...(state.progress.items[id] || {}),
  };
}

function loadProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { items: {} };
    return { items: {}, daily: {}, ...progress };
  } catch {
    return { items: {}, daily: {} };
  }
}

function persistProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function loadMemos() {
  try {
    const memos = JSON.parse(localStorage.getItem(MEMO_STORAGE_KEY));
    return Array.isArray(memos) ? memos : [];
  } catch {
    return [];
  }
}

function persistMemos() {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(state.memos));
}

function openSeedDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("このブラウザはIndexedDBに対応していません。"));
      return;
    }
    const request = indexedDB.open(SEED_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SEED_STORE_NAME)) {
        db.createObjectStore(SEED_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDBを開けませんでした。"));
  });
}

async function loadSeedFromIndexedDb() {
  const db = await openSeedDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SEED_STORE_NAME, "readonly");
    const store = transaction.objectStore(SEED_STORE_NAME);
    const keys = [SEED_RECORD_KEY, ...LEGACY_SEED_RECORD_KEYS];
    let index = 0;
    const tryNext = () => {
      const request = store.get(keys[index]);
      request.onsuccess = () => {
        if (request.result || index === keys.length - 1) {
          db.close();
          resolve(request.result || null);
          return;
        }
        index += 1;
        tryNext();
      };
      request.onerror = () => {
        db.close();
        reject(request.error || new Error("教材データを読み込めませんでした。"));
      };
    };
    tryNext();
  });
}

async function saveSeedToIndexedDb(seed, counts) {
  const db = await openSeedDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SEED_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SEED_STORE_NAME);
    store.put({
      key: SEED_RECORD_KEY,
      seed,
      counts,
      savedAt: new Date().toISOString(),
    });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("教材データを保存できませんでした。"));
    };
  });
}

async function deleteSeedFromIndexedDb() {
  const db = await openSeedDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SEED_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SEED_STORE_NAME);
    [SEED_RECORD_KEY, ...LEGACY_SEED_RECORD_KEYS].forEach((key) => store.delete(key));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("教材データを削除できませんでした。"));
    };
  });
}

function todayKey() {
  return dateKey(new Date().toISOString());
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderStats() {
  const stats = Object.values(state.progress.items).reduce(
    (acc, item) => {
      acc.attempts += item.attempts || 0;
      acc.correct += item.correct || 0;
      acc.wrong += item.wrong || 0;
      if (item.weak) acc.weak += 1;
      return acc;
    },
    { attempts: 0, correct: 0, wrong: 0, weak: 0 },
  );
  el.statAttempts.textContent = stats.attempts;
  el.statCorrect.textContent = stats.correct;
  el.statWrong.textContent = stats.wrong;
  el.statWeak.textContent = stats.weak;
}

function renderItemStats(item) {
  const stats = progressFor(itemId(item));
  const last = stats.lastStudiedAt ? new Date(stats.lastStudiedAt).toLocaleString() : "-";
  const source = state.seed.originalById[sourceIdFor(item)];
  el.currentItemStats.textContent = [
    source ? `${FIELD_LABELS[source.field]} 問${source.question_number}` : "",
    `この問題: ${stats.attempts}回 / 正解${stats.correct} / 間違い${stats.wrong}`,
    stats.partialTotal ? `部分正解累計: ${stats.partialCorrect} / ${stats.partialTotal}` : "",
    `苦手: ${stats.weak ? "ON" : "OFF"}`,
    `最終: ${last}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // PWA registration failure should not block local study.
    });
  });
}
