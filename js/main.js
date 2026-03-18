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
    el.querySelector(".member-symbol").textContent = party[role];
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

  $("#info-symbol .info-value").textContent = scenario.playerSymbol;

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
}

function renderScore() {
  $("#score-correct").textContent = state.correct;
  $("#score-total").textContent = state.total;
}

// ========================================
// Answer handling
// ========================================
function handleAnswer(selectedId) {
  if (state.answered) return;
  state.answered = true;
  state.total++;

  const scenario = state.scenario;
  const isCorrect = selectedId === scenario.correctId;
  if (isCorrect) state.correct++;

  renderScore();

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

  const feedback = $("#feedback");
  feedback.classList.remove("hidden");

  const result = $("#feedback-result");
  result.textContent = isCorrect ? "正解！" : "不正解…";
  result.className = isCorrect ? "correct" : "incorrect";

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

  $("#back-btn").addEventListener("click", () => showScreen("menu"));
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
