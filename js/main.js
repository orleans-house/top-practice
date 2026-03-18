// ========================================
// TOP ギミック練習ツール
// ========================================

const ROLES = ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"];
const SYMBOLS = ["○", "×", "△", "□"];
const GLITCH_TYPES = ["mid", "far"];
const CARDINALS = ["N", "E", "S", "W"];

const LEFT_GROUP = ["H1", "MT", "D1", "D3"];
const RIGHT_GROUP = ["H2", "ST", "D2", "D4"];

// ミドル時のシンボル→位置順序（上から: 0=top, 3=bottom）
const MID_ORDER = { "○": 0, "×": 1, "△": 2, "□": 3 };

// ファー時のシンボル→位置順序
// 左組: ○×△□（ミドルと同じ）
// 右組: □△×○（反転 — 右組が調整）
const FAR_ORDER_LEFT = { "○": 0, "×": 1, "△": 2, "□": 3 };
const FAR_ORDER_RIGHT = { "○": 3, "×": 2, "△": 1, "□": 0 };

// ========================================
// State
// ========================================
let state = {
  screen: "menu",
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
// Position geometry
// ========================================

// 8つのポジションをオメガMの方角に基づいて配置
// オメガMが北のとき:
//   左列(West側) L0~L3: 上から下
//   右列(East側) R0~R3: 上から下
function calcPositions(mDirection) {
  const cx = 200,
    cy = 200;

  // オメガMからの角度オフセット
  const dirAngles = { N: -90, E: 0, S: 90, W: 180 };
  const baseAngle = dirAngles[mDirection];

  // 左列・右列の角度（M基準で左右に展開）
  // Mが北のとき: 左=西側, 右=東側
  // 各列4ポジション、Mに近い方から遠い方へ
  const positions = [];
  const radius = 130;

  // 左列: Mから反時計回り方向に 30°, 55°, 80°, 105° (微調整可)
  const offsets = [30, 58, 86, 114];
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

  // 右列: Mから時計回り方向に 30°, 55°, 80°, 105°
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

// オメガMの位置座標
function calcOmegaMPos(direction) {
  const cx = 200,
    cy = 200,
    r = 160;
  const angles = { N: -90, E: 0, S: 90, W: 180 };
  const a = (angles[direction] * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// ========================================
// Scenario generation
// ========================================
function generateScenario() {
  const role = ROLES[Math.floor(Math.random() * ROLES.length)];
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const glitch = GLITCH_TYPES[Math.floor(Math.random() * 2)];
  const mDir = CARDINALS[Math.floor(Math.random() * CARDINALS.length)];

  // 正解の算出
  const side = LEFT_GROUP.includes(role) ? "left" : "right";
  let posIndex;
  if (glitch === "mid") {
    posIndex = MID_ORDER[symbol];
  } else {
    posIndex =
      side === "left" ? FAR_ORDER_LEFT[symbol] : FAR_ORDER_RIGHT[symbol];
  }

  const correctId = `${side === "left" ? "L" : "R"}${posIndex}`;

  return { role, symbol, glitch, mDir, side, posIndex, correctId };
}

// ========================================
// Rendering
// ========================================
function renderScenario(scenario) {
  // Info cards
  const roleCard = $("#info-role");
  roleCard.querySelector(".info-value").textContent = scenario.role;

  const glitchCard = $("#info-glitch");
  glitchCard.querySelector(".info-value").textContent =
    scenario.glitch === "mid" ? "ミドル（近）" : "ファー（遠）";
  glitchCard.className = `info-card ${scenario.glitch}`;

  const symbolCard = $("#info-symbol");
  symbolCard.querySelector(".info-value").textContent = scenario.symbol;

  // OmegaM position
  const mPos = calcOmegaMPos(scenario.mDir);
  const mMarker = $("#omega-m-marker");
  mMarker.setAttribute("transform", `translate(${mPos.x},${mPos.y})`);

  // Position markers
  const positions = calcPositions(scenario.mDir);
  const posGroup = $("#positions");
  posGroup.innerHTML = "";

  // ラベルデータ: 各ポジションに配置されるロールを算出
  const roleAssignments = calcAllRoleAssignments(scenario);

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

    // ポジション番号ラベル
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
    const assignedRole = roleAssignments[pos.id];
    roleLabel.textContent = assignedRole || "";

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

// 全ロールのポジション割り当てを算出
function calcAllRoleAssignments(scenario) {
  const assignments = {};

  // 実際のシナリオでは他のプレイヤーのデバフはランダムだが、
  // 表示用にはプレイヤーの正解位置だけ示す（他は省略）
  // ここではプレイヤーのロールだけ正解位置にマッピング
  assignments[scenario.correctId] = scenario.role;

  return assignments;
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

  // Mark positions
  $$(".position-marker").forEach((g) => {
    g.classList.add("disabled");
    const id = g.dataset.posId;
    if (id === selectedId && isCorrect) {
      g.classList.add("correct");
    } else if (id === selectedId && !isCorrect) {
      g.classList.add("incorrect");
    }
    if (id === scenario.correctId && !isCorrect) {
      g.classList.add("answer");
    }
    // Reveal role labels
    g.classList.add("reveal");
  });

  // Feedback
  const feedback = $("#feedback");
  feedback.classList.remove("hidden");

  const result = $("#feedback-result");
  result.textContent = isCorrect ? "正解！" : "不正解…";
  result.className = isCorrect ? "correct" : "incorrect";

  const explanation = $("#feedback-explanation");
  const sideName = scenario.side === "left" ? "左組" : "右組";
  const glitchName = scenario.glitch === "mid" ? "ミドル（近）" : "ファー（遠）";
  const symbolPositions =
    scenario.glitch === "mid"
      ? "○×△□"
      : scenario.side === "left"
        ? "○×△□"
        : "□△×○（右組調整）";

  explanation.innerHTML = `
    <strong>${scenario.role}</strong> は <strong>${sideName}</strong><br>
    ${glitchName} / ${scenario.symbol} → 上から ${scenario.posIndex + 1}番目<br>
    <span style="color:var(--text-secondary);font-size:0.8rem">
      ${scenario.glitch === "far" && scenario.side === "right" ? "ファー右組は □△×○ の順（調整）" : `${glitchName}の並び: ○×△□`}
    </span>
  `;
}

// ========================================
// Event listeners
// ========================================
function init() {
  // Mechanic select
  $$(".mechanic-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showScreen("quiz");
      startNewQuestion();
    });
  });

  // Back button
  $("#back-btn").addEventListener("click", () => showScreen("menu"));

  // Next question
  $("#next-btn").addEventListener("click", startNewQuestion);

  // Reset score
  $("#reset-score-btn").addEventListener("click", () => {
    state.correct = 0;
    state.total = 0;
    renderScore();
  });

  // Keyboard shortcut
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
