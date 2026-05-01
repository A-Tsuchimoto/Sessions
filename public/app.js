'use strict';

const SESSIONS = [
  { num: 1, start: 8, end: 10 },
  { num: 2, start: 10, end: 12 },
  { num: 3, start: 12, end: 14 },
  { num: 4, start: 14, end: 16 },
  { num: 5, start: 16, end: 18 },
  { num: 6, start: 18, end: 20 },
];

const SESSION_TOTAL_MIN = 120;

const state = {
  selectedDate: null,
  selectedSession: null,
  todayRecord: {},
  weekRecords: {},
  saveTimer: null,
};

// ---------- date / session utils ----------

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayOfWeekJa(d) {
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
}

function getCurrentSession(now = new Date()) {
  const hours = now.getHours() + now.getMinutes() / 60;
  for (const s of SESSIONS) {
    if (hours >= s.start && hours < s.end) return s;
  }
  return null;
}

function getNextSession(now = new Date()) {
  const hours = now.getHours() + now.getMinutes() / 60;
  for (const s of SESSIONS) {
    if (hours < s.start) return s;
  }
  return null;
}

function getRemainingMinutes(session, now = new Date()) {
  const end = new Date(now);
  end.setHours(session.end, 0, 0, 0);
  return Math.max(0, Math.ceil((end - now) / 60000));
}

function getSessionProgress(session, now = new Date()) {
  const elapsedMin = (now.getHours() - session.start) * 60 + now.getMinutes() + now.getSeconds() / 60;
  return Math.max(0, Math.min(1, elapsedMin / SESSION_TOTAL_MIN));
}

function sessionLabel(s) {
  return `Session ${s.num}`;
}

function sessionRange(s) {
  return `${String(s.start).padStart(2, '0')}:00 - ${String(s.end).padStart(2, '0')}:00`;
}

function sessionKey(num) {
  return `session${num}`;
}

// ---------- API ----------

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function fetchDayRecord(dateStr) {
  return apiGet(`/api/records/${dateStr}`);
}

async function saveSession(dateStr, sessionNum, fields) {
  return apiPut(`/api/records/${dateStr}`, { session: sessionNum, ...fields });
}

// ---------- Session Tab ----------

function renderTodayLabel() {
  const now = new Date();
  document.getElementById('today-label').textContent =
    `${formatDate(now)} (${dayOfWeekJa(now)})`;
}

function renderSessionTab() {
  const now = new Date();
  const current = getCurrentSession(now);
  const titleEl = document.getElementById('session-title');
  const rangeEl = document.getElementById('session-range');
  const remainEl = document.getElementById('time-remaining');
  const fillEl = document.getElementById('progress-fill');
  const metaEl = document.getElementById('session-meta');
  const taskInput = document.getElementById('task-input');
  const achieveBtn = document.getElementById('achieve-btn');

  if (current) {
    titleEl.textContent = sessionLabel(current);
    rangeEl.textContent = sessionRange(current);
    remainEl.textContent = String(getRemainingMinutes(current, now));
    fillEl.style.width = `${(1 - getSessionProgress(current, now)) * 100}%`;
    metaEl.textContent = '';

    taskInput.disabled = false;
    achieveBtn.disabled = false;

    const rec = state.todayRecord[sessionKey(current.num)] || {};
    if (document.activeElement !== taskInput) {
      taskInput.value = rec.task || '';
    }
    setAchieveButton(achieveBtn, !!rec.achieved);
  } else {
    const next = getNextSession(now);
    if (next) {
      titleEl.textContent = 'セッション時間外';
      rangeEl.textContent = '';
      remainEl.textContent = '0';
      fillEl.style.width = '0%';
      metaEl.textContent = `次のセッション: ${sessionLabel(next)} (${sessionRange(next)})`;
    } else {
      titleEl.textContent = '本日のセッション終了';
      rangeEl.textContent = '';
      remainEl.textContent = '0';
      fillEl.style.width = '0%';
      metaEl.textContent = '20:00以降のセッションはありません。明日の朝8時から再開します。';
    }
    taskInput.disabled = true;
    taskInput.value = '';
    achieveBtn.disabled = true;
    setAchieveButton(achieveBtn, false);
  }
}

function setAchieveButton(btn, achieved) {
  if (achieved) {
    btn.textContent = '達成済み';
    btn.classList.add('achieved');
  } else {
    btn.textContent = '達成';
    btn.classList.remove('achieved');
  }
}

function flashStatus(msg, ms = 2000) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  if (flashStatus._t) clearTimeout(flashStatus._t);
  if (ms > 0) flashStatus._t = setTimeout(() => (el.textContent = ''), ms);
}

async function handleTaskBlur() {
  const now = new Date();
  const current = getCurrentSession(now);
  if (!current) return;

  const taskInput = document.getElementById('task-input');
  const newTask = taskInput.value.trim();
  const dateStr = formatDate(now);
  const key = sessionKey(current.num);
  const existing = state.todayRecord[key] || {};

  if ((existing.task || '') === newTask) return;

  flashStatus('保存中...', 0);
  try {
    const updated = await saveSession(dateStr, current.num, { task: newTask });
    state.todayRecord = updated;
    flashStatus('保存しました');
  } catch (e) {
    flashStatus('保存に失敗しました');
  }
}

async function handleAchieveClick() {
  const now = new Date();
  const current = getCurrentSession(now);
  if (!current) return;

  const dateStr = formatDate(now);
  const key = sessionKey(current.num);
  const cur = state.todayRecord[key] || {};
  const newVal = !cur.achieved;

  // Save current task value first if changed.
  const taskInput = document.getElementById('task-input');
  const taskVal = taskInput.value.trim();

  flashStatus('保存中...', 0);
  try {
    const updated = await saveSession(dateStr, current.num, {
      task: taskVal,
      achieved: newVal,
    });
    state.todayRecord = updated;
    setAchieveButton(document.getElementById('achieve-btn'), newVal);
    flashStatus(newVal ? '達成を記録しました' : '達成を取り消しました');
  } catch (e) {
    flashStatus('保存に失敗しました');
  }
}

// ---------- Record Tab ----------

function getLast7Dates(now = new Date()) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates; // newest first
}

async function loadWeekRecords() {
  const dates = getLast7Dates();
  const results = await Promise.all(dates.map((d) => fetchDayRecord(d).catch(() => ({}))));
  const map = {};
  dates.forEach((d, i) => (map[d] = results[i] || {}));
  state.weekRecords = map;
}

function renderRecordTab() {
  renderWeeklyGrid();
  renderRecordDetail();
}

function renderWeeklyGrid() {
  const grid = document.getElementById('weekly-grid');
  grid.innerHTML = '';

  // Header row
  const corner = document.createElement('div');
  corner.className = 'header-cell';
  corner.textContent = '';
  grid.appendChild(corner);

  for (const s of SESSIONS) {
    const c = document.createElement('div');
    c.className = 'header-cell';
    c.textContent = `S${s.num}`;
    grid.appendChild(c);
  }

  const dates = getLast7Dates();
  for (const dateStr of dates) {
    const d = parseDate(dateStr);
    const dayBtn = document.createElement('button');
    dayBtn.className = 'date-cell row-button';
    dayBtn.innerHTML = `
      <span class="date-main">${d.getMonth() + 1}/${d.getDate()}</span>
      <span class="date-sub">(${dayOfWeekJa(d)})</span>
    `;
    dayBtn.addEventListener('click', () => {
      state.selectedDate = dateStr;
      state.selectedSession = null;
      renderRecordDetail();
    });
    grid.appendChild(dayBtn);

    const rec = state.weekRecords[dateStr] || {};
    for (const s of SESSIONS) {
      const cell = document.createElement('button');
      const data = rec[sessionKey(s.num)];
      cell.className = 'session-cell row-button';
      if (data?.achieved) cell.classList.add('achieved');
      else if (data?.task) cell.classList.add('has-task');
      if (state.selectedDate === dateStr && state.selectedSession === s.num) {
        cell.classList.add('selected');
      }
      cell.title = `${dateStr} ${sessionLabel(s)}${data?.task ? ': ' + data.task : ''}`;
      cell.textContent = data?.achieved ? '✓' : data?.task ? '・' : '';
      cell.addEventListener('click', () => {
        state.selectedDate = dateStr;
        state.selectedSession = s.num;
        renderRecordDetail();
      });
      grid.appendChild(cell);
    }
  }
}

function renderRecordDetail() {
  const titleEl = document.getElementById('record-detail-title');
  const listEl = document.getElementById('record-detail-list');
  listEl.innerHTML = '';

  if (!state.selectedDate) {
    titleEl.textContent = '日付を選択してください';
    return;
  }

  const d = parseDate(state.selectedDate);
  titleEl.textContent = `${state.selectedDate} (${dayOfWeekJa(d)})`;

  const rec = state.weekRecords[state.selectedDate] || {};

  for (const s of SESSIONS) {
    const data = rec[sessionKey(s.num)] || {};
    const row = document.createElement('div');
    row.className = 'record-row';
    if (state.selectedSession === s.num) {
      row.style.outline = '2px solid var(--primary)';
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div class="session-num">${sessionLabel(s)}</div>
      <div class="session-time">${sessionRange(s)}</div>
    `;

    const body = document.createElement('div');
    body.className = 'body';

    const ta = document.createElement('textarea');
    ta.rows = 2;
    ta.value = data.task || '';
    ta.placeholder = '取り組む内容...';

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-achieve';
    if (data.achieved) toggleBtn.classList.add('achieved');
    toggleBtn.textContent = data.achieved ? '達成済み' : '未達成';

    const status = document.createElement('span');
    status.className = 'row-status';

    const setStatus = (msg, ms = 1800) => {
      status.textContent = msg;
      if (row._t) clearTimeout(row._t);
      if (ms > 0) row._t = setTimeout(() => (status.textContent = ''), ms);
    };

    ta.addEventListener('blur', async () => {
      const newTask = ta.value.trim();
      if ((data.task || '') === newTask) return;
      setStatus('保存中...', 0);
      try {
        const updated = await saveSession(state.selectedDate, s.num, { task: newTask });
        state.weekRecords[state.selectedDate] = updated;
        if (state.selectedDate === formatDate(new Date())) {
          state.todayRecord = updated;
          renderSessionTab();
        }
        renderWeeklyGrid();
        setStatus('保存しました');
        // refresh local data reference
        Object.assign(data, updated[sessionKey(s.num)] || {});
      } catch (e) {
        setStatus('保存に失敗しました');
      }
    });

    toggleBtn.addEventListener('click', async () => {
      const newAchieved = !data.achieved;
      setStatus('保存中...', 0);
      try {
        const updated = await saveSession(state.selectedDate, s.num, {
          task: ta.value.trim(),
          achieved: newAchieved,
        });
        state.weekRecords[state.selectedDate] = updated;
        if (state.selectedDate === formatDate(new Date())) {
          state.todayRecord = updated;
          renderSessionTab();
        }
        Object.assign(data, updated[sessionKey(s.num)] || {});
        toggleBtn.textContent = newAchieved ? '達成済み' : '未達成';
        toggleBtn.classList.toggle('achieved', newAchieved);
        renderWeeklyGrid();
        setStatus(newAchieved ? '達成を記録しました' : '達成を取り消しました');
      } catch (e) {
        setStatus('保存に失敗しました');
      }
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(status);
    body.appendChild(ta);
    body.appendChild(actions);
    row.appendChild(meta);
    row.appendChild(body);
    listEl.appendChild(row);
  }
}

// ---------- Tabs ----------

function setupTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`tab-${tab}`).classList.add('active');

      if (tab === 'record') {
        await loadWeekRecords();
        if (!state.selectedDate) {
          state.selectedDate = formatDate(new Date());
        }
        renderRecordTab();
      } else if (tab === 'session') {
        // Refresh today's record when returning to session tab.
        try {
          state.todayRecord = await fetchDayRecord(formatDate(new Date()));
        } catch (e) {}
        renderSessionTab();
      }
    });
  });
}

// ---------- Init ----------

async function init() {
  renderTodayLabel();
  setupTabs();

  document.getElementById('task-input').addEventListener('blur', handleTaskBlur);
  document.getElementById('achieve-btn').addEventListener('click', handleAchieveClick);

  try {
    state.todayRecord = await fetchDayRecord(formatDate(new Date()));
  } catch (e) {
    state.todayRecord = {};
  }
  renderSessionTab();

  // Update timer (every 30s for minute display + progress bar).
  setInterval(() => {
    renderTodayLabel();
    if (document.getElementById('tab-session').classList.contains('active')) {
      renderSessionTab();
    }
  }, 30 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
