const STORAGE_KEY = "recovery_os_state_v1";

const dom = {
  levelValue: document.getElementById("levelValue"),
  xpFill: document.getElementById("xpFill"),
  xpCurrent: document.getElementById("xpCurrent"),
  xpNext: document.getElementById("xpNext"),
  questList: document.getElementById("questList"),
  missionCard: document.getElementById("missionCard"),
  intelList: document.getElementById("intelList"),
  navButtons: Array.from(document.querySelectorAll(".nav-btn")),
  tabs: {
    quests: document.getElementById("tab-quests"),
    training: document.getElementById("tab-training"),
    intel: document.getElementById("tab-intel")
  }
};

const defaultState = {
  xp: 0,
  level: 1,
  completedQuests: {},
  completedMissions: {},
  lastLoginDate: null
};

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch (error) {
    return { ...defaultState };
  }
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const ensureTodayState = (state) => {
  const today = getTodayKey();
  if (state.lastLoginDate !== today) {
    state.completedQuests = { [today]: {} };
    state.completedMissions = { [today]: {} };
    state.lastLoginDate = today;
  }
  if (!state.completedQuests[today]) state.completedQuests[today] = {};
  if (!state.completedMissions[today]) state.completedMissions[today] = {};
};

const computeLevel = (xp) => Math.floor(xp / APP_CONFIG.xpPerLevel) + 1;

const getLevelProgress = (xp) => {
  const progress = xp % APP_CONFIG.xpPerLevel;
  return {
    progress,
    next: APP_CONFIG.xpPerLevel
  };
};

const updateHeader = (state) => {
  const { progress, next } = getLevelProgress(state.xp);
  const level = computeLevel(state.xp);
  state.level = level;

  dom.levelValue.textContent = String(level);
  dom.xpCurrent.textContent = String(progress);
  dom.xpNext.textContent = String(next);
  dom.xpFill.style.width = `${(progress / next) * 100}%`;
};

const buildMetaText = (parts) => parts.filter(Boolean).join(" • ");

const renderQuests = (state) => {
  const today = getTodayKey();
  const completed = state.completedQuests[today] || {};
  dom.questList.innerHTML = "";

  QUESTS.forEach((quest) => {
    const isDone = Boolean(completed[quest.id]);

    const card = document.createElement("div");
    card.className = `quest-card${isDone ? " completed" : ""}`;

    const row = document.createElement("div");
    row.className = "quest-row";

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "quest-title";
    title.textContent = quest.title;

    const meta = document.createElement("div");
    meta.className = "quest-meta";
    meta.textContent = buildMetaText([
      quest.time,
      quest.note,
      `+${quest.xp ?? APP_CONFIG.questXpDefault} XP`
    ]);

    info.appendChild(title);
    info.appendChild(meta);

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = quest.category;

    row.appendChild(info);
    row.appendChild(tag);

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = isDone ? "Выполнено" : "Выполнить";
    btn.disabled = isDone;
    btn.dataset.questId = quest.id;

    card.appendChild(row);
    card.appendChild(btn);
    dom.questList.appendChild(card);
  });
};

const renderMission = (state) => {
  const today = getTodayKey();
  const dayIndex = new Date().getDay();
  const mission = TRAINING_SCHEDULE[dayIndex];
  const completed = state.completedMissions[today] || {};
  const isDone = Boolean(completed[dayIndex]);

  dom.missionCard.innerHTML = "";

  if (!mission) {
    const empty = document.createElement("div");
    empty.textContent = "Нет миссии на сегодня";
    dom.missionCard.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className = "mission-header";

  const title = document.createElement("div");
  title.className = "mission-title";
  title.textContent = mission.title;

  const dayTag = document.createElement("div");
  dayTag.className = "tag";
  dayTag.textContent = DAY_NAMES_RU[dayIndex];

  header.appendChild(title);
  header.appendChild(dayTag);

  const meta = document.createElement("div");
  meta.className = "mission-meta";
  meta.textContent = buildMetaText([
    mission.duration ? `Длительность: ${mission.duration}` : null,
    mission.note,
    mission.xp ? `+${mission.xp} XP` : null
  ]);

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = mission.action || "Миссия выполнена";
  btn.disabled = mission.rest || isDone || !mission.xp;
  btn.dataset.missionDay = String(dayIndex);

  if (isDone) {
    btn.textContent = "Миссия выполнена";
  }

  dom.missionCard.appendChild(header);
  dom.missionCard.appendChild(meta);
  dom.missionCard.appendChild(btn);
};

const renderIntel = () => {
  dom.intelList.innerHTML = "";

  INTEL_RULES.forEach((rule) => {
    const card = document.createElement("div");
    card.className = "intel-card";

    const title = document.createElement("h3");
    title.textContent = rule.title;

    const text = document.createElement("p");
    text.textContent = rule.text;

    card.appendChild(title);
    card.appendChild(text);
    dom.intelList.appendChild(card);
  });
};

const grantXp = (state, amount) => {
  state.xp += amount;
  state.level = computeLevel(state.xp);
};

const completeQuest = (state, questId) => {
  const quest = QUESTS.find((item) => item.id === questId);
  if (!quest) return;

  const today = getTodayKey();
  if (state.completedQuests[today][questId]) return;
  state.completedQuests[today][questId] = true;
  grantXp(state, quest.xp ?? APP_CONFIG.questXpDefault);
  saveState(state);
  updateHeader(state);
  renderQuests(state);
};

const completeMission = (state, dayIndex) => {
  const mission = TRAINING_SCHEDULE[dayIndex];
  if (!mission || mission.rest || !mission.xp) return;

  const today = getTodayKey();
  if (state.completedMissions[today][dayIndex]) return;
  state.completedMissions[today][dayIndex] = true;
  grantXp(state, mission.xp || APP_CONFIG.trainingXpBoost);
  saveState(state);
  updateHeader(state);
  renderMission(state);
};

const setActiveTab = (tabName) => {
  Object.keys(dom.tabs).forEach((key) => {
    dom.tabs[key].classList.toggle("active", key === tabName);
  });
  dom.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
};

const setupEvents = (state) => {
  dom.questList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.questId && !target.hasAttribute("disabled")) {
      completeQuest(state, target.dataset.questId);
    }
  });

  dom.missionCard.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.missionDay && !target.hasAttribute("disabled")) {
      completeMission(state, Number(target.dataset.missionDay));
    }
  });

  dom.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
};

const scheduleMidnightReset = (state) => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const delay = next.getTime() - now.getTime();
  window.setTimeout(() => {
    ensureTodayState(state);
    saveState(state);
    updateHeader(state);
    renderQuests(state);
    renderMission(state);
    scheduleMidnightReset(state);
  }, delay);
};

const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }
};

const init = () => {
  const state = loadState();
  ensureTodayState(state);
  updateHeader(state);
  renderQuests(state);
  renderMission(state);
  renderIntel();
  setupEvents(state);
  scheduleMidnightReset(state);
  saveState(state);
  registerServiceWorker();
};

init();

