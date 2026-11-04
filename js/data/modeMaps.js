// Большие карты режимов CTF/BOMB/KOTH (maps/*.json, формат level-objects).
// Грузятся в BootScene; при отсутствии файла режимы играют на старых
// процедурных аренах — деградация без ошибок.
//
// Ручная подмена карты без правки файла (dev/тесты):
//   localStorage.setItem('sideShooterModeMaps', JSON.stringify({ CTF: {...} }))
//   localStorage.removeItem('sideShooterModeMaps')
import { genFlankArena } from './flankGen.js';

const MAP_FILES = { BOMB: 'bomb', CTF: 'ctf', KOTH: 'koth' };

const isLevel = lv => !!(lv && Array.isArray(lv.objects) && lv.objects.length);

// Версия стоковых карт: переопределение из localStorage действует, только
// если совпадает версия (старые импорты молча откатываются на файлы).
// Свои кастомные карты пересоберите из свежих maps/import_*.txt.
export const MAP_VER = 12;

// Выбор карты в лобби свободной игры (Карта: …): Авто — карта по режиму,
// иначе принудительно один из файлов maps/*.json (работает в любом режиме:
// флаги/базы/точки строятся от ширины карты, геометрия — из файла).
const FREE_MAPS = [
  { id: 'auto', label: 'Авто (по режиму)' },
  { id: 'gen', label: 'Случайная (генератор)' },
  { id: 'ctf', label: 'Форты' },
  { id: 'bomb', label: 'Заводская застава' },
  { id: 'koth', label: 'Пыльный перекрёсток' }
];

function getFreeMapId() {
  try {
    const raw = localStorage.getItem('sideShooterState');
    const st = raw ? JSON.parse(raw) : null;
    const id = st && st.freeMapId;
    if (FREE_MAPS.some(m => m.id === id)) return id;
  } catch (e) {}
  return 'auto';
}

export function getFreeMap(scene) {
  try {
    const id = getFreeMapId();
    if (!id || id === 'auto') return null;
    // Генератор: свежий сид каждый матч — арена всегда разная, но всегда
    // с тремя ярусами и автолейнами (см. flankGen.js). Ширина — как у
    // процедурных арен режима (create() иначе возьмёт ширину из уровня,
    // она совпадёт — рассинхрона нет).
    if (id === 'gen') {
      const mode = (scene && scene.mode) || 'CTF';
      const w = mode === 'KOTH' ? 3600 : mode === 'BOMB' ? 3200 : 3800;
      const lv = genFlankArena({ seed: (Math.random() * 0xFFFFFFFF) >>> 0, mode, width: w });
      if (isLevel(lv)) return lv;
      return null;
    }
    const lv = scene.cache.json.get('modeMap_' + id);
    if (isLevel(lv)) return lv;
  } catch (e) { /* не загружено — карта по режиму */ }
  return null;
}

export function getModeMap(scene, mode) {
  // 1. Переопределение из localStorage — приоритетнее файла.
  try {
    const raw = localStorage.getItem('sideShooterModeMaps');
    if (raw) {
      const all = JSON.parse(raw);
      const lv = all && all[mode];
      if (isLevel(lv) && (lv.mapVer | 0) === MAP_VER) return lv;
    }
  } catch (e) { /* битый JSON — идём на файл */ }
  // 2. maps/*.json из кэша загрузчика.
  if (MAP_FILES[mode]) {
    try {
      const lv = scene.cache.json.get('modeMap_' + mode);
      if (isLevel(lv)) return lv;
    } catch (e) { /* не загружено — старая арена */ }
  }
  return null;
}

// Случайная карта для контрактных боёв банды: настройки свободной игры
// (выбор карты в лобби) туда не текут. Пулы: карта режима / генератор /
// чужой файл. Пусто — процедурная арена (как без карты раньше).
export function getRandomMap(scene, mode) {
  try {
    const roll = Math.random();
    if (roll < 0.4) return getModeMap(scene, mode);
    if (roll < 0.7) {
      const w = mode === 'KOTH' ? 3600 : mode === 'BOMB' ? 3200 : 3800;
      const lv = genFlankArena({ seed: (Math.random() * 0xFFFFFFFF) >>> 0, mode, width: w });
      if (isLevel(lv)) return lv;
      return getModeMap(scene, mode);
    }
    const ids = ['ctf', 'bomb', 'koth'];
    const lv = scene.cache.json.get('modeMap_' + ids[(Math.random() * ids.length) | 0]);
    if (isLevel(lv)) return lv;
    return getModeMap(scene, mode);
  } catch (e) { return null; }
}
