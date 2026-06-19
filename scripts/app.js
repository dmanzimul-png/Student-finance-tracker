import { validate } from './validator.js';
import { records, settings, addRecord, updateRecord, deleteRecord, setRecords, updateSettings, nextId } from './state.js';
import { renderTable, renderEditRow, renderDashboard, setStatus, formatAmount, applyFieldState } from './ui.js';
import { compileRegex } from './search.js';
import { exportJSON, importJSON } from './storage.js';

let sortKey  = 'date';
let sortDir  = -1;   // newest first on load
let searchRe = null;

// ── Filtered + sorted view ────────────────────────────────────────────────────
function getFiltered() {
  let list = [...records];
  if (searchRe) {
    list = list.filter(r => {
      try {
        return searchRe.test(r.description) ||
               searchRe.test(r.category)    ||
               searchRe.test(String(r.amount));
      } catch {
        return false;
      }
    });
  }
  list.sort((a, b) => {
    const av = sortKey === 'amount' ? Number(a.amount) : String(a[sortKey] ?? '');
    const bv = sortKey === 'amount' ? Number(b.amount) : String(b[sortKey] ?? '');
    if (av < bv) return -sortDir;
    if (av > bv) return  sortDir;
    return 0;
  });
  return list;
}

function refresh() {
  try {
    const filtered = getFiltered();
    renderTable(filtered, searchRe, startEdit, confirmDelete);
    applyAmounts();
    renderDashboard(records, settings);
    updateSearchCount(filtered.length);
  } catch (e) {
    console.error('refresh error:', e);
    setStatus('An unexpected error occurred while updating the view.', 'assertive');
  }
}

function applyAmounts() {
  document.querySelectorAll('.amount-cell[data-raw]').forEach(td => {
    const raw = parseFloat(td.dataset.raw);
    if (!isNaN(raw)) td.textContent = formatAmount(raw, settings);
  });
}

function updateSearchCount(count) {
  const el = document.getElementById('result-count');
  if (el) el.textContent = searchRe ? `${count} result${count !== 1 ? 's' : ''}` : '';
}

// ── Form helpers ──────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showFieldError(id, msg) {
  const el = $(id);
  if (!el) return;
  applyFieldState(id, !!msg);
  const errEl = $(`${id}-error`);
  if (errEl) errEl.textContent = msg || '';
}

function clearForm() {
  const form = $('transaction-form');
  if (!form) return;
  form.reset();
  ['description', 'amount', 'category', 'date'].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove('error', 'success');
    const errEl = $(`${id}-error`);
    if (errEl) errEl.textContent = '';
  });
}

// ── Add Transaction ───────────────────────────────────────────────────────────
const form = $('transaction-form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();

    const fields = {
      description: $('description')?.value ?? '',
      amount:      ($('amount')?.value ?? '').trim(),
      category:    $('category')?.value ?? '',
      date:        $('date')?.value ?? ''
    };

    const errors = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, validate(k, v)])
    );

    Object.entries(errors).forEach(([id, msg]) => showFieldError(id, msg));

    if (Object.values(errors).some(Boolean)) {
      const first = Object.keys(errors).find(k => errors[k]);
      if (first) $(first)?.focus();
      return;
    }

    const now = new Date().toISOString();
    const ok  = addRecord({
      id:          nextId(),
      description: fields.description.trim(),
      amount:      parseFloat(fields.amount),
      category:    fields.category,
      date:        fields.date,
      createdAt:   now,
      updatedAt:   now
    });

    if (!ok) { setStatus('Failed to save transaction.', 'assertive'); return; }

    clearForm();
    setStatus('✓ Transaction added successfully!');
    refresh();
  });
}

// ── Real-time inline validation ───────────────────────────────────────────────
['description', 'amount', 'date'].forEach(id => {
  $(id)?.addEventListener('blur', e => {
    showFieldError(id, validate(id, e.target.value.trim()));
  });
});

// ── Edit ──────────────────────────────────────────────────────────────────────
function startEdit(id) {
  const r = records.find(x => x.id === id);
  if (!r) { setStatus('Record not found.', 'assertive'); return; }
  renderEditRow(r, saveEdit, () => refresh());
}

function saveEdit(id, patch) {
  // patch.amount arrives as a raw string from the input
  const fields = {
    description: String(patch.description ?? ''),
    amount:      String(patch.amount ?? ''),
    category:    String(patch.category ?? ''),
    date:        String(patch.date ?? '')
  };

  const errors  = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, validate(k, v)]));
  const errMsgs = Object.values(errors).filter(Boolean);

  if (errMsgs.length) {
    setStatus(`Cannot save: ${errMsgs[0]}`, 'assertive');
    return;
  }

  const ok = updateRecord(id, {
    description: fields.description,
    amount:      parseFloat(fields.amount),
    category:    fields.category,
    date:        fields.date
  });

  if (!ok) { setStatus('Record not found.', 'assertive'); return; }
  setStatus('✓ Transaction updated.');
  refresh();
}

// ── Delete ────────────────────────────────────────────────────────────────────
function confirmDelete(id) {
  const r = records.find(x => x.id === id);
  if (!r) { setStatus('Record not found.', 'assertive'); return; }
  if (!confirm(`Delete "${r.description}"?\nThis cannot be undone.`)) return;
  const ok = deleteRecord(id);
  if (!ok) { setStatus('Could not delete record.', 'assertive'); return; }
  setStatus('Transaction deleted.');
  refresh();
}

// ── Escape key cancels active inline edit ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const cancelBtn = document.querySelector('.btn-cancel');
    if (cancelBtn) { e.preventDefault(); cancelBtn.click(); }
  }
});

// ── Search ────────────────────────────────────────────────────────────────────
const searchInput  = $('search');
const caseToggle   = $('case-toggle');
const searchStatus = $('search-status');

function doSearch() {
  const val = searchInput?.value.trim() ?? '';

  if (!val) {
    searchRe = null;
    if (searchStatus) { searchStatus.textContent = ''; searchStatus.style.color = ''; }
    refresh();
    return;
  }

  const flags = caseToggle?.checked ? 'g' : 'gi';
  searchRe    = compileRegex(val, flags);

  if (searchStatus) {
    if (!searchRe) {
      searchStatus.textContent = '⚠ Invalid regex — showing all records.';
      searchStatus.style.color = 'var(--danger)';
      searchRe = null;
    } else {
      searchStatus.textContent = `Pattern: /${val}/${caseToggle?.checked ? '' : 'i'}`;
      searchStatus.style.color = '';
    }
  }
  refresh();
}

searchInput?.addEventListener('input', doSearch);
caseToggle?.addEventListener('change', doSearch);

// ── Sort ──────────────────────────────────────────────────────────────────────
// Sync initial aria-sort with sortDir=-1 on date column
document.querySelector('[data-sort="date"]')
  ?.closest('th')?.setAttribute('aria-sort', 'descending');

document.querySelectorAll('[data-sort]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    sortDir = (sortKey === key) ? sortDir * -1 : 1;
    sortKey = key;
    document.querySelectorAll('th[data-sort-col]').forEach(th => th.removeAttribute('aria-sort'));
    btn.closest('th')?.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
    refresh();
  });
});

// ── Settings ──────────────────────────────────────────────────────────────────
function loadSettingsUI() {
  const capEl = $('budget-cap');
  const curEl = $('currency-select');
  const eurEl = $('rate-eur');
  const gbpEl = $('rate-gbp');
  if (capEl) capEl.value = settings.budgetCap;
  if (curEl) curEl.value = settings.currency;
  if (eurEl) eurEl.value = settings.rates.EUR;
  if (gbpEl) gbpEl.value = settings.rates.GBP;
}

$('save-settings')?.addEventListener('click', () => {
  const capVal = $('budget-cap')?.value ?? '';
  const eurVal = $('rate-eur')?.value   ?? '';
  const gbpVal = $('rate-gbp')?.value   ?? '';
  const currency = $('currency-select')?.value ?? 'USD';

  const cap = parseFloat(capVal);
  const eur = parseFloat(eurVal);
  const gbp = parseFloat(gbpVal);

  const errs = [];
  if (!capVal.trim() || isNaN(cap) || cap < 0)  errs.push('Budget cap must be 0 or a positive number.');
  if (!eurVal.trim() || isNaN(eur) || eur <= 0)  errs.push('EUR rate must be greater than 0.');
  if (!gbpVal.trim() || isNaN(gbp) || gbp <= 0)  errs.push('GBP rate must be greater than 0.');

  if (errs.length) { setStatus(errs[0], 'assertive'); return; }

  updateSettings({ budgetCap: cap, currency, rates: { EUR: eur, GBP: gbp } });
  setStatus('✓ Settings saved.');
  refresh();
});

// ── Export ────────────────────────────────────────────────────────────────────
$('export-btn')?.addEventListener('click', () => {
  if (!records.length) { setStatus('No records to export.', 'assertive'); return; }
  try {
    exportJSON(records);
    setStatus(`✓ Exported ${records.length} record${records.length !== 1 ? 's' : ''}.`);
  } catch (err) {
    setStatus(String(err), 'assertive');
  }
});

// ── Import ────────────────────────────────────────────────────────────────────
$('import-input')?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.json')) {
    setStatus('Please select a .json file.', 'assertive');
    e.target.value = '';
    return;
  }

  try {
    const data = await importJSON(file);
    setRecords(data);
    setStatus(`✓ Imported ${data.length} record${data.length !== 1 ? 's' : ''}.`);
    refresh();
  } catch (err) {
    setStatus(`Import failed: ${err}`, 'assertive');
  }
  e.target.value = '';
});

document.querySelector('.import-label')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('import-input')?.click();
  }
});

// ── Hamburger nav toggle ──────────────────────────────────────────────────────
const navToggle = document.querySelector('.nav-toggle');
const navMenu   = $('nav-menu');

navToggle?.addEventListener('click', () => {
  const isOpen = navMenu.classList.contains('nav-open');
  navMenu.classList.toggle('nav-open', !isOpen);
  navToggle.setAttribute('aria-expanded', String(!isOpen));
});

navMenu?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    if (window.innerWidth < 768) {
      navMenu.classList.remove('nav-open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  });
});

document.addEventListener('click', e => {
  if (window.innerWidth < 768 &&
      navMenu?.classList.contains('nav-open') &&
      !navMenu.contains(e.target) &&
      !navToggle?.contains(e.target)) {
    navMenu.classList.remove('nav-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }
});

// ── Nav smooth scroll + active state ─────────────────────────────────────────
document.querySelectorAll('nav a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
    a.classList.add('active');
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.focus({ preventScroll: true });
    }
  });
});

const sections = document.querySelectorAll('main section[id]');
const navLinks  = document.querySelectorAll('nav a[href^="#"]');
const observer  = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(l =>
        l.classList.toggle('active', l.getAttribute('href') === `#${entry.target.id}`)
      );
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(s => observer.observe(s));

// ── Init ──────────────────────────────────────────────────────────────────────
loadSettingsUI();
refresh();
