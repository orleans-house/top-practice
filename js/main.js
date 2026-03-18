// ========================================
// TOP ギミック練習ツール
// ========================================

const ROLES = ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"];
const SYMBOLS = ["○", "×", "△", "□"];
const GLITCH_TYPES = ["mid", "far"];

const LEFT_GROUP = ["H1", "MT", "D1", "D3"];
const RIGHT_GROUP = ["H2", "ST", "D2", "D4"];

// 列ペア（左右の対応）
const ROW_PAIRS = [
  ["H1", "H2"],
  ["MT", "ST"],
  ["D1", "D2"],
  ["D3", "D4"],
];

// ミドル時のシンボル→位置順序（上から: 0=top, 3=bottom）
const MID_ORDER = { "○": 0, "×": 1, "△": 2, "□": 3 };

// ファー時のシンボル→位置順序
const FAR_ORDER_LEFT = { "○": 0, "×": 1, "△": 2, "□": 3 };
const FAR_ORDER_RIGHT = { "○": 3, "×": 2, "△": 1, "□": 0 };

// 頭割り: 基準北固定
// 左組 → 西(W)、右組 → ミドル:南(S) / ファー:東(E)
const STACK_POSITIONS = {
  left: "W",
  right_mid: "S",
  right_far: "E",
};

// P3 検知式波動砲
const P3_PRIORITY = ["MT", "ST", "D1", "D2", "D3", "D4", "H1", "H2"];

// ボスモニター方向が東の場合の各ロールのポジション座標
// safe side = 西（ボスモニターの反対側）
const P3_POSITIONS_MONITOR_EAST = {
  "無職①": { x: 200, y: 60,  label: "無職①" },
  "検知①": { x: 130, y: 130, label: "検知①" },
  "検知②": { x: 110, y: 250, label: "検知②" },
  "検知③": { x: 80,  y: 280, label: "検知③" },
  "無職②": { x: 250, y: 270, label: "無職②" },
  "無職③": { x: 320, y: 270, label: "無職③" },
  "無職④": { x: 210, y: 350, label: "無職④" },
  "無職⑤": { x: 200, y: 380, label: "無職⑤" },
};

// 検知/無職の当たり判定マッピング（誰のモニターが誰に当たるか）
const P3_HIT_ASSIGNMENTS = {
  "boss":  ["無職②", "無職③"],
  "検知①": ["検知②", "検知③"],
  "検知②": ["無職①", "検知①"],
  "検知③": ["無職④", "無職⑤"],
};

// ========================================
// State
// ========================================
let state = {
  screen: "menu",
  mechanic: null,
  playerRole: null,
  correct: 0,
  total: 0,
  scenario: null,
  answered: false,
  phase: "playstation", // "playstation" or "stack"
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
// Position geometry
// ========================================

// プレステ散開用（8ポジション: 左4 + 右4）
function calcPlaystationPositions() {
  const cx = 200;
  const cy = 200;
  const xSpread = 70;
  const yGap = 70;
  const yStart = cy - yGap * 1.5;

  const positions = [];

  for (let i = 0; i < 4; i++) {
    const y = yStart + yGap * i;
    positions.push({
      id: `L${i}`,
      side: "left",
      index: i,
      x: cx - xSpread,
      y: y,
    });
    positions.push({
      id: `R${i}`,
      side: "right",
      index: i,
      x: cx + xSpread,
      y: y,
    });
  }

  return positions;
}

// 頭割り用（3ポジション: W, S, E — 基準点が北）
function calcStackPositions() {
  const cx = 200;
  const cy = 200;
  const r = 120;
  return [
    { id: "W", label: "西", x: cx - r, y: cy },
    { id: "S", label: "南", x: cx, y: cy + r },
    { id: "E", label: "東", x: cx + r, y: cy },
  ];
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

// プレステ調整: 同じ記号が片側に被った場合
function resolveAdjustedSides(party) {
  const sides = {};
  ROLES.forEach((role) => {
    sides[role] = LEFT_GROUP.includes(role) ? "left" : "right";
  });

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
        const idx0 = group.indexOf(members[0]);
        const idx1 = group.indexOf(members[1]);
        const southRole = idx0 > idx1 ? members[0] : members[1];
        sides[southRole] = side === "left" ? "right" : "left";
      }
    }
  }

  return sides;
}

// 頭割り調整: プレステ調整済みの側と行位置をベースに、
// 2人の頭割りが同じ側に被った場合、
// 南側のマーカー持ちと、対面の同じプレステ記号の人が入れ替わる
function resolveStackSides(stackMarkers, psAdjustedSides, psRowPositions, party) {
  const sides = { ...psAdjustedSides };

  const s0 = sides[stackMarkers[0]];
  const s1 = sides[stackMarkers[1]];

  if (s0 === s1) {
    // 同じ側に被った → PS後の行位置で南側を特定
    const row0 = psRowPositions[stackMarkers[0]];
    const row1 = psRowPositions[stackMarkers[1]];
    const southMarker = row0 > row1 ? stackMarkers[0] : stackMarkers[1];

    // 南側マーカー持ちと同じプレステ記号を持つ対面の人を探す
    const southSymbol = party[southMarker];
    const partner = ROLES.find(
      (r) => r !== southMarker && party[r] === southSymbol
    );

    // 入れ替え
    sides[southMarker] = sides[southMarker] === "left" ? "right" : "left";
    sides[partner] = sides[partner] === "left" ? "right" : "left";
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

  // --- プレステフェーズ ---
  const adjustedSides = resolveAdjustedSides(party);

  const playerSymbol = party[playerRole];
  const psSide = adjustedSides[playerRole];
  const { posIndex, posId: correctId } = calcRolePosition(
    playerRole,
    playerSymbol,
    psSide,
    glitch
  );

  const originalSide = LEFT_GROUP.includes(playerRole) ? "left" : "right";
  const wasAdjusted = psSide !== originalSide;

  // 全員のポジション算出 + 行位置を記録
  const allAssignments = {};
  const psRowPositions = {};
  ROLES.forEach((role) => {
    const s = adjustedSides[role];
    const { posIndex: rowIdx, posId } = calcRolePosition(
      role, party[role], s, glitch
    );
    if (!allAssignments[posId]) allAssignments[posId] = [];
    allAssignments[posId].push(role);
    psRowPositions[role] = rowIdx;
  });

  // PS後の左右グループを行位置順にソート
  const psLeftGroup = ROLES.filter((r) => adjustedSides[r] === "left")
    .sort((a, b) => psRowPositions[a] - psRowPositions[b]);
  const psRightGroup = ROLES.filter((r) => adjustedSides[r] === "right")
    .sort((a, b) => psRowPositions[a] - psRowPositions[b]);

  // --- 頭割りフェーズ ---
  const shuffledRoles = shuffle([...ROLES]);
  const stackMarkers = [shuffledRoles[0], shuffledRoles[1]];

  const stackSides = resolveStackSides(
    stackMarkers, adjustedSides, psRowPositions, party
  );
  const stackPlayerSide = stackSides[playerRole];

  // 正解の頭割りポジション
  let stackCorrectId;
  if (stackPlayerSide === "left") {
    stackCorrectId = "W";
  } else {
    stackCorrectId = glitch === "mid" ? "S" : "E";
  }

  // 頭割りで追加の入れ替えが発生したか（プレステ調整後と比較）
  const stackWasAdjusted = stackPlayerSide !== adjustedSides[playerRole];

  return {
    playerRole,
    glitch,
    party,
    playerSymbol,
    // プレステ
    psSide,
    posIndex,
    correctId,
    allAssignments,
    adjustedSides,
    wasAdjusted,
    psRowPositions,
    psLeftGroup,
    psRightGroup,
    // 頭割り
    stackMarkers,
    stackSides,
    stackPlayerSide,
    stackCorrectId,
    stackWasAdjusted,
  };
}

// ========================================
// P3 Scenario generation
// ========================================

function calcP3Positions(monitorDir) {
  const result = {};
  for (const [key, pos] of Object.entries(P3_POSITIONS_MONITOR_EAST)) {
    if (monitorDir === "east") {
      result[key] = { x: pos.x, y: pos.y, label: pos.label };
    } else {
      result[key] = { x: 400 - pos.x, y: pos.y, label: pos.label };
    }
  }
  return result;
}

function generateP3Scenario() {
  const playerRole = state.playerRole;
  const shuffled = shuffle(ROLES);
  const monitorRoles = shuffled.slice(0, 3);
  const noMonitorRoles = shuffled.slice(3);

  // Sort by P3_PRIORITY order
  monitorRoles.sort((a, b) => P3_PRIORITY.indexOf(a) - P3_PRIORITY.indexOf(b));
  noMonitorRoles.sort((a, b) => P3_PRIORITY.indexOf(a) - P3_PRIORITY.indexOf(b));

  // Random boss monitor direction
  const monitorDir = Math.random() < 0.5 ? "east" : "west";

  // Build assignments map (role -> label)
  const assignments = {};
  monitorRoles.forEach((role, i) => {
    assignments[role] = `検知${["①", "②", "③"][i]}`;
  });
  noMonitorRoles.forEach((role, i) => {
    assignments[role] = `無職${["①", "②", "③", "④", "⑤"][i]}`;
  });

  // Build reverse map (label -> [role])
  const allAssignments = {};
  for (const [role, label] of Object.entries(assignments)) {
    if (!allAssignments[label]) allAssignments[label] = [];
    allAssignments[label].push(role);
  }

  // Calculate positions
  const positions = calcP3Positions(monitorDir);

  // Player's correct position
  const playerLabel = assignments[playerRole];
  const correctPosId = playerLabel;

  return {
    playerRole,
    monitorDir,
    monitorPlayers: monitorRoles,
    noMonitorPlayers: noMonitorRoles,
    assignments,
    playerLabel,
    positions,
    correctPosId,
    allAssignments,
  };
}

// ========================================
// Rendering
// ========================================

// パーティリストを動的に構築
// useAdjusted: true → PS調整後の並び順で表示
function renderPartyList(scenario, { useAdjusted = false, highlightStack = false } = {}) {
  const { party, playerRole, stackMarkers, psLeftGroup, psRightGroup } = scenario;

  const leftGroup = useAdjusted ? psLeftGroup : LEFT_GROUP;
  const rightGroup = useAdjusted ? psRightGroup : RIGHT_GROUP;

  const leftContainer = $(".party-group:first-child");
  const rightContainer = $(".party-group:last-child");

  function buildMembers(container, group) {
    // グループタイトルは残す、メンバーを再構築
    const title = container.querySelector(".group-title");
    container.innerHTML = "";
    container.appendChild(title);

    group.forEach((role) => {
      const div = document.createElement("div");
      div.className = "party-member";
      div.dataset.role = role;
      if (role === playerRole) div.classList.add("is-you");
      if (highlightStack && stackMarkers.includes(role)) {
        div.classList.add("has-stack");
      }

      const roleSpan = document.createElement("span");
      roleSpan.className = "member-role";
      roleSpan.textContent = role;

      const symSpan = document.createElement("span");
      symSpan.className = "member-symbol";
      symSpan.dataset.symbol = party[role];
      symSpan.appendChild(createSymbolSVG(party[role], 22));

      div.appendChild(roleSpan);
      div.appendChild(symSpan);
      container.appendChild(div);
    });
  }

  buildMembers(leftContainer, leftGroup);
  buildMembers(rightContainer, rightGroup);
}

function renderP3PartyList(scenario) {
  const { assignments, playerRole, monitorPlayers } = scenario;
  const partyList = $("#party-list");

  const container = document.createElement("div");
  container.className = "p3-party-list";

  P3_PRIORITY.forEach((role) => {
    const div = document.createElement("div");
    div.className = "p3-party-member";
    if (role === playerRole) div.classList.add("is-you");
    if (monitorPlayers.includes(role)) div.classList.add("has-monitor");

    const roleSpan = document.createElement("span");
    roleSpan.className = "member-role";
    roleSpan.textContent = role;

    const assignSpan = document.createElement("span");
    assignSpan.className = "member-assignment";
    assignSpan.textContent = assignments[role];

    div.appendChild(roleSpan);
    div.appendChild(assignSpan);
    container.appendChild(div);
  });

  partyList.innerHTML = "";
  partyList.appendChild(container);
}

function ensureP2PartyListStructure() {
  const partyList = $("#party-list");
  if (!partyList.querySelector(".party-row")) {
    partyList.innerHTML = `
      <div class="party-row">
        <div class="party-group">
          <div class="group-title">左組</div>
        </div>
        <div class="party-group">
          <div class="group-title">右組</div>
        </div>
      </div>
    `;
  }
}

function renderPlaystationPhase(scenario) {
  ensureP2PartyListStructure();

  // Info cards
  $("#info-role .info-value").textContent = scenario.playerRole;
  const glitchCard = $("#info-glitch");
  glitchCard.querySelector(".info-label").textContent = "プログラム";
  glitchCard.querySelector(".info-value").textContent =
    scenario.glitch === "mid" ? "ミドル（近）" : "ファー（遠）";
  glitchCard.className = `info-card ${scenario.glitch}`;

  // Phase label
  $("#phase-label").textContent = "プレステ散開";

  // Party list（元の並び順、頭割りマーカーなし）
  renderPartyList(scenario);

  // OmegaM（北固定）
  $("#omega-m-marker").setAttribute("transform", "translate(200,40)");
  $("#omega-m-marker").style.display = "";
  $("#omega-f-marker").style.display = "";
  // Hide P3 elements
  $("#p3-boss-marker").style.display = "none";
  $("#p3-monitor-indicator").style.display = "none";

  // Position markers
  const positions = calcPlaystationPositions();
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

  $("#feedback").classList.add("hidden");
  state.answered = false;
  state.phase = "playstation";

  startTimer();
}

function renderStackPhase(scenario) {
  // Phase label
  $("#phase-label").textContent = "頭割り";

  // Party list（PS調整後の並び順 + 頭割りマーカー表示）
  renderPartyList(scenario, { useAdjusted: true, highlightStack: true });

  // ボスを非表示にして基準点を表示
  $("#omega-m-marker").style.display = "none";
  $("#omega-f-marker").style.display = "none";

  // Position markers（W, S, E の3択）
  const positions = calcStackPositions();
  const posGroup = $("#positions");
  posGroup.innerHTML = "";

  // 基準点を北に表示
  const refMarker = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  refMarker.innerHTML = `
    <circle cx="200" cy="60" r="14" fill="rgba(200,181,96,0.2)" stroke="var(--accent-gold)" stroke-width="2"/>
    <text x="200" y="60" text-anchor="middle" dominant-baseline="central" fill="var(--accent-gold)" font-size="11" font-weight="bold">基準</text>
  `;
  posGroup.appendChild(refMarker);

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
    circle.style.r = "28px";

    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    label.classList.add("pos-label");
    label.setAttribute("x", pos.x);
    label.setAttribute("y", pos.y);
    label.textContent = pos.label;
    label.style.fontSize = "14px";

    g.appendChild(circle);
    g.appendChild(label);

    g.addEventListener("click", () => handleStackAnswer(pos.id));
    posGroup.appendChild(g);
  });

  $("#feedback").classList.add("hidden");
  state.answered = false;
  state.phase = "stack";

  startTimer();
}

function renderP3Phase(scenario) {
  // Info cards
  $("#info-role .info-value").textContent = scenario.playerRole;
  const glitchCard = $("#info-glitch");
  glitchCard.querySelector(".info-label").textContent = "役割";
  glitchCard.querySelector(".info-value").textContent = scenario.playerLabel;
  const isMonitor = scenario.monitorPlayers.includes(scenario.playerRole);
  glitchCard.className = isMonitor ? "info-card p3-monitor" : "info-card p3-nomonitor";

  // Phase label
  $("#phase-label").textContent = "検知式波動砲";

  // Party list
  renderP3PartyList(scenario);

  // Hide P2 bosses, show P3 boss
  $("#omega-m-marker").style.display = "none";
  $("#omega-f-marker").style.display = "none";
  $("#p3-boss-marker").style.display = "";

  // Monitor direction indicator
  const indicator = $("#p3-monitor-indicator");
  indicator.style.display = "";
  indicator.innerHTML = "";

  const ns = "http://www.w3.org/2000/svg";
  const rect = document.createElementNS(ns, "rect");
  rect.classList.add("p3-monitor-dir");
  const text = document.createElementNS(ns, "text");
  text.classList.add("p3-monitor-text");
  text.textContent = "モニター";

  if (scenario.monitorDir === "east") {
    rect.setAttribute("x", "310");
    rect.setAttribute("y", "185");
    rect.setAttribute("width", "60");
    rect.setAttribute("height", "30");
    rect.setAttribute("rx", "4");
    text.setAttribute("x", "340");
    text.setAttribute("y", "200");
  } else {
    rect.setAttribute("x", "30");
    rect.setAttribute("y", "185");
    rect.setAttribute("width", "60");
    rect.setAttribute("height", "30");
    rect.setAttribute("rx", "4");
    text.setAttribute("x", "60");
    text.setAttribute("y", "200");
  }

  indicator.appendChild(rect);
  indicator.appendChild(text);

  // Position markers
  const posGroup = $("#positions");
  posGroup.innerHTML = "";

  for (const [label, pos] of Object.entries(scenario.positions)) {
    const g = document.createElementNS(ns, "g");
    g.classList.add("position-marker");
    g.dataset.posId = label;

    const circle = document.createElementNS(ns, "circle");
    circle.classList.add("pos-circle");
    circle.setAttribute("cx", pos.x);
    circle.setAttribute("cy", pos.y);

    const posLabel = document.createElementNS(ns, "text");
    posLabel.classList.add("pos-label");
    posLabel.setAttribute("x", pos.x);
    posLabel.setAttribute("y", pos.y);
    posLabel.textContent = label;
    posLabel.style.fontSize = "10px";

    const roleLabel = document.createElementNS(ns, "text");
    roleLabel.classList.add("pos-role-label");
    roleLabel.setAttribute("x", pos.x);
    roleLabel.setAttribute("y", pos.y + 30);
    const assigned = scenario.allAssignments[label];
    roleLabel.textContent = assigned ? assigned.join("/") : "";

    g.appendChild(circle);
    g.appendChild(posLabel);
    g.appendChild(roleLabel);

    g.addEventListener("click", () => handleP3Answer(label));
    posGroup.appendChild(g);
  }

  $("#feedback").classList.add("hidden");
  state.answered = false;
  state.phase = "wave-cannon";

  startTimer();
}

function renderScore() {
  $("#score-correct").textContent = state.correct;
  $("#score-total").textContent = state.total;
}

// ========================================
// Timer
// ========================================
const TIME_LIMIT = 3000;

function startTimer() {
  stopTimer();

  const bar = $("#timer-bar");
  bar.classList.remove("urgent", "stopped");
  bar.style.width = "100%";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${TIME_LIMIT}ms linear`;
      bar.style.width = "0%";
    });
  });

  state.urgentTimer = setTimeout(() => {
    bar.classList.add("urgent");
  }, TIME_LIMIT - 1000);

  state.timer = setTimeout(() => {
    if (!state.answered) {
      if (state.mechanic === "wave-cannon") {
        handleP3Timeout();
      } else if (state.phase === "playstation") {
        handleTimeout();
      } else {
        handleStackTimeout();
      }
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
// Answer handling — プレステ
// ========================================
function revealPositions(selectedId, correctId) {
  $$(".position-marker").forEach((g) => {
    g.classList.add("disabled", "reveal");
    const id = g.dataset.posId;
    if (id === selectedId && id === correctId) {
      g.classList.add("correct");
    } else if (id === selectedId && id !== correctId) {
      g.classList.add("incorrect");
    }
    if (id === correctId && id !== selectedId) {
      g.classList.add("answer");
    }
  });
}

function showPlaystationFeedback(scenario, isCorrect, isTimeout) {
  const sideName = scenario.psSide === "left" ? "左" : "右";
  const glitchName =
    scenario.glitch === "mid" ? "ミドル（近）" : "ファー（遠）";
  const adjustNote = scenario.wasAdjusted
    ? `<br><span style="color:var(--symbol-color)">※ 記号被りのため反対側へ調整</span>`
    : "";

  const result = $("#feedback-result");
  if (isTimeout) {
    result.textContent = "時間切れ…";
    result.className = "timeout";
  } else {
    result.textContent = isCorrect ? "正解！" : "不正解…";
    result.className = isCorrect ? "correct" : "incorrect";
  }

  $("#feedback-explanation").innerHTML = `
    <strong>${scenario.playerRole}</strong> → <strong>${sideName}</strong>側 / ${scenario.playerSymbol}${adjustNote}<br>
    ${glitchName} → 上から ${scenario.posIndex + 1}番目<br>
    <span style="color:var(--text-secondary);font-size:0.8rem">
      ${scenario.glitch === "far" && scenario.psSide === "right" ? "ファー右は □△×○ の順（調整）" : "並び: ○×△□"}
    </span>
  `;

  $("#next-btn").textContent = "頭割りへ →";
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
  revealPositions(selectedId, scenario.correctId);
  showPlaystationFeedback(scenario, isCorrect, false);
}

function handleTimeout() {
  state.answered = true;
  state.total++;
  stopTimer();

  renderScore();
  revealPositions(null, state.scenario.correctId);
  showPlaystationFeedback(state.scenario, false, true);
}

// ========================================
// Answer handling — 頭割り
// ========================================
function showStackFeedback(scenario, isCorrect, isTimeout) {
  const sideName = scenario.stackPlayerSide === "left" ? "左組" : "右組";
  const dirName = { W: "西", S: "南", E: "東" }[scenario.stackCorrectId];
  const glitchName =
    scenario.glitch === "mid" ? "ミドル→南" : "ファー→東";
  const adjustNote = scenario.stackWasAdjusted
    ? `<br><span style="color:var(--symbol-color)">※ 頭割り被りのため反対側へ調整</span>`
    : "";

  const markerNames = scenario.stackMarkers.join(", ");

  const result = $("#feedback-result");
  if (isTimeout) {
    result.textContent = "時間切れ…";
    result.className = "timeout";
  } else {
    result.textContent = isCorrect ? "正解！" : "不正解…";
    result.className = isCorrect ? "correct" : "incorrect";
  }

  $("#feedback-explanation").innerHTML = `
    頭割り: ${markerNames}${adjustNote}<br>
    <strong>${scenario.playerRole}</strong> → <strong>${sideName}</strong> → <strong>${dirName}</strong><br>
    <span style="color:var(--text-secondary);font-size:0.8rem">
      左組=西 / 右組=${glitchName}
    </span>
  `;

  $("#next-btn").textContent = "次の問題";
  $("#feedback").classList.remove("hidden");
}

function handleStackAnswer(selectedId) {
  if (state.answered) return;
  state.answered = true;
  state.total++;
  stopTimer();

  const scenario = state.scenario;
  const isCorrect = selectedId === scenario.stackCorrectId;
  if (isCorrect) state.correct++;

  renderScore();
  revealPositions(selectedId, scenario.stackCorrectId);
  showStackFeedback(scenario, isCorrect, false);
}

function handleStackTimeout() {
  state.answered = true;
  state.total++;
  stopTimer();

  renderScore();
  revealPositions(null, state.scenario.stackCorrectId);
  showStackFeedback(state.scenario, false, true);
}

// ========================================
// Answer handling — P3 検知式波動砲
// ========================================
function showP3Feedback(scenario, isCorrect, isTimeout) {
  const dirLabel = scenario.monitorDir === "east" ? "東" : "西";
  const safeLabel = scenario.monitorDir === "east" ? "西" : "東";

  const result = $("#feedback-result");
  if (isTimeout) {
    result.textContent = "時間切れ…";
    result.className = "timeout";
  } else {
    result.textContent = isCorrect ? "正解！" : "不正解…";
    result.className = isCorrect ? "correct" : "incorrect";
  }

  // Build hit explanation for the player
  let hitInfo = "";
  const playerLabel = scenario.playerLabel;
  if (playerLabel.startsWith("検知")) {
    // Player has a monitor - show who they hit
    const targets = P3_HIT_ASSIGNMENTS[playerLabel];
    if (targets) {
      hitInfo = `${playerLabel}のモニター → ${targets.join("、")} に当てる`;
    }
  } else {
    // Player is nomonitor - find which hit they're part of
    for (const [source, targets] of Object.entries(P3_HIT_ASSIGNMENTS)) {
      if (targets.includes(playerLabel)) {
        const sourceName = source === "boss" ? "ボスモニター" : `${source}のモニター`;
        hitInfo = `${sourceName} → ${targets.join("、")} が受ける`;
        break;
      }
    }
  }

  $("#feedback-explanation").innerHTML = `
    ボスモニター: <strong>${dirLabel}</strong> / 安地: <strong>${safeLabel}</strong><br>
    <strong>${scenario.playerRole}</strong> → <strong>${playerLabel}</strong><br>
    <span style="color:var(--text-secondary);font-size:0.8rem">
      ${hitInfo}
    </span>
  `;

  $("#next-btn").textContent = "次の問題";
  $("#feedback").classList.remove("hidden");
}

function handleP3Answer(selectedId) {
  if (state.answered) return;
  state.answered = true;
  state.total++;
  stopTimer();

  const scenario = state.scenario;
  const isCorrect = selectedId === scenario.correctPosId;
  if (isCorrect) state.correct++;

  renderScore();
  revealPositions(selectedId, scenario.correctPosId);
  showP3Feedback(scenario, isCorrect, false);
}

function handleP3Timeout() {
  state.answered = true;
  state.total++;
  stopTimer();

  renderScore();
  revealPositions(null, state.scenario.correctPosId);
  showP3Feedback(state.scenario, false, true);
}

// ========================================
// Event listeners
// ========================================
function init() {
  $$(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".role-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.playerRole = btn.dataset.role;
      $$(".mechanic-btn").forEach((b) => (b.disabled = false));
    });
  });

  $$(".mechanic-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.playerRole) return;
      state.mechanic = btn.dataset.mechanic;
      showScreen("quiz");
      startNewQuestion();
    });
  });

  $("#back-btn").addEventListener("click", () => {
    stopTimer();
    showScreen("menu");
  });

  $("#next-btn").addEventListener("click", () => {
    if (state.mechanic === "wave-cannon") {
      startNewQuestion();
    } else if (state.phase === "playstation") {
      renderStackPhase(state.scenario);
    } else {
      startNewQuestion();
    }
  });

  $("#reset-score-btn").addEventListener("click", () => {
    state.correct = 0;
    state.total = 0;
    renderScore();
  });

  document.addEventListener("keydown", (e) => {
    if (state.screen === "quiz" && state.answered && e.key === "Enter") {
      if (state.mechanic === "wave-cannon") {
        startNewQuestion();
      } else if (state.phase === "playstation") {
        renderStackPhase(state.scenario);
      } else {
        startNewQuestion();
      }
    }
  });
}

function startNewQuestion() {
  if (state.mechanic === "wave-cannon") {
    state.scenario = generateP3Scenario();
    renderP3Phase(state.scenario);
  } else {
    state.scenario = generateScenario();
    renderPlaystationPhase(state.scenario);
  }
}

init();
