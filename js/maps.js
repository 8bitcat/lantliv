// LANTLIV — custom map storage (localStorage). Shared by the game + the editor.
const ACTIVE = 'lantliv_active_map';   // the map the game currently loads (or absent = procedural)
const LIST = 'lantliv_maps';           // { name: mapData } — the editor's saved maps

export function getActiveMap() {
  try { const s = localStorage.getItem(ACTIVE); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function setActiveMap(map) {
  try { localStorage.setItem(ACTIVE, JSON.stringify(map)); } catch {}
}
export function clearActiveMap() {
  try { localStorage.removeItem(ACTIVE); } catch {}
}
export function listMaps() {
  try { return JSON.parse(localStorage.getItem(LIST) || '{}'); } catch { return {}; }
}
export function saveMap(name, map) {
  const all = listMaps(); all[name] = map;
  try { localStorage.setItem(LIST, JSON.stringify(all)); } catch {}
}
export function deleteMap(name) {
  const all = listMaps(); delete all[name];
  try { localStorage.setItem(LIST, JSON.stringify(all)); } catch {}
}
