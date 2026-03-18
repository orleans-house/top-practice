// ========================================
// TOP ギミック練習ツール
// ========================================

const ROLES = ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"];
const SYMBOLS = ["○", "×", "△", "□"];
const GLITCH_TYPES = ["mid", "far"];

const LEFT_GROUP = ["H1", "MT", "D1", "D3"];
const RIGHT_GROUP = ["H2", "ST", "D2", "D4"];

// ミドル時のシンボル→位置順序（上から: 0=top, 3=bottom）
const MID_ORDER = { "○": 0, "×": 1, "△": 2, "□": 3 };

// ファー時のシンボル→位置順序
// 左組: ○×△□（ミドルと同じ）
// 右組: □△×○（反転 — 右組が調整）
const FAR_ORDER_LEFT = { "○": 0, "×": 1, "△": 2, "□": 3 };
const FAR_ORDER_RIGHT = { "○": 3, "×": 2, "△": 1, "□": 0 };

// M方角は北固定
const M_DIRECTION = "N";

// ========================================
// State
// ========================================
let state = {
  screen: "menu",
  playerRole: null, // メニューで選択、以後固定
  correct: 0,
  total: 0,
  scenario: null,
  answered: false,
  timer: null,
  urgentTimer: null,
};

// ========================================
// DOM
// ========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ========================================
// Screen transitions
// ========================================
function showScreen(name) {
  $$(".screen").forEach((el) => el.classList.remove("active"));
  $(`#${name}-screen`).classList.add("active");
  state.screen = name;
}

// ========================================
// Utilities
// ========================================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ========================================
// Symbol SVG rendering (統一サイズ)
// ========================================
const SYMBOL_COLORS = {
  "○": "var(--sym-circle)",
  "×": "var(--sym-cross)",
  "△": "var(--sym-triangle)",
  "□": "var(--sym-square)",
};

function createSymbolSVG(symbol, size = 20) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.classList.add("symbol-icon");

  const color = SYMBOL_COLORS[symbol] || "var(--text-primary)";
  let shape;

  switch (symbol) {
    case "○":
      shape = document.createElementNS(ns, "circle");
      shape.setAttribute("cx", "12");
      shape.setAttribute("cy", "12");
      shape.setAttribute("r", "9");
      shape.setAttribute("fill", "none");
      shape.setAttribute("stroke", color);
      shape.setAttribute("stroke-width", "2.5");
      break;
    case "×":
      shape = document.createElementNS(ns, "g");
      const l1 = document.createElementNS(ns, "line");
      l1.setAttribute("x1", "4"); l1.setAttribute("y1", "4");
      l1.setAttribute("x2", "20"); l1.setAttribute("y2", "20");
      l1.setAttribute("stroke", color); l1.setAttribute("stroke-width", "2.5");
      l1.setAttribute("stroke-linecap", "round");
      const l2 = document.createElementNS(ns, "line");
      l2.setAttribute("x1", "20"); l2.setAttribute("y1", "4");
      l2.setAttribute("x2", "4"); l2.setAttribute("y2", "20");
      l2.setAttribute("stroke", color); l2.setAttribute("stroke-width", "2.5");
      l2.setAttribute("stroke-linecap", "round");
      shape.appendChild(l1);
      shape.appendChild(l2);
      break;
    case "△":
      shape = document.createElementNS(ns, "polygon");
      shape.setAttribute("points", "12,2 22,21 2,21");
      shape.setAttribute("fill", "none");
      shape.setAttribute("stroke", color);
      shape.setAttribute("stroke-width", "2.5");
      shape.setAttribute("stroke-linejoin", "round");
      break;
    case "□":
      shape = document.createElementNS(ns, "rect");
      shape.setAttribute("x", "3");
      shape.setAttribute("y", "3");
      shape.setAttribute("width", "18");
      shape.setAttribute("height", "18");
      shape.setAttribute("rx", "1");
      shape.setAttribute("fill", "none");
      shape.setAttribute("stroke", color);
      shape.setAttribute("stroke-width", "2.5");
      break;
  }

  svg.appendChild(shape);
  return svg;
}

// ========================================
// Position geometry (M北固定)
// ========================================

function calcPositions() {
  const cx = 200,
    cy = 200;
  const baseAngle = -90; // 北
  const positions = [];
  const radius = 130;
  const offsets = [30, 58, 86, 114];

  // 左列: Mから反時計回り（西側）
  for (let i = 0; i < 4; i++) {
    const angle = ((baseAngle - offsets[i]) * Math.PI) / 180;
    positions.push({
      id: `L${i}`,
      side: "left",
      index: i,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  // 右列: Mから時計回り（東側）
  for (let i = 0; i < 4; i++) {
    const angle = ((baseAngle + offsets[i]) * Math.PI) / 180;
    positions.push({
      id: `R${i}`,
      side: "right",
      index: i,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  return positions;
}

// ========================================
// Scenario generation
// ========================================

function generatePartySymbols() {
  const symbols = shuffle([...SYMBOLS, ...SYMBOLS]);
  const party = {};
  ROLES.forEach((role, i) => {
    party[role] = symbols[i];
  });
  return party;
}

// 調整処理: 同じ記号が片側に被った場合、南側のプレイヤーが反対側へ移動
// 「被った側の南の人」が反対側へ渡り、4:4を維持する
function resolveAdjustedSides(party) {
  const sides = {};
  ROLES.forEach((role) => {
    sides[role] = LEFT_GROUP.includes(role) ? "left" : "right";
  });

  // 各サイドで記号の重複をチェック
  for (const side of ["left", "right"]) {
    const group = side === "left" ? LEFT_GROUP : RIGHT_GROUP;
    const symbolMembers = {};

    group.forEach((role) => {
      const sym = party[role];
      if (!symbolMembers[sym]) symbolMembers[sym] = [];
      symbolMembers[sym].push(role);
    });

    for (const [, members] of Object.entries(symbolMembers)) {
      if (members.length === 2) {
        // 被り発生: グループ内で南側（indexが大きい方）を特定
        const idx0 = group.indexOf(members[0]);
        const idx1 = group.indexOf(members[1]);
        const southRole = idx0 > idx1 ? members[0] : members[1];
        // 南側を反対側へ移動
        sides[southRole] = side === "left" ? "right" : "left";
      }
    }
  }

  return sides;
}

function calcRolePosition(role, symbol, side, glitch) {
  let posIndex;
  if (glitch === "mid") {
    posIndex = MID_ORDER[symbol];
  } else {
    posIndex =
      side === "left" ? FAR_ORDER_LEFT[symbol] : FAR_ORDER_RIGHT[symbol];
  }
  const posId = `${side === "left" ? "L" : "R"}${posIndex}`;
  return { posIndex, posId };
}

function generateScenario() {
  const playerRole = state.playerRole;
  const glitch = GLITCH_TYPES[Math.floor(Math.random() * 2)];
  const party = generatePartySymbols();

  // 調整後のサイドを算出
  const adjustedSides = resolveAdjustedSides(party);

  const playerSymbol = party[playerRole];
  const side = adjustedSides[playerRole];
  const { posIndex, posId: correctId } = calcRolePosition(
    playerRole,
    playerSymbol,
    side,
    glitch
  );

  // 調整が発生したか
  const originalSide = LEFT_GROUP.includes(playerRole) ? "left" : "right";
  const wasAdjusted = side !== originalSide;

  // 全員のポジション算出（回答後の表示用）
  const allAssignments = {};
  ROLES.forEach((role) => {
    const s = adjustedSides[role];
    const { posId } = calcRolePosition(role, party[role], s, glitch);
    if (!allAssignments[posId]) {
      allAssignments[posId] = [];
    }
    allAssignments[posId].push(role);
  });

  return {
    playerRole,
    glitch,
    party,
    playerSymbol,
    side,
    posIndex,
    correctId,
    allAssignments,
    adjustedSides,
    wasAdjusted,
  };
}

// ========================================
// Rendering
// ========================================

function renderPartyList(scenario) {
  const { party, playerRole } = scenario;

  [...LEFT_GROUP, ...RIGHT_GROUP].forEach((role) => {
    const el = $(`.party-member[data-role="${role}"]`);
    const symEl = el.querySelector(".member-symbol");
    const sym = party[role];
    // テキストをSVGアイコンに置換
    symEl.innerHTML = "";
    symEl.appendChild(createSymbolSVG(sym, 22));
    symEl.dataset.symbol = sym;
    el.classList.toggle("is-you", role === playerRole);
  });
}

function renderScenario(scenario) {
  // Info cards
  $("#info-role .info-value").textContent = scenario.playerRole;

  const glitchCard = $("#info-glitch");
  glitchCard.querySelector(".info-value").textContent =
    scenario.glitch === "mid" ? "ミドル（近）" : "ファー（遠）";
  glitchCard.className = `info-card ${scenario.glitch}`;

  // Party list
  renderPartyList(scenario);

  // OmegaM（北固定）
  const mPos = { x: 200, y: 40 };
  $("#omega-m-marker").setAttribute(
    "transform",
    `translate(${mPos.x},${mPos.y})`
  );

  // Position markers
  const positions = calcPositions();
  const posGroup = $("#positions");
  posGroup.innerHTML = "";

  positions.forEach((pos) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.classList.add("position-marker");
    g.dataset.posId = pos.id;

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.classList.add("pos-circle");
    circle.setAttribute("cx", pos.x);
    circle.setAttribute("cy", pos.y);

    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    label.classList.add("pos-label");
    label.setAttribute("x", pos.x);
    label.setAttribute("y", pos.y);
    label.textContent = `${pos.index + 1}`;

    // ロールラベル（回答後に表示）
    const roleLabel = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    roleLabel.classList.add("pos-role-label");
    roleLabel.setAttribute("x", pos.x);
    roleLabel.setAttribute("y", pos.y + 30);
    const assigned = scenario.allAssignments[pos.id];
    roleLabel.textContent = assigned ? assigned.join("/") : "";

    g.appendChild(circle);
    g.appendChild(label);
    g.appendChild(roleLabel);

    g.addEventListener("click", () => handleAnswer(pos.id));
    posGroup.appendChild(g);
  });

  // Hide feedback
  $("#feedback").classList.add("hidden");
  state.answered = false;

  // タイマー開始
  startTimer();
}

function renderScore() {
  $("#score-correct").textContent = state.correct;
  $("#score-total").textContent = state.total;
}

// ========================================
// Timer
// ========================================
const TIME_LIMIT = 3000; // 3秒

function startTimer() {
  stopTimer();

  const bar = $("#timer-bar");
  bar.classList.remove("urgent", "stopped");
  bar.style.width = "100%";

  // 次フレームでアニメーション開始（CSSトランジション発火用）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${TIME_LIMIT}ms linear`;
      bar.style.width = "0%";
    });
  });

  // 残り1秒で赤くする
  state.urgentTimer = setTimeout(() => {
    bar.classList.add("urgent");
  }, TIME_LIMIT - 1000);

  // タイムアウト
  state.timer = setTimeout(() => {
    if (!state.answered) {
      handleTimeout();
    }
  }, TIME_LIMIT);
}

function stopTimer() {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  if (state.urgentTimer) {
    clearTimeout(state.urgentTimer);
    state.urgentTimer = null;
  }
  const bar = $("#timer-bar");
  bar.classList.add("stopped");
  bar.style.transition = "none";
}

// ========================================
// Answer handling
// ========================================
function revealPositions(selectedId) {
  const scenario = state.scenario;
  const isCorrect = selectedId && selectedId === scenario.correctId;

  $$(".position-marker").forEach((g) => {
    g.classList.add("disabled", "reveal");
    const id = g.dataset.posId;
    if (id === selectedId && isCorrect) {
      g.classList.add("correct");
    } else if (id === selectedId && !isCorrect) {
      g.classList.add("incorrect");
    }
    if (id === scenario.correctId && !isCorrect) {
      g.classList.add("answer");
    }
  });
}

function showFeedback(scenario) {
  const sideName = scenario.side === "left" ? "左" : "右";
  const glitchName =
    scenario.glitch === "mid" ? "ミドル（近）" : "ファー（遠）";
  const adjustNote = scenario.wasAdjusted
    ? `<br><span style="color:var(--symbol-color)">※ 記号被りのため反対側へ調整</span>`
    : "";

  $("#feedback-explanation").innerHTML = `
    <strong>${scenario.playerRole}</strong> → <strong>${sideName}</strong>側 / ${scenario.playerSymbol}${adjustNote}<br>
    ${glitchName} → 上から ${scenario.posIndex + 1}番目<br>
    <span style="color:var(--text-secondary);font-size:0.8rem">
      ${scenario.glitch === "far" && scenario.side === "right" ? "ファー右は □△×○ の順（調整）" : "並び: ○×△□"}
    </span>
  `;

  $("#feedback").classList.remove("hidden");
}

function handleAnswer(selectedId) {
  if (state.answered) return;
  state.answered = true;
  state.total++;
  stopTimer();

  const scenario = state.scenario;
  const isCorrect = selectedId === scenario.correctId;
  if (isCorrect) state.correct++;

  renderScore();
  revealPositions(selectedId);

  const result = $("#feedback-result");
  result.textContent = isCorrect ? "正解！" : "不正解…";
  result.className = isCorrect ? "correct" : "incorrect";

  showFeedback(scenario);
}

function handleTimeout() {
  state.answered = true;
  state.total++;
  stopTimer();

  renderScore();
  revealPositions(null);

  const result = $("#feedback-result");
  result.textContent = "時間切れ…";
  result.className = "timeout";

  showFeedback(state.scenario);
}

// ========================================
// Event listeners
// ========================================
function init() {
  // ロール選択
  $$(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".role-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.playerRole = btn.dataset.role;
      // ギミックボタンを有効化
      $$(".mechanic-btn").forEach((b) => (b.disabled = false));
    });
  });

  // ギミック選択
  $$(".mechanic-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.playerRole) return;
      showScreen("quiz");
      startNewQuestion();
    });
  });

  $("#back-btn").addEventListener("click", () => {
    stopTimer();
    showScreen("menu");
  });
  $("#next-btn").addEventListener("click", startNewQuestion);

  $("#reset-score-btn").addEventListener("click", () => {
    state.correct = 0;
    state.total = 0;
    renderScore();
  });

  document.addEventListener("keydown", (e) => {
    if (state.screen === "quiz" && state.answered && e.key === "Enter") {
      startNewQuestion();
    }
  });
}

function startNewQuestion() {
  state.scenario = generateScenario();
  renderScenario(state.scenario);
}

init();
