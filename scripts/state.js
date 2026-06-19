import { load, save, loadSettings, saveSettings } from './storage.js';

export const records  = load();
export const settings = loadSettings();

// Compute highest numeric id suffix safely
let _id = records.reduce((max, r) => {
  try {
    const n = parseInt(String(r.id).replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(n, max);
  } catch {
    return max;
  }
}, 0);

export function nextId() {
  return `txn_${String(++_id).padStart(4, '0')}`;
}

export function addRecord(r) {
  if (!r || typeof r !== 'object') {
    console.error('addRecord: invalid record', r);
    return false;
  }
  records.push(r);
  save(records);
  return true;
}

export function updateRecord(id, patch) {
  if (!id || typeof patch !== 'object') return false;
  const i = records.findIndex(r => r.id === id);
  if (i === -1) return false;
  records[i] = { ...records[i], ...patch, updatedAt: new Date().toISOString() };
  save(records);
  return true;
}

export function deleteRecord(id) {
  if (!id) return false;
  const i = records.findIndex(r => r.id === id);
  if (i === -1) return false;
  records.splice(i, 1);
  save(records);
  return true;
}

export function setRecords(arr) {
  if (!Array.isArray(arr)) {
    console.error('setRecords: expected array');
    return;
  }
  records.length = 0;
  records.push(...arr);
  _id = records.reduce((max, r) => {
    try {
      const n = parseInt(String(r.id).replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(n, max);
    } catch {
      return max;
    }
  }, 0);
  save(records);
}

export function updateSettings(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(settings, patch);
  saveSettings(settings);
}
