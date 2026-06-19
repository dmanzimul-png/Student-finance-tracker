import { highlight, escapeHtml } from './search.js';

// ── Table ─────────────────────────────────────────────────────────────────────
export function renderTable(records, re, onEdit, onDelete) {
  const tbody = document.getElementById('transaction-body');
  if (!tbody) return;

  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No transactions yet — add one above!</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => {
    const safeDesc = escapeHtml(r.description);
    const safeId   = escapeHtml(r.id);
    const amount   = isFinite(Number(r.amount)) ? r.amount : 0;
    return `
    <tr data-id="${safeId}">
      <td data-label="Description">${highlight(r.description, re)}</td>
      <td data-label="Amount" class="amount-cell" data-raw="${amount}">${amount}</td>
      <td data-label="Category">${highlight(r.category, re)}</td>
      <td data-label="Date">${escapeHtml(r.date)}</td>
      <td data-label="Actions" class="actions">
        <button class="btn-edit"   data-id="${safeId}" aria-label="Edit ${safeDesc}">Edit</button>
        <button class="btn-delete" data-id="${safeId}" aria-label="Delete ${safeDesc}">Delete</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', () => onEdit(btn.dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', () => onDelete(btn.dataset.id)));
}

// ── Edit row ──────────────────────────────────────────────────────────────────
export function renderEditRow(r, onSave, onCancel) {
  const row = document.querySelector(`tr[data-id="${escapeHtml(r.id)}"]`);
  if (!row) return;

  row.innerHTML = `
    <td data-label="Description">
      <input class="edit-desc" value="${escapeHtml(r.description)}" aria-label="Edit description">
    </td>
    <td data-label="Amount">
      <input class="edit-amount" type="number" step="0.01" min="0"
             value="${isFinite(Number(r.amount)) ? r.amount : ''}" aria-label="Edit amount">
    </td>
    <td data-label="Category">
      <input class="edit-cat" value="${escapeHtml(r.category)}" aria-label="Edit category">
    </td>
    <td data-label="Date">
      <input class="edit-date" type="date" value="${escapeHtml(r.date)}" aria-label="Edit date">
    </td>
    <td data-label="Actions" class="actions">
      <button class="btn-save">Save</button>
      <button class="btn-cancel">Cancel</button>
    </td>`;

  row.querySelector('.btn-save').addEventListener('click', () => {
    const amtRaw = row.querySelector('.edit-amount').value;
    const patch  = {
      description: row.querySelector('.edit-desc').value.trim(),
      amount:      amtRaw,           // pass raw string so validate() can check it
      category:    row.querySelector('.edit-cat').value.trim(),
      date:        row.querySelector('.edit-date').value
    };
    onSave(r.id, patch);
  });

  row.querySelector('.btn-cancel').addEventListener('click', onCancel);
  row.querySelector('.edit-desc')?.focus();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function renderDashboard(records, settings) {
  const sum = records.reduce((a, r) => {
    const n = Number(r.amount);
    return a + (isFinite(n) ? n : 0);
  }, 0);

  const catCount = {};
  records.forEach(r => {
    if (r.category) catCount[r.category] = (catCount[r.category] || 0) + 1;
  });
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const totalEl    = document.getElementById('total-transactions');
  const spendingEl = document.getElementById('total-spending');
  const topCatEl   = document.getElementById('top-category');

  if (totalEl)    totalEl.textContent    = records.length;
  if (spendingEl) spendingEl.textContent = formatAmount(sum, settings);
  if (topCatEl)   topCatEl.textContent   = topCat;

  renderCap(sum, settings);
  renderChart(records, settings);
}

function renderCap(sum, settings) {
  const el  = document.getElementById('cap-status');
  if (!el) return;
  const cap = Number(settings.budgetCap);
  if (!cap || !isFinite(cap)) {
    el.textContent = 'No budget cap set.';
    el.className   = 'cap-none';
    el.setAttribute('aria-live', 'polite');
    return;
  }
  const remaining = cap - sum;
  if (remaining >= 0) {
    el.setAttribute('aria-live', 'polite');
    el.textContent = `${formatAmount(remaining, settings)} remaining of ${formatAmount(cap, settings)} monthly budget.`;
    el.className   = 'cap-ok';
  } else {
    el.setAttribute('aria-live', 'assertive');
    el.textContent = `⚠ Over budget by ${formatAmount(Math.abs(remaining), settings)}!`;
    el.className   = 'cap-over';
  }
}

function renderChart(records, settings) {
  const chart = document.getElementById('chart-bars');
  if (!chart) return;

  const days   = last7Days();
  const totals = days.map(d =>
    records
      .filter(r => r.date === d)
      .reduce((s, r) => {
        const n = Number(r.amount);
        return s + (isFinite(n) ? n : 0);
      }, 0)
  );
  const max = Math.max(...totals, 1);

  if (totals.every(t => t === 0)) {
    chart.innerHTML = '<p class="chart-empty">No spending in the last 7 days.</p>';
    return;
  }

  chart.innerHTML = days.map((d, i) => `
    <div class="bar-wrap">
      <span class="bar-amount">${totals[i] > 0 ? formatAmount(totals[i], settings) : ''}</span>
      <div class="bar" style="height:${Math.round((totals[i] / max) * 100)}%"
           role="img" aria-label="${escapeHtml(d)}: ${formatAmount(totals[i], settings)}"></div>
      <span class="bar-label">${escapeHtml(d.slice(5))}</span>
    </div>`).join('');
}

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
export function formatAmount(n, settings) {
  const num  = Number(n);
  if (!isFinite(num)) return '—';
  const syms = { USD: '$', EUR: '€', GBP: '£' };
  const sym  = syms[settings?.currency] || '$';
  const rate = settings?.currency === 'USD' ? 1 : (settings?.rates?.[settings.currency] ?? 1);
  return `${sym}${(num * rate).toFixed(2)}`;
}

export function setStatus(msg, type = 'polite') {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.setAttribute('aria-live', type);
  el.textContent = msg;
  el.classList.toggle('status-error', type === 'assertive');
  el.style.display = msg ? 'block' : 'none';
  if (msg) {
    setTimeout(() => {
      el.textContent = '';
      el.style.display = 'none';
      el.classList.remove('status-error');
    }, 4000);
  }
}

export function applyFieldState(id, hasError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('error',   hasError);
  el.classList.toggle('success', !hasError);
}
