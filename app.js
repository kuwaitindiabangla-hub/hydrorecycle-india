'use strict';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const STORAGE_THEME = 'hydrorecycle-theme';
const STORAGE_HISTORY = 'hydrorecycle-lab-history';
let DATA = [];

const fmt = (value, digits = 0) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const num = (value) => Number(value || 0);
const processingGap = (row) => Math.max(0, num(row.waste_generated_tpd) - num(row.waste_processed_tpd));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function setTheme(theme, persist = true) {
  const chosen = theme === 'light' ? 'light' : 'dark';
  root.dataset.theme = chosen;
  const toggle = $('themeToggle');
  const text = $('themeText');
  if (toggle) toggle.setAttribute('aria-label', chosen === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  if (text) text.textContent = chosen === 'dark' ? 'Dark' : 'Light';
  if (persist) {
    try { localStorage.setItem(STORAGE_THEME, chosen); } catch (_) {}
  }
}

function initTheme() {
  let theme = root.dataset.theme || 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (_) {}
  setTheme(theme, false);
  $('themeToggle')?.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'));
}

function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const parseLine = (line) => {
    const values = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === ',' && !quoted) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    return values;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((header, index) => {
      const raw = values[index] ?? '';
      row[header] = raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    });
    return row;
  }).filter((row) => row.state);
}

async function loadData() {
  const status = $('dataStatus');
  try {
    const response = await fetch('./data/state_data.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Dataset request failed (${response.status})`);
    const text = await response.text();
    DATA = parseCSV(text);
    if (!DATA.length) throw new Error('The dataset is empty.');
    status.textContent = `${DATA.length} rows ready`;
    $('aboutStates').textContent = DATA.length;
  } catch (error) {
    DATA = [];
    status.textContent = 'Dataset unavailable';
    console.error(error);
    showEmptyState('The dataset could not be loaded. Check that data/state_data.csv exists.');
  }
}

function showEmptyState(message) {
  ['kpis','wasteChart','collectionChart','insights','stateResult','comparisonResult','gapTable','tableBody'].forEach((id) => {
    const node = $(id);
    if (node) node.innerHTML = id === 'tableBody' ? `<tr><td colspan="7" class="empty">${escapeHtml(message)}</td></tr>` : `<div class="empty">${escapeHtml(message)}</div>`;
  });
  if ($('rowCount')) $('rowCount').textContent = '0 rows';
}

function renderKpis() {
  const generated = DATA.reduce((sum, row) => sum + num(row.waste_generated_tpd), 0);
  const collected = DATA.reduce((sum, row) => sum + num(row.waste_collected_tpd), 0);
  const processed = DATA.reduce((sum, row) => sum + num(row.waste_processed_tpd), 0);
  const collectionRate = generated ? (collected / generated) * 100 : 0;
  const processingRate = generated ? (processed / generated) * 100 : 0;
  const gap = Math.max(0, generated - processed);
  const cards = [
    ['♻', 'TOTAL WASTE GENERATED', fmt(generated), 'TPD · Across India'],
    ['▱', 'TOTAL WASTE COLLECTED', fmt(collected), `${pct(collectionRate)} collection efficiency`],
    ['◈', 'TOTAL WASTE PROCESSED', fmt(processed), `${pct(processingRate)} processing efficiency`],
    ['▥', 'PROCESSING GAP', fmt(gap), 'TPD · Generated − processed'],
    ['⌖', 'STATES & UTs', fmt(DATA.length), 'Rows included in dataset']
  ];
  $('kpis').innerHTML = cards.map((card) => `<article class="kpi"><div class="kpi-icon">${card[0]}</div><small>${card[1]}</small><div class="num">${card[2]}</div><div class="sub">${card[3]}</div></article>`).join('');
}

function drawBars(targetId, items, valueKey, formatter, maxValue, compact = false) {
  const target = $(targetId);
  if (!target) return;
  if (!items.length) { target.innerHTML = '<div class="empty">No data available.</div>'; return; }
  const max = maxValue || Math.max(...items.map((row) => num(row[valueKey])), 1);
  target.innerHTML = items.map((row) => {
    const value = num(row[valueKey]);
    const width = Math.max(value > 0 ? 2 : 0, (value / max) * 100);
    return `<div class="bar-row${compact ? ' compact' : ''}"><div class="bar-label" title="${escapeHtml(row.state)}">${escapeHtml(row.state)}</div><div class="bar-track"><div class="bar-fill" style="width:${width.toFixed(2)}%"></div></div><div class="bar-value">${formatter(value)}</div></div>`;
  }).join('');
}

function renderCharts() {
  drawBars('wasteChart', [...DATA].sort((a,b) => num(b.waste_generated_tpd) - num(a.waste_generated_tpd)).slice(0,10), 'waste_generated_tpd', (v) => fmt(v), null, false);
  drawBars('collectionChart', [...DATA].sort((a,b) => num(b.collection_efficiency_pct) - num(a.collection_efficiency_pct)).slice(0,10), 'collection_efficiency_pct', pct, 100, true);
}

function renderInsights() {
  const highest = [...DATA].sort((a,b) => num(b.waste_generated_tpd) - num(a.waste_generated_tpd))[0];
  const bestCollection = [...DATA].sort((a,b) => num(b.collection_efficiency_pct) - num(a.collection_efficiency_pct))[0];
  const lowestProcessing = [...DATA].sort((a,b) => num(a.processing_efficiency_pct) - num(b.processing_efficiency_pct))[0];
  const overallGenerated = DATA.reduce((sum,row) => sum + num(row.waste_generated_tpd), 0);
  const overallProcessed = DATA.reduce((sum,row) => sum + num(row.waste_processed_tpd), 0);
  const overallRate = overallGenerated ? overallProcessed / overallGenerated * 100 : 0;
  const insights = [
    ['✓','', `${highest.state} generates the most waste`, `${fmt(highest.waste_generated_tpd)} TPD in the dataset.`],
    ['i','blue', `${bestCollection.state} has the highest collection efficiency`, `${pct(bestCollection.collection_efficiency_pct)} listed collection efficiency.`],
    ['!','amber', `${lowestProcessing.state} has the lowest processing efficiency`, `${pct(lowestProcessing.processing_efficiency_pct)} listed processing efficiency.`],
    ['↗','purple', `India processes ${pct(overallRate)} of generated waste`, `${fmt(overallProcessed)} TPD processed out of ${fmt(overallGenerated)} TPD generated.`]
  ];
  $('insights').innerHTML = insights.map((item) => `<div class="insight"><span class="insight-icon ${item[1]}">${item[0]}</span><div><b>${escapeHtml(item[2])}</b><p>${escapeHtml(item[3])}</p></div></div>`).join('');
}

function makeOptions(includeBlank = false) {
  const first = includeBlank ? '<option value="">Choose a state…</option>' : '';
  return first + DATA.map((row) => `<option value="${escapeHtml(row.state)}">${escapeHtml(row.state)}</option>`).join('');
}

function renderStateSelectors() {
  const selects = [$('stateSelect'), $('stateSelectA'), $('stateSelectB')];
  selects.forEach((select) => { if (select) select.innerHTML = makeOptions(); });
  if (!DATA.length) return;
  $('stateSelect').value = DATA[0].state;
  $('stateSelectA').value = DATA[0].state;
  $('stateSelectB').value = DATA[Math.min(1, DATA.length - 1)].state;
  renderState();
  renderComparison();
}

function mini(title, value, unit = '', progress = null) {
  const bar = progress === null ? '' : `<div class="progress"><i style="width:${Math.min(100, Math.max(0, progress))}%"></i></div>`;
  return `<div class="mini"><small>${title}</small><b>${value}</b><span>${unit}</span>${bar}</div>`;
}

function renderState() {
  const state = $('stateSelect')?.value;
  const row = DATA.find((item) => item.state === state);
  if (!row) { $('stateResult').innerHTML = ''; return; }
  const collection = num(row.collection_efficiency_pct);
  const processing = num(row.processing_efficiency_pct);
  $('selectedSummary').innerHTML = `<b>${escapeHtml(row.state)}</b>&nbsp; · &nbsp;${fmt(row.waste_generated_tpd)} TPD generated&nbsp; · &nbsp;${pct(processing)} processing efficiency`;
  $('stateResult').innerHTML = `<div class="state-grid">
    ${mini('GENERATED', fmt(row.waste_generated_tpd), 'TPD')}
    ${mini('COLLECTED', fmt(row.waste_collected_tpd), 'TPD')}
    ${mini('PROCESSED', fmt(row.waste_processed_tpd), 'TPD')}
    ${mini('COLLECTION', pct(collection), 'efficiency', collection)}
    ${mini('PROCESSING', pct(processing), 'efficiency', processing)}
  </div>`;
}

function renderComparison() {
  const a = DATA.find((item) => item.state === $('stateSelectA')?.value);
  const b = DATA.find((item) => item.state === $('stateSelectB')?.value);
  if (!a || !b || a.state === b.state) {
    $('comparisonResult').innerHTML = '<div class="empty">Choose two different states to compare.</div>';
    return;
  }
  const rows = [
    ['Generated / day', num(a.waste_generated_tpd), num(b.waste_generated_tpd), (v) => `${fmt(v)} TPD`, false],
    ['Collected / day', num(a.waste_collected_tpd), num(b.waste_collected_tpd), (v) => `${fmt(v)} TPD`, false],
    ['Processed / day', num(a.waste_processed_tpd), num(b.waste_processed_tpd), (v) => `${fmt(v)} TPD`, false],
    ['Collection efficiency', num(a.collection_efficiency_pct), num(b.collection_efficiency_pct), pct, false],
    ['Processing efficiency', num(a.processing_efficiency_pct), num(b.processing_efficiency_pct), pct, false],
    ['Processing gap / day', processingGap(a), processingGap(b), (v) => `${fmt(v)} TPD`, true]
  ];
  $('comparisonResult').innerHTML = `<div class="table-wrap"><table class="compare-table"><thead><tr><th>Metric</th><th>${escapeHtml(a.state)}</th><th>${escapeHtml(b.state)}</th></tr></thead><tbody>${rows.map((r) => {
    const aBetter = r[4] ? r[1] < r[2] : r[1] > r[2];
    const bBetter = r[4] ? r[2] < r[1] : r[2] > r[1];
    return `<tr><td>${r[0]}</td><td class="${aBetter ? 'winner' : ''}">${r[3](r[1])}</td><td class="${bBetter ? 'winner' : ''}">${r[3](r[2])}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderGapTable() {
  const rows = [...DATA].sort((a,b) => processingGap(b) - processingGap(a)).slice(0,8);
  const maxGap = Math.max(...rows.map(processingGap), 1);
  $('gapTable').innerHTML = rows.map((row, index) => {
    const gap = processingGap(row);
    const gapPct = num(row.waste_generated_tpd) ? gap / num(row.waste_generated_tpd) * 100 : 0;
    return `<div class="gap-row"><span class="gap-rank">${String(index + 1).padStart(2,'0')}</span><span class="gap-name">${escapeHtml(row.state)}</span><div class="gap-track"><div class="gap-fill" style="width:${(gap / maxGap * 100).toFixed(2)}%"></div></div><span class="gap-number">${fmt(gap)} TPD</span><span class="gap-percent">${pct(gapPct)}</span></div>`;
  }).join('');
}

function renderTable() {
  const query = ($('tableSearch')?.value || '').trim().toLowerCase();
  const sort = $('tableSort')?.value || 'state';
  const sorters = {
    state: (a,b) => a.state.localeCompare(b.state),
    'generated-desc': (a,b) => num(b.waste_generated_tpd) - num(a.waste_generated_tpd),
    'processed-desc': (a,b) => num(b.waste_processed_tpd) - num(a.waste_processed_tpd),
    'collection-desc': (a,b) => num(b.collection_efficiency_pct) - num(a.collection_efficiency_pct),
    'processing-desc': (a,b) => num(b.processing_efficiency_pct) - num(a.processing_efficiency_pct),
    'gap-desc': (a,b) => processingGap(b) - processingGap(a)
  };
  const rows = DATA.filter((row) => row.state.toLowerCase().includes(query)).sort(sorters[sort] || sorters.state);
  $('rowCount').textContent = `${rows.length} of ${DATA.length} states`;
  $('tableBody').innerHTML = rows.length ? rows.map((row) => `<tr><td><strong>${escapeHtml(row.state)}</strong></td><td>${fmt(row.waste_generated_tpd)}</td><td>${fmt(row.waste_collected_tpd)}</td><td>${fmt(row.waste_processed_tpd)}</td><td class="eff-good">${pct(row.collection_efficiency_pct)}</td><td class="eff-good">${pct(row.processing_efficiency_pct)}</td><td class="gap-cell">${fmt(processingGap(row))}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">No matching state or UT.</td></tr>';
}

function readLabInputs() {
  return {
    initial: num($('initial')?.value), final: num($('final')?.value), mass: num($('mass')?.value), time: num($('time')?.value),
    sd: num($('sd')?.value), od: num($('od')?.value), force: num($('force')?.value)
  };
}

function calculateLab(values) {
  const inputArea = Math.PI * Math.pow(values.sd / 2000, 2);
  const outputArea = Math.PI * Math.pow(values.od / 2000, 2);
  const pressure = values.force / inputArea;
  const outputForce = pressure * outputArea;
  return {
    compression: ((values.initial - values.final) / values.initial) * 100,
    throughput: values.mass / values.time,
    pressureKpa: pressure / 1000,
    outputForce,
    multiplication: outputArea / inputArea
  };
}

function renderLabResult(result) {
  $('labResult').innerHTML = `<div class="lab-hero">${pct(result.compression)}</div><div class="lab-sub">compression efficiency</div><div class="result-grid">
    ${resultBox('THROUGHPUT', `${result.throughput.toFixed(2)} g/s`)}
    ${resultBox('INPUT PRESSURE', `${result.pressureKpa.toFixed(2)} kPa`)}
    ${resultBox('IDEAL OUTPUT FORCE', `${result.outputForce.toFixed(2)} N`)}
    ${resultBox('FORCE MULTIPLICATION', `${result.multiplication.toFixed(2)}×`)}
  </div><div class="formula"><b>Model:</b> pressure = force ÷ input area · ideal output force = pressure × output area</div>`;
}

function resultBox(title, value) { return `<div class="result-box"><small>${title}</small><b>${value}</b></div>`; }

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}

function saveHistory(result) {
  const history = readHistory();
  history.unshift({...result, time: new Date().toLocaleString()});
  try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 8))); } catch (_) {}
  renderHistory();
}

function renderHistory() {
  const history = readHistory();
  $('history').innerHTML = history.length ? history.map((item) => `<div class="history-row"><strong>${pct(item.compression)}</strong><span>${Number(item.throughput).toFixed(2)} g/s</span><span>${Number(item.pressureKpa).toFixed(2)} kPa</span><span>${Number(item.outputForce).toFixed(2)} N</span><span>${escapeHtml(item.time || '')}</span></div>`).join('') : '<div class="empty">No saved calculations yet. Run the calculator to create one.</div>';
}

function runLab(save = true) {
  const values = readLabInputs();
  const error = $('labError');
  error.textContent = '';
  if (Object.values(values).some((value) => !Number.isFinite(value) || value <= 0)) {
    error.textContent = 'Please enter positive values in every field.';
    return false;
  }
  if (values.final > values.initial) {
    error.textContent = 'Final volume cannot be greater than initial volume.';
    return false;
  }
  const result = calculateLab(values);
  renderLabResult(result);
  if (save) saveHistory(result);
  return true;
}

function resetLab() {
  const defaults = {initial:1000, final:650, mass:100, time:50, sd:20, od:40, force:10};
  Object.entries(defaults).forEach(([id,value]) => { if ($(id)) $(id).value = value; });
  $('labError').textContent = '';
  runLab(false);
}

function setupNavigation() {
  const sidebar = $('sidebar');
  $('menuToggle')?.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    $('menuToggle').setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.side-nav a').forEach((link) => link.addEventListener('click', () => sidebar.classList.remove('open')));

  const links = [...document.querySelectorAll('.side-nav a')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
  }, {rootMargin:'-25% 0px -65% 0px', threshold:[0,.1,.5]});
  sections.forEach((section) => observer.observe(section));
}

function setupSearch() {
  $('globalSearch')?.addEventListener('input', (event) => {
    const query = event.target.value.trim();
    $('tableSearch').value = query;
    renderTable();
    if (query) document.querySelector('#data')?.scrollIntoView({behavior:'smooth'});
  });
  $('tableSearch')?.addEventListener('input', renderTable);
  $('tableSort')?.addEventListener('change', renderTable);
}

function init() {
  initTheme();
  setupNavigation();
  setupSearch();
  $('stateSelect')?.addEventListener('change', renderState);
  $('stateSelectA')?.addEventListener('change', renderComparison);
  $('stateSelectB')?.addEventListener('change', renderComparison);
  $('runLab')?.addEventListener('click', () => runLab(true));
  $('resetLab')?.addEventListener('click', resetLab);
  $('clearHistory')?.addEventListener('click', () => { try { localStorage.removeItem(STORAGE_HISTORY); } catch (_) {} renderHistory(); });
  renderHistory();
  runLab(false);

  loadData().then(() => {
    if (!DATA.length) return;
    renderKpis();
    renderCharts();
    renderInsights();
    renderStateSelectors();
    renderGapTable();
    renderTable();
  });
}

document.addEventListener('DOMContentLoaded', init);
