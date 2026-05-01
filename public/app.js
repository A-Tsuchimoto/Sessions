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
const STATUS_LABEL = { achieved: '達成', off: 'オフ' };

const state = {
  todayDate: null,
  todayRecord: {},
  records: {}, // date -> { session1: {task, status}, ... }
  selectedDate: null,
  calendar: { year: null, month: null }, // month is 0-indexed
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
  const elapsedMin =
    (now.getHours() - session.start) * 60 + now.getMinutes() + now.getSeconds() / 60;
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

function getStatusOf(rec) {
  if (!rec) return null;
  if (rec.status === 'achieved' || rec.status === 'off') return rec.status;
  if (rec.achieved === true) return 'achieved'; // legacy
  return null;
}

// ---------- API ----------

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} -> ${res.status}`);
  return res.json();
}

async function fetchDayRecord(dateStr) {
  const data = await apiGet(`/api/records/${dateStr}`);
  state.records[dateStr] = data;
  return data;
}

async function fetchRangeRecords(startStr, endStr) {
  const data = await apiGet(
    `/api/records?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
  );
  Object.assign(state.records, data);
  return data;
}

async function fetchAllRecords() {
  return apiGet('/api/records');
}

async function saveSession(dateStr, sessionNum, fields) {
  const updated = await apiPut(`/api/records/${dateStr}`, { session: sessionNum, ...fields });
  state.records[dateStr] = updated;
  if (dateStr === state.todayDate) state.todayRecord = updated;
  return updated;
}

// ---------- Session Tab ----------

function renderTodayLabel() {
  const now = new Date();
  document.getElementById('today-label').textContent = `${formatDate(now)} (${dayOfWeekJa(now)})`;
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
  const offBtn = document.getElementById('off-btn');

  if (current) {
    titleEl.textContent = sessionLabel(current);
    rangeEl.textContent = sessionRange(current);
    remainEl.textContent = String(getRemainingMinutes(current, now));
    fillEl.style.width = `${(1 - getSessionProgress(current, now)) * 100}%`;
    metaEl.textContent = '';

    taskInput.disabled = false;
    achieveBtn.disabled = false;
    offBtn.disabled = false;

    const rec = state.todayRecord[sessionKey(current.num)] || {};
    if (document.activeElement !== taskInput) {
      taskInput.value = rec.task || '';
    }
    setStatusButtons(getStatusOf(rec));
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
      metaEl.textContent =
        '20:00以降のセッションはありません。明日の朝8時から再開します。';
    }
    taskInput.disabled = true;
    taskInput.value = '';
    achieveBtn.disabled = true;
    offBtn.disabled = true;
    setStatusButtons(null);
  }
}

function setStatusButtons(status) {
  const achieveBtn = document.getElementById('achieve-btn');
  const offBtn = document.getElementById('off-btn');
  achieveBtn.classList.toggle('active', status === 'achieved');
  offBtn.classList.toggle('active', status === 'off');
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
    await saveSession(dateStr, current.num, { task: newTask });
    flashStatus('保存しました');
  } catch {
    flashStatus('保存に失敗しました');
  }
}

async function handleStatusButtonClick(targetStatus) {
  const now = new Date();
  const current = getCurrentSession(now);
  if (!current) return;

  const dateStr = formatDate(now);
  const key = sessionKey(current.num);
  const cur = state.todayRecord[key] || {};
  const curStatus = getStatusOf(cur);
  const newStatus = curStatus === targetStatus ? null : targetStatus;

  const taskInput = document.getElementById('task-input');
  const taskVal = taskInput.value.trim();

  flashStatus('保存中...', 0);
  try {
    await saveSession(dateStr, current.num, { task: taskVal, status: newStatus });
    setStatusButtons(newStatus);
    if (newStatus === 'achieved') flashStatus('達成を記録しました');
    else if (newStatus === 'off') flashStatus('オフとして記録しました');
    else flashStatus('状態を解除しました');
    // Refresh derived views (calendar/weekly may now show a color change).
    if (document.getElementById('tab-record').classList.contains('active')) {
      renderRecordTab();
    }
  } catch {
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
  const start = dates[dates.length - 1];
  const end = dates[0];
  await fetchRangeRecords(start, end);
}

async function loadCalendarRecords() {
  const { year, month } = state.calendar;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  await fetchRangeRecords(formatDate(first), formatDate(last));
}

function renderRecordTab() {
  renderWeeklyGrid();
  renderCalendar();
  renderRecordDetail();
}

function renderWeeklyGrid() {
  const grid = document.getElementById('weekly-grid');
  grid.innerHTML = '';

  const corner = document.createElement('div');
  corner.className = 'header-cell';
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
      renderRecordDetail();
      renderCalendar();
    });
    grid.appendChild(dayBtn);

    const rec = state.records[dateStr] || {};
    for (const s of SESSIONS) {
      const cell = document.createElement('button');
      const data = rec[sessionKey(s.num)] || {};
      const status = getStatusOf(data);
      cell.className = 'session-cell row-button';
      if (status === 'achieved') cell.classList.add('achieved');
      else if (status === 'off') cell.classList.add('off');
      else if (data.task) cell.classList.add('has-task');
      if (state.selectedDate === dateStr) cell.classList.add('selected');
      const label = status ? STATUS_LABEL[status] : '';
      cell.title = `${dateStr} ${sessionLabel(s)}${data.task ? ': ' + data.task : ''}${label ? ' [' + label + ']' : ''}`;
      cell.textContent =
        status === 'achieved' ? '✓' : status === 'off' ? '○' : data.task ? '・' : '';
      cell.addEventListener('click', () => {
        state.selectedDate = dateStr;
        renderRecordDetail();
        renderCalendar();
      });
      grid.appendChild(cell);
    }
  }
}

function renderCalendar() {
  const { year, month } = state.calendar;
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('calendar-month-label');
  if (year == null || month == null) return;
  label.textContent = `${year}年${month + 1}月`;
  grid.innerHTML = '';

  const dows = ['日', '月', '火', '水', '木', '金', '土'];
  dows.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    if (i === 0) el.classList.add('dow-sun');
    if (i === 6) el.classList.add('dow-sat');
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const todayStr = formatDate(new Date());

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = formatDate(d);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (dateStr === todayStr) cell.classList.add('today');
    if (state.selectedDate === dateStr) cell.classList.add('selected');

    const num = document.createElement('span');
    num.className = 'cal-day-num';
    if (d.getDay() === 0) num.classList.add('dow-sun');
    if (d.getDay() === 6) num.classList.add('dow-sat');
    num.textContent = day;
    cell.appendChild(num);

    const bars = document.createElement('div');
    bars.className = 'cal-bars';
    const rec = state.records[dateStr] || {};
    for (const s of SESSIONS) {
      const bar = document.createElement('div');
      bar.className = 'cal-bar';
      const data = rec[sessionKey(s.num)] || {};
      const status = getStatusOf(data);
      if (status === 'achieved') bar.classList.add('achieved');
      else if (status === 'off') bar.classList.add('off');
      else if (data.task) bar.classList.add('has-task');
      bars.appendChild(bar);
    }
    cell.appendChild(bars);

    cell.addEventListener('click', () => {
      state.selectedDate = dateStr;
      renderRecordDetail();
      renderCalendar();
      renderWeeklyGrid();
    });
    grid.appendChild(cell);
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
  const rec = state.records[state.selectedDate] || {};

  for (const s of SESSIONS) {
    const data = rec[sessionKey(s.num)] || {};
    const row = document.createElement('div');
    row.className = 'record-row';

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

    const achievePill = document.createElement('button');
    achievePill.type = 'button';
    achievePill.className = 'status-pill';
    achievePill.dataset.status = 'achieved';
    achievePill.textContent = '達成';

    const offPill = document.createElement('button');
    offPill.type = 'button';
    offPill.className = 'status-pill';
    offPill.dataset.status = 'off';
    offPill.textContent = 'オフ';

    const status = document.createElement('span');
    status.className = 'row-status';

    const refreshPills = () => {
      const cur = getStatusOf(data);
      achievePill.classList.toggle('active', cur === 'achieved');
      offPill.classList.toggle('active', cur === 'off');
    };
    refreshPills();

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
        Object.assign(data, updated[sessionKey(s.num)] || {});
        renderWeeklyGrid();
        renderCalendar();
        if (state.selectedDate === state.todayDate) renderSessionTab();
        setStatus('保存しました');
      } catch {
        setStatus('保存に失敗しました');
      }
    });

    const handlePill = async (target) => {
      const cur = getStatusOf(data);
      const newStatus = cur === target ? null : target;
      setStatus('保存中...', 0);
      try {
        const updated = await saveSession(state.selectedDate, s.num, {
          task: ta.value.trim(),
          status: newStatus,
        });
        Object.assign(data, updated[sessionKey(s.num)] || {});
        refreshPills();
        renderWeeklyGrid();
        renderCalendar();
        if (state.selectedDate === state.todayDate) renderSessionTab();
        setStatus(
          newStatus === 'achieved'
            ? '達成を記録しました'
            : newStatus === 'off'
              ? 'オフとして記録しました'
              : '状態を解除しました'
        );
      } catch {
        setStatus('保存に失敗しました');
      }
    };

    achievePill.addEventListener('click', () => handlePill('achieved'));
    offPill.addEventListener('click', () => handlePill('off'));

    actions.appendChild(achievePill);
    actions.appendChild(offPill);
    actions.appendChild(status);
    body.appendChild(ta);
    body.appendChild(actions);
    row.appendChild(meta);
    row.appendChild(body);
    listEl.appendChild(row);
  }
}

// ---------- CSV export ----------

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function recordsToCsv(allRecords) {
  const header = ['date', 'session', 'start', 'end', 'task', 'status'];
  const lines = [header.join(',')];
  const dates = Object.keys(allRecords).sort();
  for (const date of dates) {
    const rec = allRecords[date] || {};
    for (const s of SESSIONS) {
      const data = rec[sessionKey(s.num)] || {};
      const status = getStatusOf(data);
      // Skip rows with no content at all to keep the export compact.
      if (!data.task && !status) continue;
      lines.push(
        [
          date,
          s.num,
          `${String(s.start).padStart(2, '0')}:00`,
          `${String(s.end).padStart(2, '0')}:00`,
          data.task || '',
          status || '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }
  return lines.join('\r\n') + '\r\n';
}

async function handleExportCsv() {
  const btn = document.getElementById('export-csv');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '取得中...';
  try {
    const all = await fetchAllRecords();
    Object.assign(state.records, all);
    const csv = recordsToCsv(all);
    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-blocked-todo-${formatDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('エクスポートに失敗しました: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
        if (state.calendar.year == null) {
          const now = new Date();
          state.calendar = { year: now.getFullYear(), month: now.getMonth() };
        }
        if (!state.selectedDate) state.selectedDate = formatDate(new Date());
        await Promise.all([loadWeekRecords(), loadCalendarRecords()]);
        renderRecordTab();
      } else if (tab === 'session') {
        try {
          state.todayDate = formatDate(new Date());
          state.todayRecord = await fetchDayRecord(state.todayDate);
        } catch {}
        renderSessionTab();
      }
    });
  });
}

function setupCalendarNav() {
  document.getElementById('prev-month').addEventListener('click', async () => {
    let { year, month } = state.calendar;
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    state.calendar = { year, month };
    await loadCalendarRecords();
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', async () => {
    let { year, month } = state.calendar;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    state.calendar = { year, month };
    await loadCalendarRecords();
    renderCalendar();
  });

  document.getElementById('today-month').addEventListener('click', async () => {
    const now = new Date();
    state.calendar = { year: now.getFullYear(), month: now.getMonth() };
    state.selectedDate = formatDate(now);
    await loadCalendarRecords();
    renderRecordDetail();
    renderCalendar();
    renderWeeklyGrid();
  });
}

// ---------- Init ----------

async function init() {
  state.todayDate = formatDate(new Date());
  renderTodayLabel();
  setupTabs();
  setupCalendarNav();

  document.getElementById('task-input').addEventListener('blur', handleTaskBlur);
  document.getElementById('achieve-btn').addEventListener('click', () =>
    handleStatusButtonClick('achieved')
  );
  document.getElementById('off-btn').addEventListener('click', () =>
    handleStatusButtonClick('off')
  );
  document.getElementById('export-csv').addEventListener('click', handleExportCsv);

  try {
    state.todayRecord = await fetchDayRecord(state.todayDate);
  } catch {
    state.todayRecord = {};
  }
  renderSessionTab();

  setInterval(() => {
    const newToday = formatDate(new Date());
    if (newToday !== state.todayDate) {
      state.todayDate = newToday;
      fetchDayRecord(newToday).catch(() => {});
    }
    renderTodayLabel();
    if (document.getElementById('tab-session').classList.contains('active')) {
      renderSessionTab();
    }
  }, 30 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
