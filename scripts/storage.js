const KEY          = 'sft:records';
const SETTINGS_KEY = 'sft:settings';

// ── Records ───────────────────────────────────────────────────────────────────
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Not an array');
    return data;
  } catch (e) {
    console.warn('sft: corrupted records in localStorage — resetting.', e);
    localStorage.removeItem(KEY);
    return [];
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // surface to user via a DOM alert banner
      _showStorageWarning('Storage is full — oldest records may not be saved. Please export and clear some data.');
    }
    console.error('sft: storage save failed', e);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return _defaultSettings();
    const s = JSON.parse(raw);
    // validate shape
    if (typeof s !== 'object' || s === null) throw new Error('Bad shape');
    if (typeof s.budgetCap !== 'number')     s.budgetCap = 500;
    if (!['USD','EUR','GBP'].includes(s.currency)) s.currency = 'USD';
    if (!s.rates || typeof s.rates !== 'object') s.rates = { EUR: 0.92, GBP: 0.79 };
    return s;
  } catch (e) {
    console.warn('sft: corrupted settings — resetting.', e);
    localStorage.removeItem(SETTINGS_KEY);
    return _defaultSettings();
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (e) {
    console.error('sft: settings save failed', e);
  }
}

function _defaultSettings() {
  return { budgetCap: 500, currency: 'USD', rates: { EUR: 0.92, GBP: 0.79 } };
}

// ── Export ────────────────────────────────────────────────────────────────────
export function exportJSON(data) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error('sft: export failed', e);
    throw new Error('Export failed — please try again.');
  }
}

// ── Import ────────────────────────────────────────────────────────────────────
export function importJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) return reject('File is empty.');
    if (file.size > 5 * 1024 * 1024) return reject('File too large (max 5 MB).');

    const reader = new FileReader();
    reader.onerror = () => reject('Could not read the file. It may be corrupted.');

    reader.onload = e => {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch {
        return reject('File is not valid JSON. Please check the file and try again.');
      }

      if (!Array.isArray(data))
        return reject('Invalid format: JSON root must be an array of records.');

      if (data.length === 0)
        return reject('The file contains no records.');

      const REQUIRED = ['id', 'description', 'amount', 'category', 'date'];
      const seenIds  = new Set();

      for (let i = 0; i < data.length; i++) {
        const r   = data[i];
        const num = i + 1;

        if (typeof r !== 'object' || r === null)
          return reject(`Record ${num}: expected an object, got ${typeof r}.`);

        for (const key of REQUIRED) {
          if (r[key] === null || r[key] === undefined || String(r[key]).trim() === '')
            return reject(`Record ${num}: missing or empty field "${key}".`);
        }

        if (seenIds.has(r.id))
          return reject(`Record ${num}: duplicate id "${r.id}".`);
        seenIds.add(r.id);

        const amount = Number(r.amount);
        if (!isFinite(amount) || amount < 0)
          return reject(`Record ${num}: invalid amount "${r.amount}".`);

        if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(r.date))
          return reject(`Record ${num}: invalid date "${r.date}" — use YYYY-MM-DD.`);

        // normalise amount to number
        data[i] = { ...r, amount };
      }

      resolve(data);
    };

    reader.readAsText(file);
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────
function _showStorageWarning(msg) {
  let banner = document.getElementById('storage-warning');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'storage-warning';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    banner.style.cssText = [
      'position:fixed', 'bottom:1rem', 'left:50%', 'transform:translateX(-50%)',
      'background:#dc2626', 'color:#fff', 'padding:.65rem 1.25rem',
      'border-radius:8px', 'font-weight:600', 'font-size:.9rem',
      'z-index:9999', 'max-width:90vw', 'text-align:center',
      'box-shadow:0 4px 16px rgba(0,0,0,.2)'
    ].join(';');
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  setTimeout(() => banner.remove(), 6000);
}
