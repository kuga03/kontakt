// gameSettings.js — настройки игры (localStorage), отдельно от сейва прогресса.
// Хранит: переназначение клавиш, вибрацию, качество графики, тряску камеры.
// Модуль без ?v=: отдаётся с no-store, всегда свежий.

const LS_KEY = 'gameSettings_v1';

// Переназначаемые действия. def — имя клавиши Phaser (KeyCodes).
export const KEY_ACTIONS = [
  { id: 'left',     label: 'Влево',          def: 'A' },
  { id: 'right',    label: 'Вправо',         def: 'D' },
  { id: 'jump',     label: 'Прыжок',         def: 'SPACE' },
  { id: 'crouch',   label: 'Присесть',       def: 'S' },
  { id: 'ability',  label: 'Способность',    def: 'E' },
  { id: 'reload',   label: 'Перезарядка',    def: 'R' },
  { id: 'ultimate', label: 'Ульта',          def: 'X' },
  { id: 'grenade',  label: 'Граната',        def: 'G' },
  { id: 'smoke',    label: 'Дым',            def: 'H' },
  { id: 'dropBomb', label: 'Сбросить бомбу', def: 'F' }
];

export const QUALITY_OPTIONS = [
  { id: 'low',    label: 'Низкое' },
  { id: 'medium', label: 'Среднее' },
  { id: 'high',   label: 'Высокое' }
];

// Схемы мобильного управления.
export const CONTROL_SCHEMES = [
  { id: 'fixed',   label: 'Стик' },
  { id: 'dynamic', label: 'Динамический стик' },
  { id: 'buttons', label: 'Кнопки (WASD)' }
];

function keyCodeByName(name) {
  try {
    const KC = (typeof Phaser !== 'undefined' && Phaser.Input && Phaser.Input.Keyboard && Phaser.Input.Keyboard.KeyCodes) || null;
    if (KC && KC[name] != null) return KC[name];
  } catch (e) { /* Phaser ещё не загружен */ }
  if (typeof name === 'string' && name.length === 1) {
    return name.toUpperCase().charCodeAt(0);
  }
  return 0;
}

const DEFAULTS = { keys: {}, vibration: true, quality: null, camShake: true, controlScheme: 'fixed' };
KEY_ACTIONS.forEach(a => { DEFAULTS.keys[a.id] = a.def; });

function read() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = null; }
  let obj = null;
  try { obj = raw ? JSON.parse(raw) : null; } catch (e) { obj = null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) obj = {};
  const out = {
    keys: { ...DEFAULTS.keys },
    vibration: DEFAULTS.vibration,
    quality: DEFAULTS.quality,
    camShake: DEFAULTS.camShake,
    controlScheme: DEFAULTS.controlScheme
  };
  if (obj.keys && typeof obj.keys === 'object' && !Array.isArray(obj.keys)) {
    KEY_ACTIONS.forEach(a => {
      if (typeof obj.keys[a.id] === 'string' && obj.keys[a.id]) out.keys[a.id] = obj.keys[a.id];
    });
  }
  if (typeof obj.vibration === 'boolean') out.vibration = obj.vibration;
  if (obj.quality === 'low' || obj.quality === 'medium' || obj.quality === 'high') out.quality = obj.quality;
  if (typeof obj.camShake === 'boolean') out.camShake = obj.camShake;
  if (CONTROL_SCHEMES.some(s => s.id === obj.controlScheme)) out.controlScheme = obj.controlScheme;
  return out;
}

export function getSettings() { return read(); }

export function saveSettings(patch) {
  const cur = read();
  const next = { ...cur, ...(patch || {}) };
  if (patch && patch.keys) next.keys = { ...cur.keys, ...patch.keys };
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (e) { /* noop */ }
  return next;
}

export function getKeyCode(action) {
  const s = read();
  const name = s.keys[action] || (KEY_ACTIONS.find(a => a.id === action) || {}).def || 'SPACE';
  return keyCodeByName(name);
}

export function getVibration() { return read().vibration; }
export function setVibration(v) { return saveSettings({ vibration: !!v }); }

export function getCamShake() { return read().camShake; }
export function setCamShake(v) { return saveSettings({ camShake: !!v }); }

export function getControlScheme() { return read().controlScheme; }
export function setControlScheme(id) {
  if (!CONTROL_SCHEMES.some(s => s.id === id)) return read();
  return saveSettings({ controlScheme: id });
}

function isTouchDevice() {
  try {
    // Как в исходной логике resolution: мобильный UA (не тач-ноутбук).
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  } catch (e) { return false; }
}

// Качество по умолчанию: мобильный — низкое, ПК — высокое (как было до настроек).
export function getQuality() {
  const s = read();
  if (s.quality) return s.quality;
  return isTouchDevice() ? 'low' : 'high';
}

export function setQuality(id) {
  if (!['low', 'medium', 'high'].includes(id)) return read();
  return saveSettings({ quality: id });
}

export function resetKeys() {
  const keys = {};
  KEY_ACTIONS.forEach(a => { keys[a.id] = a.def; });
  return saveSettings({ keys });
}

// Вибрация (мобильные). На ПК — тишина (нет navigator.vibrate или он no-op).
export function vibrate(pattern) {
  try {
    if (!getVibration()) return false;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(pattern || 15);
  } catch (e) { return false; }
}

// Тряска камеры с учётом настройки. Замена прямых cameras.main.shake(...).

// Сырое имя клавиши Phaser по коду (для хранения в настройках).
export function keyCodeName(code) {
  try {
    const KC = Phaser.Input.Keyboard.KeyCodes;
    for (const k in KC) {
      if (KC[k] === code && /^[A-Z0-9_]+$/.test(k)) return k;
    }
  } catch (e) { /* noop */ }
  return null;
}

// Имя клавиши для UI по коду (обратный KeyCodes, иначе сырой код).
export function keyName(code) {
  const raw = keyCodeName(code);
  if (!raw) return code != null ? String(code) : '?';
  if (raw === 'SPACE') return 'Пробел';
  if (raw === 'BACKSPACE') return 'Backspace';
  if (raw === 'ENTER') return 'Enter';
  return raw;
}
