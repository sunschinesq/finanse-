'use strict';

// ---------- Stałe ----------

const STORAGE_KEY = 'finanse-v1';

const CATEGORIES = [
  { id: 'czynsz', name: 'Czynsz', icon: '🏠' },
  { id: 'prad', name: 'Prąd', icon: '⚡' },
  { id: 'jedzenie', name: 'Jedzenie', icon: '🛒' },
  { id: 'kot', name: 'Kot', icon: '🐱' },
  { id: 'rosliny', name: 'Rośliny', icon: '🪴' },
  { id: 'wyjscia', name: 'Wyjścia', icon: '🎉' },
  { id: 'raty', name: 'Raty', icon: '💳' },
  { id: 'oszczednosci', name: 'Oszczędności', icon: '🐷' },
  { id: 'leki', name: 'Leki', icon: '💊' },
  { id: 'kosmetyki', name: 'Kosmetyki', icon: '🧴' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const SAVINGS = 'oszczednosci';

// ---------- Stan ----------

function emptyState() {
  return {
    version: 1,
    months: {},      // 'RRRR-MM' -> { income: {parents, work}, plan: {catId: kwota}, expenses: [] }
    recurring: [],   // { id, name, cat, amount, day }
    goal: { name: '', target: 0, start: 0, deadline: '' },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) { /* brak dostępu do pamięci – startujemy od zera */ }
  return emptyState();
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('Nie udało się zapisać danych w przeglądarce. Zrób kopię zapasową w Ustawieniach.');
  }
}

const ui = {
  tab: 'month',
  month: monthKey(new Date()),
  filter: '',
};

// ---------- Pomocnicze ----------

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 });
const fmt = n => money.format(Math.round((n || 0) * 100) / 100);
const fmtShort = n => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(n) + ' zł';

function monthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function addMonths(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
function monthLabel(key, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pl-PL', opts);
}
function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function todayISO() {
  const d = new Date();
  return monthKey(d) + '-' + String(d.getDate()).padStart(2, '0');
}
function parseAmount(v) {
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const numInput = n => (n ? String(n).replace('.', ',') : '');
const sum = arr => arr.reduce((a, b) => a + b, 0);

// ---------- Logika miesięcy ----------

// Tworzy miesiąc, kopiując dochód i plan z najbliższego wcześniejszego miesiąca.
// Stałe opłaty dopisują się same tylko od bieżącego miesiąca wzwyż – do przeszłych
// można je dodać ręcznie w Ustawieniach.
function ensureMonth(key) {
  if (state.months[key]) return state.months[key];
  const prevKey = Object.keys(state.months).filter(k => k < key).sort().pop();
  const prev = prevKey && state.months[prevKey];
  const m = {
    income: prev ? { ...prev.income } : { parents: 0, work: 0 },
    plan: prev ? { ...prev.plan } : {},
    expenses: [],
  };
  state.months[key] = m;
  if (key >= monthKey(new Date())) applyRecurring(key);
  save();
  return m;
}

// Dopisuje do miesiąca stałe opłaty, których jeszcze w nim nie ma.
function applyRecurring(key) {
  const m = state.months[key];
  let added = 0;
  for (const r of state.recurring) {
    if (m.expenses.some(e => e.recurring === r.id)) continue;
    const day = Math.min(Math.max(1, r.day || 1), daysInMonth(key));
    m.expenses.push({
      id: uid(), date: key + '-' + String(day).padStart(2, '0'),
      cat: r.cat, amount: r.amount, note: r.name, recurring: r.id,
    });
    added++;
  }
  return added;
}

function spentByCat(m) {
  const out = {};
  for (const c of CATEGORIES) out[c.id] = 0;
  for (const e of m.expenses) out[e.cat] = (out[e.cat] || 0) + e.amount;
  return out;
}
function monthTotals(m) {
  const income = (m.income.parents || 0) + (m.income.work || 0);
  const spent = sum(m.expenses.map(e => e.amount));
  const planned = sum(CATEGORIES.map(c => m.plan[c.id] || 0));
  return { income, spent, planned, left: income - spent, unplanned: income - planned };
}
function totalSaved() {
  let s = state.goal.start || 0;
  for (const m of Object.values(state.months)) {
    for (const e of m.expenses) if (e.cat === SAVINGS) s += e.amount;
  }
  return s;
}

// ---------- Renderowanie ----------

const view = document.getElementById('view');

function render() {
  const m = ensureMonth(ui.month);
  document.getElementById('monthTitle').textContent = monthLabel(ui.month);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const showMonthNav = ui.tab !== 'goal' && ui.tab !== 'settings';
  document.querySelector('.topbar').hidden = !showMonthNav;
  document.getElementById('addExpense').hidden = ui.tab === 'settings';
  hideTooltip();
  ({ month: renderMonth, expenses: renderExpenses, charts: renderCharts, goal: renderGoal, settings: renderSettings })[ui.tab](m);
}

function renderMonth(m) {
  const t = monthTotals(m);
  const spent = spentByCat(m);
  view.innerHTML = `
    <div class="cards">
      <div class="card">
        <div class="label">Dochód</div>
        <div class="value">${fmt(t.income)}</div>
        <div class="sub">rodzice ${fmt(m.income.parents)} · praca ${fmt(m.income.work)}</div>
      </div>
      <div class="card">
        <div class="label">Wydane</div>
        <div class="value">${fmt(t.spent)}</div>
        <div class="sub">plan: ${fmt(t.planned)}</div>
      </div>
      <div class="card">
        <div class="label">Zostało</div>
        <div class="value ${t.left < 0 ? 'neg' : 'pos'}">${fmt(t.left)}</div>
        <div class="sub">${t.unplanned >= 0 ? 'nierozplanowane: ' + fmt(t.unplanned) : 'plan przekracza dochód o ' + fmt(-t.unplanned)}</div>
      </div>
    </div>

    <section class="panel">
      <h2>Dochód w tym miesiącu</h2>
      <div class="income-grid">
        <label class="field"><span>👪 Od rodziców</span>
          <input type="text" inputmode="decimal" id="incParents" value="${numInput(m.income.parents)}" placeholder="0">
        </label>
        <label class="field"><span>💼 Z pracy</span>
          <input type="text" inputmode="decimal" id="incWork" value="${numInput(m.income.work)}" placeholder="0">
        </label>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2>Budżet i wydatki</h2>
        <span class="hint" style="margin:0">dotknij kategorii, by ustawić plan</span>
      </div>
      <div class="cat-list">
        ${CATEGORIES.map(c => catRow(c, spent[c.id], m.plan[c.id] || 0)).join('')}
      </div>
    </section>`;

  const bindIncome = (id, field) => {
    document.getElementById(id).addEventListener('change', ev => {
      m.income[field] = parseAmount(ev.target.value);
      save(); render();
    });
  };
  bindIncome('incParents', 'parents');
  bindIncome('incWork', 'work');
  view.querySelectorAll('.cat-row').forEach(el => el.addEventListener('click', () => openPlanDialog(el.dataset.cat)));
}

function catRow(c, spent, plan) {
  const over = plan > 0 && spent > plan;
  const pct = plan > 0 ? Math.min(100, (spent / plan) * 100) : (spent > 0 ? 100 : 0);
  let note = '';
  if (plan > 0) {
    note = over
      ? `<div class="cat-note neg">przekroczono o ${fmt(spent - plan)}</div>`
      : `<div class="cat-note">zostało ${fmt(plan - spent)}</div>`;
  } else if (spent > 0) {
    note = `<div class="cat-note">brak planu</div>`;
  }
  return `
    <button class="cat-row" data-cat="${c.id}">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-name">${c.name}</span>
      <span class="cat-amounts">${fmt(spent)} <small>/ ${plan > 0 ? fmt(plan) : '—'}</small></span>
      <span class="bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></span>
      ${note}
    </button>`;
}

function renderExpenses(m) {
  const list = m.expenses
    .filter(e => !ui.filter || e.cat === ui.filter)
    .sort((a, b) => b.date.localeCompare(a.date) || 0);
  const total = sum(list.map(e => e.amount));
  let html = `
    <section class="panel">
      <div class="panel-head">
        <h2>Wydatki · ${fmt(total)}</h2>
      </div>
      <label class="field"><span>Kategoria</span>
        <select id="filter">
          <option value="">Wszystkie</option>
          ${CATEGORIES.map(c => `<option value="${c.id}" ${ui.filter === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
      </label>
    </section>
    <section class="panel">`;
  if (!list.length) {
    html += `<div class="empty">Brak wydatków w tym miesiącu.<br>Dodaj pierwszy przyciskiem +</div>`;
  } else {
    let lastDate = '';
    for (const e of list) {
      if (e.date !== lastDate) {
        const [y, mo, d] = e.date.split('-').map(Number);
        html += `<div class="day-head">${new Date(y, mo - 1, d).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>`;
        lastDate = e.date;
      }
      const c = CAT[e.cat] || { icon: '•', name: e.cat };
      html += `
        <button class="exp-row" data-id="${e.id}">
          <span class="ico">${c.icon}</span>
          <span class="what"><div>${esc(e.note) || c.name}${e.recurring ? '<span class="badge">stała</span>' : ''}</div><small>${c.name}</small></span>
          <span class="amt">${fmt(e.amount)}</span>
        </button>`;
    }
  }
  html += `</section>`;
  view.innerHTML = html;
  document.getElementById('filter').addEventListener('change', ev => { ui.filter = ev.target.value; render(); });
  view.querySelectorAll('.exp-row').forEach(el => el.addEventListener('click', () => openExpenseDialog(el.dataset.id)));
}

// ---------- Wykresy ----------

function renderCharts(m) {
  const spent = spentByCat(m);
  const rows = CATEGORIES
    .map(c => ({ c, spent: spent[c.id], plan: m.plan[c.id] || 0 }))
    .filter(r => r.spent > 0 || r.plan > 0)
    .sort((a, b) => b.spent - a.spent || b.plan - a.plan);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const k = addMonths(ui.month, -i);
    const mm = state.months[k];
    const t = mm ? monthTotals(mm) : { income: 0, spent: 0 };
    months.push({ key: k, income: t.income, spent: t.spent, has: !!mm });
  }

  view.innerHTML = `
    <section class="panel">
      <h2>Wydatki według kategorii</h2>
      <div class="legend"><span><i style="background:var(--series-1)"></i>Wydane</span><span><i class="tick"></i>Plan</span></div>
      ${rows.length ? categoryChart(rows) : '<div class="empty">Brak danych w tym miesiącu.</div>'}
    </section>
    <section class="panel">
      <h2>Ostatnie 6 miesięcy</h2>
      <div class="legend"><span><i style="background:var(--series-1)"></i>Wydatki</span><span><i class="dot"></i>Dochód</span></div>
      ${monthsChart(months)}
      <details>
        <summary>Pokaż tabelę</summary>
        <table class="data">
          <thead><tr><th>Miesiąc</th><th>Dochód</th><th>Wydatki</th><th>Bilans</th></tr></thead>
          <tbody>${months.map(x => `<tr><td>${monthLabel(x.key, { month: 'short', year: 'numeric' })}</td><td>${fmt(x.income)}</td><td>${fmt(x.spent)}</td><td class="${x.income - x.spent < 0 ? 'neg' : ''}">${fmt(x.income - x.spent)}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    </section>`;

  view.querySelectorAll('[data-tip]').forEach(el => {
    const show = ev => showTooltip(el.dataset.tip, ev);
    el.addEventListener('pointerenter', show);
    el.addEventListener('pointermove', show);
    el.addEventListener('pointerdown', show);
    el.addEventListener('pointerleave', hideTooltip);
  });
}

function categoryChart(rows) {
  const W = 600, labelW = 130, valueW = 90, rowH = 34, barH = 14;
  const plotW = W - labelW - valueW;
  const max = Math.max(...rows.map(r => Math.max(r.spent, r.plan)), 1);
  const H = rows.length * rowH;
  const x = v => labelW + (v / max) * plotW;
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Wydatki według kategorii">`;
  rows.forEach((r, i) => {
    const y = i * rowH + (rowH - barH) / 2;
    const w = Math.max(0, x(r.spent) - labelW);
    const tip = `<b>${r.c.icon} ${r.c.name}</b><br>Wydane: ${fmt(r.spent)}<br>Plan: ${r.plan ? fmt(r.plan) : '—'}`;
    svg += `<text x="0" y="${y + barH / 2 + 4}">${r.c.icon} ${r.c.name}</text>`;
    svg += `<line class="axis" x1="${labelW}" x2="${labelW}" y1="${i * rowH + 4}" y2="${(i + 1) * rowH - 4}"/>`;
    if (w > 0) svg += `<path class="s1" d="${roundedRight(labelW, y, w, barH, 4)}"/>`;
    if (r.plan > 0) svg += `<line class="plan-tick" x1="${x(r.plan)}" x2="${x(r.plan)}" y1="${y - 5}" y2="${y + barH + 5}"/>`;
    svg += `<text x="${W}" y="${y + barH / 2 + 4}" text-anchor="end" style="font-variant-numeric:tabular-nums">${fmtShort(r.spent)}</text>`;
    svg += `<rect class="hit" x="0" y="${i * rowH}" width="${W}" height="${rowH}" data-tip="${esc(tip)}"/>`;
  });
  return svg + `</svg>`;
}

function roundedRight(x, y, w, h, r) {
  r = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
function roundedTop(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= v) return s * p;
  return 10 * p;
}

function monthsChart(months) {
  const W = 600, H = 240, left = 56, right = 8, top = 12, bottom = 28;
  const plotW = W - left - right, plotH = H - top - bottom;
  const max = niceMax(Math.max(...months.map(m => Math.max(m.income, m.spent))));
  const y = v => top + plotH - (v / max) * plotH;
  const slot = plotW / months.length;
  const barW = Math.min(44, slot * 0.5);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dochód i wydatki w ostatnich 6 miesiącach">`;
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = y(v);
    svg += `<line class="${i === 0 ? 'axis' : 'grid'}" x1="${left}" x2="${W - right}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="muted" x="${left - 8}" y="${yy + 4}" text-anchor="end" style="font-variant-numeric:tabular-nums">${fmtShort(v)}</text>`;
  }
  const pts = [];
  months.forEach((m, i) => {
    const cx = left + slot * i + slot / 2;
    const h = y(0) - y(m.spent);
    if (h > 0) svg += `<path class="s1" d="${roundedTop(cx - barW / 2, y(m.spent), barW, h, 4)}"/>`;
    svg += `<text class="muted" x="${cx}" y="${H - 8}" text-anchor="middle">${monthLabel(m.key, { month: 'short' })}</text>`;
    if (m.has) pts.push([cx, y(m.income)]);
  });
  if (pts.length > 1) svg += `<polyline class="s2-line" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
  pts.forEach(([cx, cy]) => { svg += `<circle class="s2" cx="${cx}" cy="${cy}" r="5"/>`; });
  months.forEach((m, i) => {
    const tip = `<b>${monthLabel(m.key)}</b><br>Dochód: ${fmt(m.income)}<br>Wydatki: ${fmt(m.spent)}<br>Bilans: ${fmt(m.income - m.spent)}`;
    svg += `<rect class="hit" x="${left + slot * i}" y="${top}" width="${slot}" height="${plotH + bottom}" data-tip="${esc(tip)}"/>`;
  });
  return svg + `</svg>`;
}

const tooltip = document.getElementById('tooltip');
function showTooltip(html, ev) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const r = tooltip.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY - r.height - 10;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y < 8) y = ev.clientY + 16;
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top = y + 'px';
}
function hideTooltip() { tooltip.hidden = true; }

// ---------- Cel oszczędnościowy ----------

function renderGoal() {
  const g = state.goal;
  const saved = totalSaved();
  const pct = g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0;
  let pace = '';
  if (g.target > 0) {
    const missing = g.target - saved;
    if (missing <= 0) {
      pace = `<p class="pos"><b>🎉 Cel osiągnięty!</b></p>`;
    } else if (g.deadline) {
      const now = monthKey(new Date());
      const end = g.deadline.slice(0, 7);
      let monthsLeft = 0;
      for (let k = now; k <= end; k = addMonths(k, 1)) monthsLeft++;
      pace = monthsLeft > 0
        ? `<p>Brakuje <b>${fmt(missing)}</b>. Żeby zdążyć, odkładaj ok. <b>${fmt(missing / monthsLeft)}</b> miesięcznie (zostało ${monthsLeft} mies.).</p>`
        : `<p class="neg">Termin minął – brakuje ${fmt(missing)}.</p>`;
    } else {
      pace = `<p>Brakuje <b>${fmt(missing)}</b>.</p>`;
    }
  }

  const contributions = Object.keys(state.months).sort().reverse()
    .map(k => ({ k, v: sum(state.months[k].expenses.filter(e => e.cat === SAVINGS).map(e => e.amount)) }))
    .filter(x => x.v > 0);

  view.innerHTML = `
    <section class="panel">
      <h2>🎯 ${esc(g.name) || 'Cel oszczędnościowy'}</h2>
      ${g.target > 0 ? `
        <div class="goal-hero">${fmt(saved)}</div>
        <div class="hint" style="margin:0">z ${fmt(g.target)}${g.deadline ? ' · do ' + new Date(g.deadline).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
        <div class="goal-bar"><i style="width:${pct}%"></i></div>
        <div class="hint" style="margin:0 0 8px">${pct.toFixed(0)}%</div>
        ${pace}` : `<p class="hint">Ustaw cel poniżej. Do celu liczą się wszystkie wydatki z kategorii 🐷 Oszczędności.</p>`}
    </section>
    <section class="panel">
      <h2>Ustawienia celu</h2>
      <div class="form-grid">
        <label class="field full"><span>Na co oszczędzasz?</span><input type="text" id="gName" value="${esc(g.name)}" placeholder="np. wakacje, poduszka finansowa"></label>
        <label class="field"><span>Kwota celu (zł)</span><input type="text" inputmode="decimal" id="gTarget" value="${numInput(g.target)}" placeholder="3000"></label>
        <label class="field"><span>Termin</span><input type="date" id="gDeadline" value="${esc(g.deadline)}"></label>
        <label class="field full"><span>Już odłożone wcześniej (zł)</span><input type="text" inputmode="decimal" id="gStart" value="${numInput(g.start)}" placeholder="0"></label>
      </div>
      <div class="btn-row"><button class="btn primary" id="gSave">Zapisz cel</button></div>
    </section>
    <section class="panel">
      <h2>Wpłaty na oszczędności</h2>
      ${contributions.length
        ? `<table class="data"><thead><tr><th>Miesiąc</th><th>Odłożone</th></tr></thead><tbody>
            ${contributions.map(x => `<tr><td style="text-transform:capitalize">${monthLabel(x.k)}</td><td>${fmt(x.v)}</td></tr>`).join('')}
           </tbody></table>`
        : '<div class="empty">Dodaj wydatek w kategorii 🐷 Oszczędności, a pojawi się tutaj.</div>'}
    </section>`;

  document.getElementById('gSave').addEventListener('click', () => {
    state.goal = {
      name: document.getElementById('gName').value.trim(),
      target: parseAmount(document.getElementById('gTarget').value),
      deadline: document.getElementById('gDeadline').value,
      start: parseAmount(document.getElementById('gStart').value),
    };
    save(); render();
  });
}

// ---------- Ustawienia ----------

function renderSettings() {
  const rec = state.recurring;
  view.innerHTML = `
    <section class="panel">
      <h2>Stałe opłaty co miesiąc</h2>
      <p class="hint" style="margin:0 0 8px">Dopisują się same do każdego nowego miesiąca (np. czynsz, raty, prąd).</p>
      ${rec.length ? rec.map(r => `
        <div class="rec-row">
          <span class="ico">${CAT[r.cat]?.icon || '•'}</span>
          <span>${esc(r.name)}<br><small>${CAT[r.cat]?.name || ''} · ${r.day}. dnia miesiąca</small></span>
          <b>${fmt(r.amount)}</b>
          <button class="btn small" data-edit="${r.id}">Edytuj</button>
        </div>`).join('') : '<div class="empty">Brak stałych opłat.</div>'}
      <div class="btn-row">
        <button class="btn primary" id="recAdd">+ Dodaj stałą opłatę</button>
        ${rec.length ? `<button class="btn" id="recApply">Dodaj brakujące do: ${monthLabel(ui.month)}</button>` : ''}
      </div>
    </section>

    <section class="panel">
      <h2>Kopia zapasowa</h2>
      <p class="hint" style="margin:0 0 8px">Dane są zapisane tylko w tej przeglądarce na tym urządzeniu. Raz na jakiś czas zapisz kopię (np. w aplikacji Pliki lub na iCloud).</p>
      <div class="btn-row">
        <button class="btn" id="exportBtn">⬇️ Eksportuj kopię</button>
        <label class="btn" style="display:inline-flex;align-items:center">⬆️ Importuj kopię
          <input type="file" id="importFile" accept="application/json,.json" hidden>
        </label>
      </div>
    </section>

    <section class="panel">
      <h2>Wygląd</h2>
      <label class="field"><span>Motyw</span>
        <select id="theme">
          <option value="">Automatyczny (jak system)</option>
          <option value="light">Jasny</option>
          <option value="dark">Ciemny</option>
        </select>
      </label>
    </section>

    <section class="panel">
      <h2>Usuń dane</h2>
      <div class="btn-row" style="margin-top:0"><button class="btn danger" id="resetBtn">Usuń wszystkie dane</button></div>
    </section>`;

  document.getElementById('recAdd').addEventListener('click', () => openRecurringDialog());
  view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openRecurringDialog(b.dataset.edit)));
  document.getElementById('recApply')?.addEventListener('click', () => {
    const n = applyRecurring(ui.month);
    save();
    alert(n ? `Dodano ${n} ${n === 1 ? 'opłatę' : 'opłat(y)'}.` : 'Wszystkie stałe opłaty są już w tym miesiącu.');
  });
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importFile').addEventListener('change', importData);
  const theme = document.getElementById('theme');
  theme.value = getTheme();
  theme.addEventListener('change', () => setTheme(theme.value));
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Na pewno usunąć wszystkie dane? Tego nie da się cofnąć.')) {
      state = emptyState(); save(); render();
    }
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finanse-kopia-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data.months !== 'object') throw new Error();
      if (!confirm('Zastąpić obecne dane danymi z kopii?')) return;
      state = Object.assign(emptyState(), data);
      save(); render();
    } catch (e) {
      alert('To nie wygląda na plik kopii z tej aplikacji.');
    }
  };
  reader.readAsText(file);
}

function getTheme() {
  try { return localStorage.getItem('finanse-theme') || ''; } catch (e) { return ''; }
}
function setTheme(t) {
  try { localStorage.setItem('finanse-theme', t); } catch (e) { /* bez zapamiętywania */ }
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- Okna dialogowe ----------

const dialog = document.getElementById('dialog');
const dialogForm = document.getElementById('dialogForm');

function openDialog(html, onSubmit, bind) {
  dialogForm.innerHTML = html;
  dialogForm.onsubmit = ev => {
    ev.preventDefault();
    if (onSubmit(new FormData(dialogForm)) !== false) { dialog.close(); save(); render(); }
  };
  dialogForm.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  bind?.();
  dialog.showModal();
}

function catPicker(selected) {
  return `<div class="cat-picker">${CATEGORIES.map(c => `
    <label><input type="radio" name="cat" value="${c.id}" ${c.id === selected ? 'checked' : ''} required><span>${c.icon}</span>${c.name}</label>`).join('')}
  </div>`;
}

function defaultDate() {
  const today = todayISO();
  return today.startsWith(ui.month) ? today : ui.month + '-01';
}

function openExpenseDialog(id, presetCat) {
  const m = ensureMonth(ui.month);
  const e = id ? m.expenses.find(x => x.id === id) : null;
  openDialog(`
    <h3>${e ? 'Edytuj wydatek' : 'Nowy wydatek'}</h3>
    <label class="field"><span>Kwota (zł)</span>
      <input class="amount-input" type="text" inputmode="decimal" name="amount" value="${e ? numInput(e.amount) : ''}" placeholder="0,00" required autocomplete="off">
    </label>
    ${catPicker(e ? e.cat : presetCat)}
    <label class="field"><span>Opis (opcjonalnie)</span>
      <input type="text" name="note" value="${esc(e?.note)}" placeholder="np. Biedronka, karma, rata za telefon" autocomplete="off">
    </label>
    <label class="field"><span>Data</span>
      <input type="date" name="date" value="${e ? e.date : defaultDate()}" required>
    </label>
    <div class="dialog-actions">
      ${e ? '<button type="button" class="btn danger" id="delExp">Usuń</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Anuluj</button>
      <button type="submit" class="btn primary">Zapisz</button>
    </div>`,
  fd => {
    const amount = parseAmount(fd.get('amount'));
    if (amount <= 0) { alert('Podaj kwotę większą od zera.'); return false; }
    const date = fd.get('date');
    const key = date.slice(0, 7);
    const target = ensureMonth(key);
    const data = { cat: fd.get('cat'), amount, note: String(fd.get('note')).trim(), date };
    if (e) {
      Object.assign(e, data);
      if (key !== ui.month) { // przeniesiono do innego miesiąca
        m.expenses = m.expenses.filter(x => x !== e);
        target.expenses.push(e);
      }
    } else {
      target.expenses.push({ id: uid(), ...data });
    }
  },
  () => {
    document.getElementById('delExp')?.addEventListener('click', () => {
      if (!confirm('Usunąć ten wydatek?')) return;
      m.expenses = m.expenses.filter(x => x !== e);
      dialog.close(); save(); render();
    });
  });
}

function openPlanDialog(catId) {
  const m = ensureMonth(ui.month);
  const c = CAT[catId];
  const spent = spentByCat(m)[catId];
  openDialog(`
    <h3>${c.icon} ${c.name}</h3>
    <p class="hint" style="margin:0">Wydane w tym miesiącu: <b>${fmt(spent)}</b></p>
    <label class="field"><span>Plan na ${monthLabel(ui.month)} (zł)</span>
      <input class="amount-input" type="text" inputmode="decimal" name="plan" value="${numInput(m.plan[catId])}" placeholder="0" autocomplete="off">
    </label>
    <p class="hint" style="margin:0">Nowe miesiące kopiują plan z poprzedniego, więc wystarczy ustawić go raz.</p>
    <div class="dialog-actions">
      <button type="button" class="btn" id="addInCat">+ Dodaj wydatek</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Anuluj</button>
      <button type="submit" class="btn primary">Zapisz plan</button>
    </div>`,
  fd => { m.plan[catId] = parseAmount(fd.get('plan')); },
  () => {
    document.getElementById('addInCat').addEventListener('click', () => {
      dialog.close();
      openExpenseDialog(null, catId);
    });
  });
}

function openRecurringDialog(id) {
  const r = id ? state.recurring.find(x => x.id === id) : null;
  openDialog(`
    <h3>${r ? 'Edytuj stałą opłatę' : 'Nowa stała opłata'}</h3>
    <label class="field"><span>Nazwa</span>
      <input type="text" name="name" value="${esc(r?.name)}" placeholder="np. Czynsz, Rata za laptopa" required autocomplete="off">
    </label>
    <div class="form-grid">
      <label class="field"><span>Kwota (zł)</span>
        <input type="text" inputmode="decimal" name="amount" value="${r ? numInput(r.amount) : ''}" placeholder="0" required autocomplete="off">
      </label>
      <label class="field"><span>Dzień miesiąca</span>
        <input type="number" name="day" min="1" max="31" value="${r ? r.day : 10}" required>
      </label>
    </div>
    ${catPicker(r ? r.cat : 'czynsz')}
    <p class="hint" style="margin:0">Zmiana nie poprawia wydatków dodanych już we wcześniejszych miesiącach.</p>
    <div class="dialog-actions">
      ${r ? '<button type="button" class="btn danger" id="delRec">Usuń</button>' : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Anuluj</button>
      <button type="submit" class="btn primary">Zapisz</button>
    </div>`,
  fd => {
    const amount = parseAmount(fd.get('amount'));
    if (amount <= 0) { alert('Podaj kwotę większą od zera.'); return false; }
    const data = {
      name: String(fd.get('name')).trim(), cat: fd.get('cat'), amount,
      day: Math.min(31, Math.max(1, parseInt(fd.get('day'), 10) || 1)),
    };
    if (r) Object.assign(r, data);
    else {
      const rec = { id: uid(), ...data };
      state.recurring.push(rec);
      // od razu dopisz do bieżącego miesiąca kalendarzowego, jeśli już istnieje
      const now = monthKey(new Date());
      if (state.months[now]) applyRecurring(now);
    }
  },
  () => {
    document.getElementById('delRec')?.addEventListener('click', () => {
      if (!confirm('Usunąć stałą opłatę? Wydatki z poprzednich miesięcy zostaną.')) return;
      state.recurring = state.recurring.filter(x => x !== r);
      dialog.close(); save(); render();
    });
  });
}

// ---------- Start ----------

document.getElementById('tabs').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  render();
  scrollTo(0, 0);
});
document.getElementById('prevMonth').addEventListener('click', () => { ui.month = addMonths(ui.month, -1); render(); });
document.getElementById('nextMonth').addEventListener('click', () => { ui.month = addMonths(ui.month, 1); render(); });
document.getElementById('addExpense').addEventListener('click', () => openExpenseDialog());
document.addEventListener('pointerdown', ev => { if (!ev.target.closest('[data-tip]')) hideTooltip(); });

setTheme(getTheme());
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
