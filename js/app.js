const STORAGE_KEY = "recovery_os_state_v2";

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
    home: document.getElementById("tab-home"),
    quests: document.getElementById("tab-quests"),
    training: document.getElementById("tab-training"),
    intel: document.getElementById("tab-intel")
  },
  avatar: document.getElementById("avatar"),
  avatarStatus: document.getElementById("avatarStatus"),
  dailyProgressRing: document.getElementById("dailyProgressRing"),
  dailyPercent: document.getElementById("dailyPercent"),
  dailyCount: document.getElementById("dailyCount"),
  dailyMeta: document.getElementById("dailyMeta"),
  resetProgress: document.getElementById("resetProgress"),
  toast: document.getElementById("toast")
};

const getTodayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createDailyEntry = () => ({
  quests: {},
  missionDone: false
});

const getDefaultState = () => ({
  xp: 0,
  createdAt: getTodayKey(),
  lastActiveDate: getTodayKey(),
  daily: {}
});

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultState(),
      ...parsed,
      daily: parsed.daily || {}
    };
  } catch (error) {
    return getDefaultState();
  }
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const ensureTodayState = (state) => {
  const today = getTodayKey();
  if (!state.daily) state.daily = {};
  if (!state.daily[today]) state.daily[today] = createDailyEntry();
  state.lastActiveDate = today;
};

const getDailyState = (state) => {
  const today = getTodayKey();
  if (!state.daily[today]) state.daily[today] = createDailyEntry();
  return state.daily[today];
};

const computeLevel = (xp) => Math.floor(xp / APP_CONFIG.xpPerLevel) + 1;

const getLevelProgress = (xp) => {
  const progress = xp % APP_CONFIG.xpPerLevel;
  return {
    progress,
    next: APP_CONFIG.xpPerLevel
  };
};

const updateXpUI = (state) => {
  const { progress, next } = getLevelProgress(state.xp);
  dom.levelValue.textContent = String(computeLevel(state.xp));
  dom.xpCurrent.textContent = String(progress);
  dom.xpNext.textContent = String(next);
  dom.xpFill.style.width = `${(progress / next) * 100}%`;
};

const getMissionForToday = () => {
  const dayIndex = new Date().getDay();
  return {
    dayIndex,
    mission: TRAINING_SCHEDULE[dayIndex]
  };
};

const getDailyProgress = (state) => {
  const daily = getDailyState(state);
  const questTotal = QUESTS.length;
  const questDone = Object.keys(daily.quests).length;
  const { mission } = getMissionForToday();
  const missionTotal = mission && !mission.rest && mission.xp ? 1 : 0;
  const missionDone = daily.missionDone ? 1 : 0;
  const total = questTotal + missionTotal;
  const done = questDone + missionDone;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, percent, questDone, questTotal, missionTotal, missionDone };
};

const getAvatarStage = (percent) => {
  if (percent >= 75) return 3;
  if (percent >= 50) return 2;
  if (percent >= 25) return 1;
  return 0;
};

const getAvatarStatusText = (stage) => {
  switch (stage) {
    case 1:
      return "Состояние: стабилизация";
    case 2:
      return "Состояние: усиление";
    case 3:
      return "Состояние: заряжен";
    default:
      return "Состояние: старт миссии";
  }
};

const renderHome = (state) => {
  const progress = getDailyProgress(state);
  const stage = getAvatarStage(progress.percent);

  dom.avatar.classList.remove("stage-0", "stage-1", "stage-2", "stage-3");
  dom.avatar.classList.add(`stage-${stage}`);
  dom.avatarStatus.textContent = getAvatarStatusText(stage);

  dom.dailyProgressRing.style.setProperty("--progress", `${progress.percent * 3.6}deg`);
  dom.dailyPercent.textContent = `${progress.percent}%`;
  dom.dailyCount.textContent = `${progress.done}/${progress.total}`;

  if (progress.total === 0) {
    dom.dailyMeta.textContent = "Сегодня нет миссий";
  } else if (progress.percent === 100) {
    dom.dailyMeta.textContent = "Полный зачёт дня";
  } else {
    dom.dailyMeta.textContent = `Квесты: ${progress.questDone}/${progress.questTotal}`;
  }
};

const buildMetaText = (parts) => parts.filter(Boolean).join(" • ");

const renderQuestCard = (quest, isDone) => {
  const card = document.createElement("div");
  card.className = `quest-card${isDone ? " completed" : ""}`;

  const header = document.createElement("div");
  header.className = "quest-header";

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "quest-title";
  title.textContent = quest.title;

  const time = document.createElement("div");
  time.className = "quest-time";
  time.textContent = quest.time;

  const meta = document.createElement("div");
  meta.className = "quest-meta";
  meta.textContent = buildMetaText([
    quest.goal,
    `+${quest.xp ?? APP_CONFIG.questXpDefault} XP`
  ]);

  info.appendChild(title);
  info.appendChild(time);
  info.appendChild(meta);

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.textContent = quest.category;

  header.appendChild(info);
  header.appendChild(tag);

  card.appendChild(header);

  let list = null;
  const ensureList = () => {
    if (!list) {
      list = document.createElement("div");
      list.className = "quest-items";
    }
    return list;
  };

  if (quest.foods) {
    const listEl = ensureList();
    quest.foods.forEach((item) => {
      const row = document.createElement("div");
      row.className = "quest-item";
      row.textContent = item;
      listEl.appendChild(row);
    });
  }

  if (quest.steps) {
    const listEl = ensureList();
    quest.steps.forEach((step) => {
      const row = document.createElement("div");
      row.className = "quest-item";
      row.textContent = step;
      listEl.appendChild(row);
    });
  }

  if (list) {
    card.appendChild(list);
  }

  if (quest.options) {
    quest.options.forEach((option) => {
      const optionWrap = document.createElement("div");
      optionWrap.className = "quest-option";

      const optionTitle = document.createElement("div");
      optionTitle.className = "quest-option-title";
      optionTitle.textContent = option.label;

      optionWrap.appendChild(optionTitle);

      option.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "quest-item";
        row.textContent = item;
        optionWrap.appendChild(row);
      });

      card.appendChild(optionWrap);
    });
  }

  if (quest.extras) {
    const extraWrap = document.createElement("div");
    extraWrap.className = "quest-option";

    const extraTitle = document.createElement("div");
    extraTitle.className = "quest-option-title";
    extraTitle.textContent = "Дополнительно";

    extraWrap.appendChild(extraTitle);
    quest.extras.forEach((item) => {
      const row = document.createElement("div");
      row.className = "quest-item";
      row.textContent = item;
      extraWrap.appendChild(row);
    });

    card.appendChild(extraWrap);
  }

  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = isDone ? "Выполнено" : "Выполнить";
  btn.disabled = isDone;
  btn.dataset.questId = quest.id;

  card.appendChild(btn);
  return card;
};

const renderQuests = (state) => {
  const daily = getDailyState(state);
  dom.questList.innerHTML = "";

  QUESTS.forEach((quest) => {
    const isDone = Boolean(daily.quests[quest.id]);
    dom.questList.appendChild(renderQuestCard(quest, isDone));
  });
};

const renderMission = (state) => {
  const daily = getDailyState(state);
  const { dayIndex, mission } = getMissionForToday();

  dom.missionCard.innerHTML = "";

  if (!mission) {
    dom.missionCard.textContent = "Нет миссии на сегодня";
    return;
  }

  const title = document.createElement("div");
  title.className = "mission-title";
  title.textContent = mission.title;

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.textContent = DAY_NAMES_RU[dayIndex];

  const header = document.createElement("div");
  header.className = "quest-header";
  header.appendChild(title);
  header.appendChild(tag);

  const meta = document.createElement("div");
  meta.className = "mission-meta";
  meta.textContent = buildMetaText([
    mission.duration ? `Длительность: ${mission.duration}` : null,
    mission.note,
    mission.xp ? `+${mission.xp} XP` : null
  ]);

  const btn = document.createElement("button");
  const isDone = daily.missionDone;
  const isRest = mission.rest || !mission.xp;

  btn.className = "btn primary";
  btn.textContent = isRest ? "День восстановления" : (isDone ? "Миссия выполнена" : "Начать тренировку");
  btn.disabled = isRest || isDone;
  btn.dataset.missionDay = String(dayIndex);

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

const showToast = (message) => {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  window.clearTimeout(dom.toastTimer);
  dom.toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove("show");
  }, 1400);
};

const grantXp = (state, amount) => {
  state.xp += amount;
};

const completeQuest = (state, questId) => {
  const quest = QUESTS.find((item) => item.id === questId);
  if (!quest) return;
  const daily = getDailyState(state);
  if (daily.quests[questId]) return;

  daily.quests[questId] = true;
  grantXp(state, quest.xp ?? APP_CONFIG.questXpDefault);
  saveState(state);
  updateXpUI(state);
  renderHome(state);
  renderQuests(state);
  showToast(`+${quest.xp ?? APP_CONFIG.questXpDefault} XP`);
};

const completeMission = (state, dayIndex) => {
  const { mission } = getMissionForToday();
  if (!mission || mission.rest || !mission.xp) return;
  const daily = getDailyState(state);
  if (daily.missionDone) return;

  daily.missionDone = true;
  grantXp(state, mission.xp || APP_CONFIG.trainingXpBoost);
  saveState(state);
  updateXpUI(state);
  renderHome(state);
  renderMission(state);
  showToast(`+${mission.xp} XP`);
};

const setActiveTab = (tabName) => {
  Object.keys(dom.tabs).forEach((key) => {
    dom.tabs[key].classList.toggle("active", key === tabName);
  });
  dom.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const resetAllProgress = () => {
  const confirmReset = window.confirm("Сбросить весь прогресс и начать заново?");
  if (!confirmReset) return;

  localStorage.removeItem(STORAGE_KEY);
  appState = getDefaultState();
  ensureTodayState(appState);
  saveState(appState);
  renderAll();
  showToast("Прогресс обнулён");
  setActiveTab("home");
};

const scheduleMidnightReset = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const delay = Math.max(1000, next.getTime() - now.getTime());
  window.setTimeout(() => {
    ensureTodayState(appState);
    saveState(appState);
    renderAll();
    scheduleMidnightReset();
  }, delay);
};

const setupEvents = () => {
  dom.questList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.questId && !target.hasAttribute("disabled")) {
      completeQuest(appState, target.dataset.questId);
    }
  });

  dom.missionCard.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.missionDay && !target.hasAttribute("disabled")) {
      completeMission(appState, Number(target.dataset.missionDay));
    }
  });

  dom.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.nav));
  });

  dom.resetProgress.addEventListener("click", resetAllProgress);
};

const registerServiceWorker = () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }
};

const renderAll = () => {
  updateXpUI(appState);
  renderHome(appState);
  renderQuests(appState);
  renderMission(appState);
  renderIntel();
};

let appState = loadState();
ensureTodayState(appState);
saveState(appState);
renderAll();
setupEvents();
scheduleMidnightReset();
registerServiceWorker();


