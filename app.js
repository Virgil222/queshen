const STORAGE_KEY = "queshen-competition-state-v1";
const PLAYER_ADMIN_PASSWORD = "lwj200021";
const colors = ["#bd2f2f", "#14795a", "#d39b36", "#5d332d", "#376c95", "#8f4ba8", "#dd7a28", "#299a91"];
const cloudConfig = normalizeCloudConfig(window.QUESHEN_CONFIG);

const initialState = {
  players: [
    { id: crypto.randomUUID(), name: "东风" },
    { id: crypto.randomUUID(), name: "南风" },
    { id: crypto.randomUUID(), name: "西风" },
    { id: crypto.randomUUID(), name: "北风" },
  ],
  matches: [],
};

const state = structuredClone(initialState);

const elements = {
  playerForm: document.querySelector("#playerForm"),
  playerName: document.querySelector("#playerName"),
  playerList: document.querySelector("#playerList"),
  matchForm: document.querySelector("#matchForm"),
  matchDate: document.querySelector("#matchDate"),
  scoreEntry: document.querySelector("#scoreEntry"),
  balanceTip: document.querySelector("#balanceTip"),
  quickFillButton: document.querySelector("#quickFillButton"),
  openPlayerModal: document.querySelector("#openPlayerModal"),
  openMatchModal: document.querySelector("#openMatchModal"),
  playerModal: document.querySelector("#playerModal"),
  matchModal: document.querySelector("#matchModal"),
  summaryCards: document.querySelector("#summaryCards"),
  leaderboardBody: document.querySelector("#leaderboardBody"),
  topPlayerName: document.querySelector("#topPlayerName"),
  topPlayerMeta: document.querySelector("#topPlayerMeta"),
  lowPlayerName: document.querySelector("#lowPlayerName"),
  lowPlayerMeta: document.querySelector("#lowPlayerMeta"),
  trendChart: document.querySelector("#trendChart"),
  barChart: document.querySelector("#barChart"),
  matchList: document.querySelector("#matchList"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  resetButton: document.querySelector("#resetButton"),
  syncStatus: document.querySelector("#syncStatus"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

elements.matchDate.valueAsDate = new Date();

elements.openPlayerModal.addEventListener("click", () => {
  const password = prompt("请输入玩家管理密码");
  if (password !== PLAYER_ADMIN_PASSWORD) {
    alert("密码错误，无法进入玩家管理。");
    return;
  }
  openModal(elements.playerModal);
});

elements.openMatchModal.addEventListener("click", () => {
  openModal(elements.matchModal);
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModals());
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModals();
});

elements.playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.playerName.value.trim();
  if (!name) return;
  if (state.players.some((player) => player.name === name)) {
    alert("这个昵称已经存在了。");
    return;
  }

  state.players.push({ id: crypto.randomUUID(), name });
  elements.playerName.value = "";
  await persistAndRender();
});

elements.matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const scores = getScoreInputs();
  if (state.players.length < 2) {
    alert("至少需要 2 位玩家。");
    return;
  }
  if (scores.every((score) => score.amount === 0)) {
    alert("请至少录入一个非 0 分数。");
    return;
  }
  if (sum(scores.map((score) => score.amount)) !== 0) {
    alert("本局所有人的输赢合计必须等于 0。");
    return;
  }

  state.matches.unshift({
    id: crypto.randomUUID(),
    date: elements.matchDate.value || new Date().toISOString().slice(0, 10),
    note: "",
    scores,
    createdAt: new Date().toISOString(),
  });

  resetScoreInputs();
  await persistAndRender();
  closeModals();
});

elements.quickFillButton.addEventListener("click", () => {
  const inputs = [...elements.scoreEntry.querySelectorAll("input")];
  if (inputs.length < 2) return;
  const firstValues = inputs.slice(0, -1).map((input) => toNumber(input.value));
  inputs.at(-1).value = -sum(firstValues);
  updateBalanceTip();
});

elements.exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `雀神争霸赛-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

elements.importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    validateImportedState(imported);
    state.players = imported.players;
    state.matches = imported.matches;
    await persistAndRender();
  } catch (error) {
    alert(`导入失败：${error.message}`);
  } finally {
    elements.importInput.value = "";
  }
});

elements.resetButton.addEventListener("click", async () => {
  if (!confirm("确定要清空所有玩家和牌局记录吗？此操作不可撤销。")) return;
  state.players = [];
  state.matches = [];
  await persistAndRender();
});

elements.scoreEntry.addEventListener("input", updateBalanceTip);

initializeApp();

async function initializeApp() {
  setSyncStatus("正在加载数据...");
  Object.assign(state, readLocalState());
  render();

  if (!cloudConfig) {
    setSyncStatus("本地模式");
    return;
  }

  try {
    const cloudState = await loadCloudState();
    if (cloudState) {
      Object.assign(state, cloudState);
      saveLocalState();
    } else {
      await saveCloudState();
    }
    setSyncStatus("云端已同步");
    render();
  } catch (error) {
    console.error(error);
    setSyncStatus("云端连接失败，已使用本地数据", true);
  }
}

function readLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialState);

  try {
    const parsed = JSON.parse(raw);
    validateImportedState(parsed);
    return parsed;
  } catch {
    return structuredClone(initialState);
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function validateImportedState(value) {
  if (!value || !Array.isArray(value.players) || !Array.isArray(value.matches)) {
    throw new Error("数据格式不正确");
  }
}

async function persistAndRender() {
  saveLocalState();
  render();

  if (!cloudConfig) {
    setSyncStatus("本地模式");
    return;
  }

  try {
    setSyncStatus("正在同步...");
    await saveCloudState();
    setSyncStatus("云端已同步");
  } catch (error) {
    console.error(error);
    setSyncStatus("云端同步失败，已保存到本地", true);
  }
}

async function loadCloudState() {
  const response = await fetch(`${cloudConfig.supabaseUrl}/rest/v1/queshen_state?id=eq.${encodeURIComponent(cloudConfig.documentId)}&select=data`, {
    headers: getSupabaseHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getCloudErrorMessage(response, "读取云端数据失败"));
  }

  const rows = await response.json();
  const cloudState = rows[0]?.data;
  if (!cloudState) return null;
  validateImportedState(cloudState);
  return cloudState;
}

async function saveCloudState() {
  const response = await fetch(`${cloudConfig.supabaseUrl}/rest/v1/queshen_state`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: cloudConfig.documentId,
      data: { players: state.players, matches: state.matches },
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(await getCloudErrorMessage(response, "保存云端数据失败"));
  }
}

async function getCloudErrorMessage(response, fallback) {
  const details = await response.text();
  if (details.includes("PGRST205") || details.includes("queshen_state")) {
    return `${fallback}：未找到云端数据表，请先在 Supabase SQL Editor 执行 supabase.sql`;
  }
  return `${fallback}：${response.status}`;
}

function getSupabaseHeaders() {
  return {
    apikey: cloudConfig.supabaseAnonKey,
    Authorization: `Bearer ${cloudConfig.supabaseAnonKey}`,
  };
}

function normalizeCloudConfig(config) {
  const supabaseUrl = config?.supabaseUrl?.trim().replace(/\/$/, "");
  const supabaseAnonKey = config?.supabaseAnonKey?.trim();
  const documentId = config?.documentId?.trim() || "default";
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey, documentId };
}

function setSyncStatus(message, isError = false) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.toggle("error", isError);
}

function openModal(modal) {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModals() {
  [elements.playerModal, elements.matchModal].forEach((modal) => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  });
}

function render() {
  const stats = buildStats();
  renderPlayers();
  renderScoreInputs();
  renderSummary(stats);
  renderLeaderboard(stats);
  renderTopPlayer(stats);
  renderTrendChart(stats);
  renderBarChart(stats);
  renderMatches();
  updateBalanceTip();
}

function renderPlayers() {
  elements.playerList.innerHTML = "";
  if (!state.players.length) {
    elements.playerList.append(emptyState("还没有玩家", "添加常一起打麻将的朋友昵称。"));
    return;
  }

  state.players.forEach((player) => {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.innerHTML = `<strong>${escapeHtml(player.name)}</strong>`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => removePlayer(player.id));
    chip.append(deleteButton);
    elements.playerList.append(chip);
  });
}

async function removePlayer(playerId) {
  const hasMatches = state.matches.some((match) => match.scores.some((score) => score.playerId === playerId));
  if (hasMatches && !confirm("该玩家已有牌局记录，删除后相关历史分数也会移除，继续吗？")) return;
  state.players = state.players.filter((player) => player.id !== playerId);
  state.matches = state.matches
    .map((match) => ({ ...match, scores: match.scores.filter((score) => score.playerId !== playerId) }))
    .filter((match) => match.scores.length > 0);
  await persistAndRender();
}

function renderScoreInputs() {
  const existingValues = Object.fromEntries(
    [...elements.scoreEntry.querySelectorAll("input")].map((input) => [input.dataset.playerId, input.value])
  );
  elements.scoreEntry.innerHTML = "";

  if (!state.players.length) {
    elements.scoreEntry.append(emptyState("暂无玩家", "先添加玩家后再录入分数。"));
    return;
  }

  state.players.forEach((player) => {
    const row = document.createElement("label");
    row.className = "score-row";
    row.innerHTML = `
      <strong>${escapeHtml(player.name)}</strong>
      <input type="number" step="1" value="${existingValues[player.id] ?? 0}" data-player-id="${player.id}" />
    `;
    elements.scoreEntry.append(row);
  });
}

function renderSummary(stats) {
  const totalNet = sum(stats.map((item) => item.total));
  const totalRounds = state.matches.length;
  const totalPlayers = state.players.length;
  const biggestWin = stats.length ? Math.max(...stats.map((item) => item.best)) : 0;
  const cards = [
    ["玩家数", `${totalPlayers} 位`],
    ["牌局数", `${totalRounds} 场`],
    ["累计流水", formatMoney(state.matches.reduce((acc, match) => acc + sum(match.scores.map((score) => Math.abs(score.amount))), 0) / 2)],
    ["最佳单局", formatMoney(biggestWin)],
  ];

  elements.summaryCards.innerHTML = cards
    .map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");

  if (totalNet !== 0) {
    console.warn("历史记录净额不为 0，请检查导入数据。");
  }
}

function renderLeaderboard(stats) {
  elements.leaderboardBody.innerHTML = "";
  if (!stats.length) {
    elements.leaderboardBody.innerHTML = `<tr><td colspan="9">${emptyStateHtml("还没有排行", "录入牌局后自动生成排行榜。")}</td></tr>`;
    return;
  }

  stats.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="rank-badge">${index + 1}</span></td>
      <td>${escapeHtml(item.name)}</td>
      <td class="${amountClass(item.total)}">${formatMoney(item.total)}</td>
      <td>${formatPercent(item.winRate)}</td>
      <td>${item.games}</td>
      <td>${item.champions}</td>
      <td class="${amountClass(item.best)}">${formatMoney(item.best)}</td>
      <td class="${amountClass(item.worst)}">${formatMoney(item.worst)}</td>
      <td class="${amountClass(item.average)}">${formatMoney(item.average)}</td>
    `;
    elements.leaderboardBody.append(row);
  });
}

function renderTopPlayer(stats) {
  const activeStats = stats.filter((item) => item.games > 0);
  const top = activeStats[0];
  const low = [...stats]
    .filter((item) => item.games > 0)
    .sort((a, b) => a.total - b.total || a.winRate - b.winRate || a.champions - b.champions)[0];
  elements.topPlayerName.textContent = top ? top.name : "暂无数据";
  elements.topPlayerMeta.textContent = top
    ? `总输赢 ${formatMoney(top.total)} · 胜率 ${formatPercent(top.winRate)}`
    : "录入一场牌局后生成";
  elements.lowPlayerName.textContent = low ? low.name : "暂无数据";
  elements.lowPlayerMeta.textContent = low
    ? `总输赢 ${formatMoney(low.total)} · 胜率 ${formatPercent(low.winRate)}`
    : "录入一场牌局后生成";
}

function renderTrendChart() {
  const canvas = elements.trendChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!state.matches.length || !state.players.length) {
    drawEmptyCanvas(ctx, width, height, "录入牌局后查看每位玩家的累计走势");
    return;
  }

  const padding = { top: 30, right: 24, bottom: 54, left: 62 };
  const series = buildTrendSeries();
  const allValues = series.flatMap((item) => item.points.map((point) => point.value));
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const range = maxValue - minValue || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  ctx.strokeStyle = "rgba(92, 63, 42, 0.12)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#7a6a5c";
  ctx.font = "13px sans-serif";

  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (plotHeight / 4) * i;
    const value = maxValue - (range / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatMoney(Math.round(value)), 10, y + 4);
  }

  series.forEach((item, index) => {
    ctx.strokeStyle = colors[index % colors.length];
    ctx.lineWidth = 3;
    ctx.beginPath();
    item.points.forEach((point, pointIndex) => {
      const x = padding.left + (plotWidth / Math.max(1, item.points.length - 1)) * pointIndex;
      const y = padding.top + plotHeight - ((point.value - minValue) / range) * plotHeight;
      if (pointIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const lastPoint = item.points.at(-1);
    const labelX = padding.left + plotWidth + 8;
    const labelY = padding.top + plotHeight - ((lastPoint.value - minValue) / range) * plotHeight;
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillText(item.name, Math.min(labelX, width - 58), labelY + 4);
  });

  ctx.fillStyle = "#7a6a5c";
  ctx.fillText("时间从左到右，数值为累计输赢", padding.left, height - 18);
}

function renderBarChart(stats) {
  elements.barChart.innerHTML = "";
  if (!stats.length) {
    elements.barChart.append(emptyState("暂无对比", "录入牌局后展示总输赢分布。"));
    return;
  }

  const maxAbs = Math.max(1, ...stats.map((item) => Math.abs(item.total)));
  stats.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const width = Math.max(4, (Math.abs(item.total) / maxAbs) * 100);
    row.innerHTML = `
      <span class="bar-label">${escapeHtml(item.name)}</span>
      <span class="bar-track"><span class="bar-fill ${item.total < 0 ? "loss" : ""}" style="width:${width}%"></span></span>
      <span class="bar-value ${amountClass(item.total)}">${formatMoney(item.total)}</span>
    `;
    elements.barChart.append(row);
  });
}

function renderMatches() {
  elements.matchList.innerHTML = "";
  if (!state.matches.length) {
    elements.matchList.append(emptyState("暂无牌局记录", "保存牌局后会在这里按时间倒序展示。"));
    return;
  }

  state.matches.forEach((match) => {
    const card = document.createElement("article");
    card.className = "match-card";
    const scores = [...match.scores].sort((a, b) => b.amount - a.amount);
    card.innerHTML = `
      <div class="match-date">
        <strong>${formatDate(match.date)}</strong>
        <span>${escapeHtml(match.note || "普通牌局")}</span>
      </div>
      <div class="match-scores">
        ${scores
          .map((score) => {
            const player = state.players.find((item) => item.id === score.playerId);
            return `<span class="score-pill ${amountClass(score.amount)}">${escapeHtml(player?.name || "已删除")} ${formatMoney(score.amount)}</span>`;
          })
          .join("")}
      </div>
    `;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-match";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", async () => {
      if (!confirm("删除这场牌局记录吗？")) return;
      state.matches = state.matches.filter((item) => item.id !== match.id);
      await persistAndRender();
    });
    card.append(deleteButton);
    elements.matchList.append(card);
  });
}

function buildStats() {
  const statsMap = new Map(
    state.players.map((player) => [
      player.id,
      {
        id: player.id,
        name: player.name,
        total: 0,
        wins: 0,
        games: 0,
        champions: 0,
        best: 0,
        worst: 0,
        average: 0,
        winRate: 0,
      },
    ])
  );

  state.matches.forEach((match) => {
    const maxScore = Math.max(...match.scores.map((score) => score.amount));
    match.scores.forEach((score) => {
      const item = statsMap.get(score.playerId);
      if (!item) return;
      item.total += score.amount;
      item.games += 1;
      item.wins += score.amount > 0 ? 1 : 0;
      item.champions += score.amount === maxScore && maxScore > 0 ? 1 : 0;
      item.best = Math.max(item.best, score.amount);
      item.worst = item.games === 1 ? score.amount : Math.min(item.worst, score.amount);
    });
  });

  return [...statsMap.values()]
    .map((item) => ({
      ...item,
      average: item.games ? item.total / item.games : 0,
      winRate: item.games ? item.wins / item.games : 0,
    }))
    .sort((a, b) => b.total - a.total || b.winRate - a.winRate || b.champions - a.champions);
}

function buildTrendSeries() {
  const orderedMatches = [...state.matches].reverse();
  return state.players.map((player) => {
    let total = 0;
    const points = [{ value: 0 }];
    orderedMatches.forEach((match) => {
      const score = match.scores.find((item) => item.playerId === player.id);
      total += score?.amount || 0;
      points.push({ value: total, date: match.date });
    });
    return { name: player.name, points };
  });
}

function getScoreInputs() {
  return [...elements.scoreEntry.querySelectorAll("input")].map((input) => ({
    playerId: input.dataset.playerId,
    amount: toNumber(input.value),
  }));
}

function resetScoreInputs() {
  elements.scoreEntry.querySelectorAll("input").forEach((input) => {
    input.value = 0;
  });
}

function updateBalanceTip() {
  const total = sum(getScoreInputs().map((score) => score.amount));
  elements.balanceTip.classList.toggle("valid", total === 0);
  elements.balanceTip.classList.toggle("invalid", total !== 0);
  elements.balanceTip.textContent =
    total === 0 ? "结算已平衡，可以保存。" : `当前合计 ${formatMoney(total)}，需要等于 0 才能保存。`;
}

function emptyState(title, description) {
  const node = elements.emptyStateTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("strong").textContent = title;
  node.querySelector("span").textContent = description;
  return node;
}

function emptyStateHtml(title, description) {
  return `<div class="empty-state"><strong>${title}</strong><span>${description}</span></div>`;
}

function drawEmptyCanvas(ctx, width, height, text) {
  ctx.fillStyle = "rgba(92, 63, 42, 0.06)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#7a6a5c";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2);
  ctx.textAlign = "left";
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function amountClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function formatDate(value) {
  if (!value) return "未填写日期";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", weekday: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
