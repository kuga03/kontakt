import { generateLevel, CURRENT_GEN_VERSION } from './levelGen.js?v=174';

const KEY = 'sideShooterCustomLevels';
const OLD_KEY = 'customCampaignLevel';

// Сырое чтение без миграции и без nextId — разрывает цикл
// loadCustomLevels <-> nextId при миграции OLD_KEY.
function _loadRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { exists: true, data: parsed };
    }
  } catch (e) { /* ignore */ }
  return { exists: false, data: [] };
}

export function loadCustomLevels() {
  const rawInfo = _loadRaw();
  let arr = rawInfo.data;
  let migrated = false;

  // Миграция старого одиночного уровня — ДО любых nextId/load,
  // id считаем локально из сырого списка, рекурсии нет.
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      localStorage.removeItem(OLD_KEY);
      if (!arr.length) {
        const parsed = JSON.parse(old);
        if (parsed && parsed.objects) {
          let max = 1000;
          arr.forEach(l => {
            if (l && typeof l.id === 'number' && l.id > max) max = l.id;
          });
          parsed.id = max + 1;
          parsed.savedAt = Date.now();
          arr = [parsed];
          migrated = true;
        }
      }
    }
  } catch (e) { /* ignore */ }

  // Миграция старых процедурных карт на актуальный генератор с новыми укрытиями и разноуровневыми спавнами
  arr.forEach((l, i) => {
    if (l && (!l.genVersion || l.genVersion < CURRENT_GEN_VERSION)) {
      const isGen = l.isGenerated || /^(Аванпост|Каньон|Квартал|Бункер)/.test(l.name);
      if (isGen) {
        const updated = generateLevel(i);
        updated.id = l.id;
        updated.savedAt = Date.now();
        arr[i] = updated;
        migrated = true;
      }
    }
  });

  // Создаем дефолтные уровни ТОЛЬКО при самом первом запуске игры,
  // когда ключа в localStorage вообще не существовало (!rawInfo.exists).
  // Если пользователь сам удалил все уровни (rawInfo.exists === true),
  // мы не навязываем дефолтные уровни снова.
  if (!rawInfo.exists && !arr.length) {
    try {
      arr = [0, 1, 2, 3].map(idx => {
        const def = generateLevel(idx);
        def.id = 1001 + idx;
        def.savedAt = Date.now();
        return def;
      });
      migrated = true;
    } catch (e) { /* ignore */ }
  }

  let changed = false;
  arr.forEach((l, i) => {
    if (l == null || typeof l !== 'object') {
      arr[i] = { name: 'Уровень', objects: [] };
      changed = true;
    }
    if (typeof arr[i].id !== 'number' || !isFinite(arr[i].id)) {
      arr[i].id = 1000 + i;
      changed = true;
    }
    arr[i].name = (arr[i].name || '').trim() || 'Без названия';
  });

  if (changed || migrated) saveCustomLevels(arr);
  return arr;
}

function saveCustomLevels(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch (e) { /* ignore */ }
}

function nextId() {
  const arr = _loadRaw().data;
  let max = 1000;
  arr.forEach(l => {
    if (typeof l.id === 'number' && l.id > max) max = l.id;
  });
  return max + 1;
}

export function saveCustomLevel(levelDef, editingId) {
  const arr = loadCustomLevels();
  // Копия: не мутируем входной объект.
  const def = { ...levelDef, savedAt: Date.now() };

  if (editingId != null) {
    const i = arr.findIndex(l => String(l.id) === String(editingId));
    if (i >= 0) {
      def.id = editingId;
      arr[i] = def;
    } else {
      def.id = editingId;
      arr.push(def);
    }
  } else {
    def.id = nextId();
    arr.push(def);
  }
  saveCustomLevels(arr);
  return def.id;
}

export function deleteCustomLevel(id) {
  const arr = loadCustomLevels().filter(l => String(l.id) !== String(id));
  saveCustomLevels(arr);
  return arr.length;
}
