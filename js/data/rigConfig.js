const KEY = 'rigConfig_v2';

// Каждая часть рисуется по схеме «шарнир»:
//   s   — высота части в пикселях после масштабирования (по ней строится скелет)
//   px,py — точка внутри ТЕКСТУРЫ части (в долях 0..1), которая служит
//          шарниром/точкой крепления. Именно она ставится в точку крепления.
//   paX,paY — точка на ТЕКСТУРЕ родителя (в долях 0..1), куда цепляется часть.
//   ox,oy — дополнительное смещение части (в пикселях) от точки крепления.
//
// Родители: head/arms -> torso, cap -> head, legs -> таз (низ торса).
// Благодаря этому части «сшиты» в одну шарнирную цепочку и не расходятся при наклонах.
export const RIG_DEFAULTS = {
  // Дефолты = рабочая сборка автора (сток size-lock v1): сброс рига
  // возвращает к этим размерам/пивотам, а не к мелкому заводскому телу.
  // k тела: (36+47+22)/64 = 1.64 (хитбокс ~49x92 вместо 30x56).
  torso: { s: 36, ox: 0, oy: 0, px: 0.5, py: 0.95 },
  head:  { s: 22, ox: 0, oy: 0, px: 0.5, py: 1.38, paX: 0.5, paY: 0.08 },
  cap:   { s: 9, ox: 0, oy: 0, px: 0.45, py: -0.35, paX: 0.5, paY: 0.05, rotF: 1 },
// Ноги — скелет: бедро (thigh) + икра (shin) + ступня, настоящая походка через IK.
// Стопа опорной ноги едет по земле, переносная поднимается над землёй и шагает;
// колено сгибается само, от геометрии. Таз опускается по дуге в опорной фазе.
//   swing — ширина шага (доля длины ноги), lift — высота подъёма стопы (доля длины),
//   knee — дополнительный сгиб колена (рад), fps — частота шага,
//   bobFreq/bobX/bobY — покачивание корпуса. Толщина костей (*W) — множитель
//   НАТУРАЛЬНОЙ ширины PNG-арта штанов (1.0 = как в файле; бедро chr_pants_thigh,
//   икра chr_pants_shin растягиваются под длины костей). Дефолт икры 0.65 — арт
//   икры в файле чуть шире бедра, а по фигуре икра должна быть уже. Прямоугольные
//   заглушки-кости без PNG рисуются по собственной пропорции от длины.
//   run — походка: true = БЕГ (опора ~38% цикла + полёт, отскок таза, темп выше),
//   false = шаг (опора ~50%, как раньше).
legs:  { s: 47, ox: 0, oy: 6, skeleton: true, run: true,
           thigh: 25, shin: 23,
           // Шарнир ног для миграции v<7 (значения совпадают с фолбэками
           // _partCfg в Player.js: px/py 0.5, paX 0.5, paY 1).
           px: 0.5, py: 0.5, paX: 0.5, paY: 1,
           fps: 16, bobFreq: 1, bobX: 2, bobY: 4, swing: 0.32, knee: 0.25, lift: 0.5, hip: 0.5,
           // thighW 0.7: худые ноги сборки (дефолт пояса 1.2 давал «треугольник»
           // торсом наружу — штаны выглядели уже тела).
           thighW: 0.7, shinW: 0.65, footW: 1,
           // Новый режим «одна PNG на ногу»: левая/правая нога рисуется ЦЕЛИКОМ
           // (chr_pants_leg_l/r.png), движок режет каждую текстуру по линии колена
           // (kneeL/kneeR — доля высоты арта, 0..1) на бедро+икру и дальше гнёт
           // их той же 2-сегментной IK. legSet: 'auto' (есть PNG → full, нет → parts
           // со старыми 4 частями chr_pants_thigh/shin_l/r), 'full'/'parts' — принудительно.
           legSet: 'auto', kneeL: 0.5, kneeR: 0.5,
            // Крепление СВОЁ для каждой ноги: сдвиг (px) точки, из которой висит бедро.
            // hipLx/hipLy — нога «переднего» арта (ведущая, спереди), hipRx/hipRy —
            // «заднего» (сзади). X по ходу взгляда: при взгляде вправо «задняя» — слева.
            // Дефолт ±3: бёдра обхватывают торс с боков (пояс шире футболки),
            // а не висят из одной центральной точки.
            hipLx: 3, hipLy: 0, hipRx: -3, hipRy: 0 },
  shoes: { s: 9, ox: 0, oy: 0, px: 0.5, py: 0.5, dist: 18, baked: false,
           lx: 0, ly: 0, rx: 0, ry: 0,
           lPx: 0.38, lPy: 0.2, rPx: 0.38, rPy: 0.2 },
  arms:  { s: 26, upper: 16, fore: 12, ox: 0, oy: 0, px: 0.52, py: 0.35, paX: 0.5, paY: 0.14,
           upW: 0.28, foreW: 0.22,
           // Срез локтя (доля ширины арта): цельная PNG руки (chr_arm_fore_l/r)
           // режется вертикальной линией на плечо (0..elbow) + предплечье с
           // кистью (elbow..1), как ноги режутся в колене. 0.36 = уголок локтя
           // (дно выемки между рукавом и предплечьем, его же ищет детектор);
           // старые 0.48/0.30 резали середину предплечья — руки гнулись не в локтях.
           // Задняя рука — правая текстура (elbowR), передняя — левая (elbowL).
           elbowL: 0.36, elbowR: 0.36 },
  muzzle: { x: 60, y: -3 },
  // Хват оружия под КОНКРЕТНОЕ оружие: задняя кисть — на rearFrac*плечо от
  // плеча по линии прицела, передняя — на upper + frontFrac*предплечье.
  // muzzle (если задан) — точка вылета пули именно этого оружия, иначе берётся
  // общая «Точка вылета». Значения настраиваются в редакторе (раздел «Руки»).
  weaponHands: {
    'default': { rearFrac: 0.86, frontFrac: 0.92, rearDrop: 3, frontDrop: 4 },
    'AK-47': { rearFrac: 0.27, frontFrac: 0.26, rearDrop: 3, frontDrop: 4, muzzle: { x: 38, y: -3 } },
    'bad_ak47': { rearFrac: 0.27, frontFrac: 0.26, rearDrop: 3, frontDrop: 4, muzzle: { x: 38, y: -3 } },
    'SIG_SG_550': { rearFrac: 0.9, frontFrac: 0.85, muzzle: { x: 62, y: -3 } },
    'Sturmgewehr_44': { rearFrac: 0.9, frontFrac: 0.85, muzzle: { x: 60, y: -2 } },
    'SMG-9': { rearFrac: 0.9, frontFrac: 0.75, muzzle: { x: 40, y: -2 } },
    'MP5': { rearFrac: 0.9, frontFrac: 0.75, muzzle: { x: 38, y: -2 } },
    'UZI': { rearFrac: 0.9, frontFrac: 0.7, muzzle: { x: 30, y: -1 } },
    'SSG': { rearFrac: 0.92, frontFrac: 0.45, muzzle: { x: 75, y: -4 } },
    'Barrett_M82': { rearFrac: 0.92, frontFrac: 0.45, muzzle: { x: 78, y: -4 } },
    'LAR': { rearFrac: 0.92, frontFrac: 0.5, muzzle: { x: 72, y: -3 } },
    'Winchester': { rearFrac: 0.92, frontFrac: 0.5, muzzle: { x: 60, y: -2 } },
    'Benelli_M4': { rearFrac: 0.9, frontFrac: 0.7, muzzle: { x: 42, y: -2 } },
    'LMG-50': { rearFrac: 0.85, frontFrac: 0.9, muzzle: { x: 58, y: -3 } },
    'M249': { rearFrac: 0.85, frontFrac: 0.9, muzzle: { x: 58, y: -3 } },
    'М1913': { rearFrac: 0.87, frontFrac: 0.8, muzzle: { x: 37, y: -2 } },
    'Neuhausen KE-7': { rearFrac: 0.88, frontFrac: 0.85, muzzle: { x: 37, y: -3 } },
    'М60': { rearFrac: 0.85, frontFrac: 0.9, muzzle: { x: 37, y: -1 } },
    'Vickers K': { rearFrac: 0.85, frontFrac: 0.9, muzzle: { x: 37, y: -2 } },
    'M1918': { rearFrac: 0.87, frontFrac: 0.88, muzzle: { x: 55, y: -3 } },
    'Pistol': { rearFrac: 0.75, frontFrac: 0.6, muzzle: { x: 22, y: -1 } },
    'Makarov': { rearFrac: 0.75, frontFrac: 0.6, muzzle: { x: 20, y: -1 } },
    'Glock': { rearFrac: 0.75, frontFrac: 0.6, muzzle: { x: 19, y: -1 } },
    'Deagle': { rearFrac: 0.75, frontFrac: 0.6, muzzle: { x: 24, y: -2 } },
    'M1911': { rearFrac: 0.75, frontFrac: 0.6, muzzle: { x: 22, y: -1 } },
    'revolver': { rearFrac: 0.75, frontFrac: 0.6, muzzle: { x: 24, y: -2 } },
    'M6': { rearFrac: 0.86, frontFrac: 0.92, muzzle: { x: 55, y: -3 } },
    'Remington_700': { rearFrac: 0.92, frontFrac: 0.45, muzzle: { x: 76, y: -4 } },
    // Добавлены по списку ID из weapons.js (значения — с ближайших по типу).
    // Старые ключи (SMG-9, MP5, LMG-50, Pistol, M6) оставлены для совместимости.
    'P90': { rearFrac: 0.9, frontFrac: 0.7, muzzle: { x: 30, y: -1 } },
    'AUG': { rearFrac: 0.27, frontFrac: 0.26, rearDrop: 3, frontDrop: 4, muzzle: { x: 38, y: -3 } },
    'М16': { rearFrac: 0.27, frontFrac: 0.26, rearDrop: 3, frontDrop: 4, muzzle: { x: 38, y: -3 } },
    'SIG_SG_543': { rearFrac: 0.9, frontFrac: 0.85, muzzle: { x: 62, y: -3 } },
    'minigun': { rearFrac: 0.85, frontFrac: 0.9, muzzle: { x: 58, y: -3 } },
    'RPG': { rearFrac: 0.86, frontFrac: 0.92, muzzle: { x: 55, y: -3 } },
    'VKS': { rearFrac: 0.92, frontFrac: 0.45, muzzle: { x: 75, y: -4 } },
    'Remington': { rearFrac: 0.9, frontFrac: 0.7, muzzle: { x: 42, y: -2 } },
    'Knife': { rearFrac: 0.75, frontFrac: 0.6 },
    'Сайга': { rearFrac: 0.9, frontFrac: 0.7, muzzle: { x: 42, y: -2 } },
    'обрез': { rearFrac: 0.9, frontFrac: 0.7, muzzle: { x: 30, y: -2 } },
    'катана': { rearFrac: 0.75, frontFrac: 0.6 },
    'мачете': { rearFrac: 0.75, frontFrac: 0.6 }
  }
};

// Ручные пристрелки автора (хватки/точки вылета под его риг k=1.64):
// мержатся поверх таблицы выше. Сброс рига возвращается к ним,
// а не к приблизительным заводским — калибровка не теряется.
const AUTHOR_HANDS = {
  'AK-47': { gunOX: 2, muzzle: { x: 14, y: -4 }, gunScale: 0.9, frontDrop: 2, gunOY: 0, frontPX: 0, frontPY: 2, rearPX: 4 },
  'Sturmgewehr_44': { gunOX: 6, frontDrop: 2, gunScale: 0.9, muzzle: { x: 10, y: -5 }, rearPX: 0, frontPX: -5, frontPY: 4 },
  'UZI': { gunScale: 0.5, gunOX: 10, gunOY: 6, muzzle: { x: 10, y: -6 }, frontPX: 1, rearPY: 0, rearPX: 9 },
  'P90': { gunScale: 0.7, muzzle: { x: 18, y: 1 } },
  'M249': { muzzle: { x: 12, y: 0 } },
  'M1918': { muzzle: { x: 16, y: -1 }, gunScale: 1.1 },
  'SSG': { muzzle: { x: 9, y: -1 } },
  'LAR': { muzzle: { x: -13, y: -5 }, gunScale: 0.5, gunOY: 2, gunOX: 18, frontDrop: 2 },
  'Barrett_M82': { muzzle: { x: 11, y: -2 } },
  'Remington_700': { muzzle: { x: 10, y: 0 } },
  'Winchester': { muzzle: { x: 15, y: -5 } },
  'Makarov': { muzzle: { x: 11, y: -5 }, gunScale: 0.5, gunOX: 16, gunOY: 0 },
  'Glock': { gunScale: 0.5, gunOY: -2, gunOX: 16, muzzle: { x: 7, y: -7 } },
  'M1911': { gunScale: 0.5, muzzle: { x: 8, y: -8 }, gunOX: 20 },
  'Deagle': { muzzle: { x: 9, y: -5 }, gunScale: 0.5, gunOX: 18 },
  'revolver': { muzzle: { x: 8, y: -5 }, gunScale: 0.5, gunOY: -2, gunOX: 16 },
  'Knife': { muzzle: { x: 40, y: -2 }, gunScale: 0.5 },
  'Сайга': { muzzle: { x: 7, y: -4 }, gunOX: 8 },
  'катана': { muzzle: { x: 66, y: 1 }, gunScale: 0.5, gunOY: -14, gunOX: 10, frontDrop: 16 },
  'мачете': { gunScale: 0.5, gunOX: 8, gunOY: -16 },
  'обрез': { gunScale: 0.8, muzzle: { x: 18, y: -4 } },
  'SIG_SG_543': { muzzle: { x: 16, y: -3 }, gunOY: 0, gunOX: 0, frontDrop: 6 },
  'AUG': { muzzle: { x: 16, y: -3 }, gunScale: 0.9, rearFX: 11, frontFX: 4 },
  'minigun': { muzzle: { x: 21, y: 1 }, gunOY: 30 },
  'RPG': { muzzle: { x: 20, y: -3 }, gunOY: -2, gunOX: -12 },
  'VKS': { muzzle: { x: 17, y: -1 } },
  'М16': { muzzle: { x: 16, y: -3 } },
  'Remington': { muzzle: { x: 16, y: -4 }, rearFY: 1, frontFY: 2 },
  'bad_ak47': { muzzle: { x: 15, y: -4 }, rearFX: 7 },
  'SIG_SG_550': { muzzle: { x: 12, y: -2 }, gunOX: 4 },
  'Benelli_M4': { muzzle: { x: 17, y: -3 } },
  'М1913': { muzzle: { x: 14, y: -3 } },
  'Neuhausen KE-7': { muzzle: { x: 17, y: -4 } },
  'М60': { muzzle: { x: 16, y: -2 } },
  'Vickers K': { muzzle: { x: 13, y: -2 } }
};
try {
  Object.keys(AUTHOR_HANDS).forEach(k => {
    RIG_DEFAULTS.weaponHands[k] = Object.assign(
      {}, RIG_DEFAULTS.weaponHands[k] || {}, AUTHOR_HANDS[k]
    );
  });
} catch (e) {}

// Приводим сохранённый конфиг к новым значениям (МАКСИМУМ один раз, пока cfg.v < CFG_VERSION).
// Крепление рук из середины торса переносится к плечу (paY 0.17, paX 0.45),
// а старая точка вылета сбрасывается на кончик ствола.
const CFG_VERSION = 20;

// Старые значения, из-за которых рука «летала», а пули вылетали «изо рта»
const OLD_ARMS = [
  { px: 0.3, py: 0.5, paX: 0.5, paY: 0.36 },
  { px: 0.12, py: 0.45, paX: 0.5, paY: 0.45 }
];

// Старое крепление кепки: шарнир в самом низу текстуры (py:1) — весь колпак
// парил над головой. Теперь кепка «подвешивается» за вершину колпака (py:0.15)
// и свешивается вниз, зацепившись за макушку без смещения при наклонах.
const OLD_CAP_PY_BOTTOM = 1;

function migrateRigConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  if ((cfg.v ?? 1) >= CFG_VERSION) return cfg;
  if ((cfg.v ?? 1) < 4) {
    if (cfg.arms) {
      const a = cfg.arms;
      const isOld = OLD_ARMS.some(
        o => a.px === o.px && a.py === o.py && a.paX === o.paX && a.paY === o.paY
      );
      if (isOld) {
        cfg.arms = Object.assign({}, RIG_DEFAULTS.arms, a, {
          px: RIG_DEFAULTS.arms.px,
          py: RIG_DEFAULTS.arms.py,
          paX: RIG_DEFAULTS.arms.paX,
          paY: RIG_DEFAULTS.arms.paY
        });
      }
    }
    if (cfg.muzzle) {
      cfg.muzzle = { x: RIG_DEFAULTS.muzzle.x, y: RIG_DEFAULTS.muzzle.y };
    }
    if (cfg.shoes) {
      if (typeof cfg.shoes.dist !== 'number') cfg.shoes.dist = RIG_DEFAULTS.shoes.dist;
    }
  }
  if ((cfg.v ?? 1) < 5) {
    if (cfg.cap && cfg.cap.py === OLD_CAP_PY_BOTTOM) {
      cfg.cap = Object.assign({}, RIG_DEFAULTS.cap, cfg.cap, { py: RIG_DEFAULTS.cap.py });
    }
  }
  if ((cfg.v ?? 1) < 6) {
    // точку вылета пуль держим всегда: без неё пули летели «изо рта»
    if (!cfg.muzzle) cfg.muzzle = { x: RIG_DEFAULTS.muzzle.x, y: RIG_DEFAULTS.muzzle.y };
  }
  if ((cfg.v ?? 1) < 7) {
    // ноги стали единым спрайтом-листом: две отдельные ноги сливаются в одну часть
    if (!cfg.legs) {
      const ll = cfg.legL || {};
      const lr = cfg.legR || {};
      cfg.legs = {
        s: Math.max(ll.s || 0, lr.s || 0) || RIG_DEFAULTS.legs.s,
        ox: 0, oy: 0,
        px: RIG_DEFAULTS.legs.px,
        py: RIG_DEFAULTS.legs.py,
        paX: RIG_DEFAULTS.legs.paX,
        paY: RIG_DEFAULTS.legs.paY
      };
    }
    delete cfg.legL;
    delete cfg.legR;
  }
  if ((cfg.v ?? 1) < 8) {
    // скелет: у ног — длины бёдер/икр, у рук — плечо/предплечье
    if (cfg.legs) {
      if (typeof cfg.legs.thigh !== 'number') cfg.legs.thigh = RIG_DEFAULTS.legs.thigh;
      if (typeof cfg.legs.shin !== 'number') cfg.legs.shin = RIG_DEFAULTS.legs.shin;
      if (cfg.legs.skeleton !== false) cfg.legs.skeleton = true;
    }
    if (cfg.arms) {
      if (typeof cfg.arms.upper !== 'number') cfg.arms.upper = RIG_DEFAULTS.arms.upper;
      if (typeof cfg.arms.fore !== 'number') cfg.arms.fore = RIG_DEFAULTS.arms.fore;
    }
  }
  if ((cfg.v ?? 1) < 9) {
    // походка сменилась с «углов качелей» на настоящий шаг (стопа по земле + IK):
    // swing теперь доля длины ноги (ширина шага), lift — доля (высота подъёма стопы),
    // knee — доп. сгиб колена в радианах. Старые значения (0.35/0.6/2) несовместимы —
    // перезаписываем дефолтами, иначе ноги «улетят».
    if (cfg.legs) {
      cfg.legs.swing = RIG_DEFAULTS.legs.swing;
      cfg.legs.lift = RIG_DEFAULTS.legs.lift;
      cfg.legs.knee = RIG_DEFAULTS.legs.knee;
    }
  }
  if ((cfg.v ?? 1) < 10) {
    // stick-фигурка: тонкие «палки» вместо толстых чугунных костей. Обновляем
    // ТОЛЬКО дефолтные значения (а не кастомные, введённые в редакторе), иначе
    // пользовательская настройка толщины молча слетит.
    const l = cfg.legs;
    if (l && typeof l.thighW === 'number' && l.thighW === 0.45) l.thighW = RIG_DEFAULTS.legs.thighW;
    if (l && typeof l.shinW === 'number' && l.shinW === 0.35) l.shinW = RIG_DEFAULTS.legs.shinW;
    if (l && typeof l.footW === 'number' && l.footW === 0.9) l.footW = RIG_DEFAULTS.legs.footW;
    const a = cfg.arms;
    if (a && typeof a.upW === 'number' && a.upW === 0.28) a.upW = RIG_DEFAULTS.arms.upW;
    if (a && typeof a.foreW === 'number' && a.foreW === 0.22) a.foreW = RIG_DEFAULTS.arms.foreW;
  }
  // «Ширины» костей теперь = множитель НАТУРАЛЬНОЙ ширины PNG-арта (1.0 = как в
  // файле). Старые дефолты (0.2/0.16/0.6 и их прародители 0.45/0.35/0.9) превращали
  // бедро/икру в «спички» на PNG, поэтому переносим их на новый дефолт; кастомные
  // значения пользователя (между 0.1 и 2, см. _adjust) не трогаем.
  if ((cfg.v ?? 1) < 11) {
    const l = cfg.legs;
    if (l) {
      if (l.thighW === 0.45 || l.thighW === 0.2) l.thighW = RIG_DEFAULTS.legs.thighW;
      if (l.shinW === 0.35 || l.shinW === 0.16) l.shinW = RIG_DEFAULTS.legs.shinW;
      if (l.footW === 0.9 || l.footW === 0.6) l.footW = RIG_DEFAULTS.legs.footW;
    }
  }
  // v11 у пользователей записал прежний «натуральный» дефолт shinW:1. Арт икры
  // чуть ШИРЕ бедра, а по фигуре икра должна быть уже него, поэтому отзываем этот
  // дефолт уточнённым значением. Кастом не трогаем (1.0 поставили вручную — останется).
  if ((cfg.v ?? 1) < 12) {
    const l = cfg.legs;
    if (l && l.shinW === 1) l.shinW = RIG_DEFAULTS.legs.shinW;
  }
  // v13: ремонт «разорванных» рук/ног после ручной настройки — значения вне
  // sane-диапазонов подтягиваем к границам (иначе кости/срезы улетают далеко
  // за пределы арта: длинные «лезвия» вместо рук, щели в локтях и т.п.).
  if ((cfg.v ?? 1) < 13) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const a = cfg.arms;
    if (a) {
      if (typeof a.upper === 'number') a.upper = clamp(a.upper, 6, 26);
      if (typeof a.fore === 'number') a.fore = clamp(a.fore, 4, 22);
      if (typeof a.upW === 'number') a.upW = clamp(a.upW, 0.15, 1.5);
      if (typeof a.foreW === 'number') a.foreW = clamp(a.foreW, 0.15, 1.5);
      if (typeof a.elbowL === 'number') a.elbowL = clamp(a.elbowL, 0.25, 0.75);
      if (typeof a.elbowR === 'number') a.elbowR = clamp(a.elbowR, 0.25, 0.75);
    }
    const l = cfg.legs;
    if (l) {
      if (typeof l.thigh === 'number') l.thigh = clamp(l.thigh, 6, 30);
      if (typeof l.shin === 'number') l.shin = clamp(l.shin, 6, 30);
      if (typeof l.thighW === 'number') l.thighW = clamp(l.thighW, 0.2, 1.6);
      if (typeof l.shinW === 'number') l.shinW = clamp(l.shinW, 0.2, 1.6);
      if (typeof l.footW === 'number') l.footW = clamp(l.footW, 0.2, 1.6);
      if (typeof l.kneeL === 'number') l.kneeL = clamp(l.kneeL, 0.2, 0.8);
      if (typeof l.kneeR === 'number') l.kneeR = clamp(l.kneeR, 0.2, 0.8);
    }
    const s = cfg.shoes;
    if (s && typeof s.s === 'number') s.s = clamp(s.s, 4, 20);
  }
  // v14: пропорции по умолчанию — кроссовки меньше (8→6, были «вёдра»),
  // кепка следует за головой наполовину (rotF 1→0.5, не «кривится» при
  // прицеле вверх/вниз). Трогаем только дефолтные значения.
  if ((cfg.v ?? 1) < 14) {
    const s = cfg.shoes;
    if (s && s.s === 8) s.s = 6;
    const c = cfg.cap;
    if (c && c.rotF === 1) c.rotF = 0.5;
  }
  // v15: откат rotF 0.5→1 — половинный доворот давал «съезжание» убора с головы
  // при наклоне (убор должен сидеть жёстко, как был). Трогаем только 0.5.
  // Пояс штанов шире: старый дефолт thighW 1 → 1.2 (футболка шире пояса).
  if ((cfg.v ?? 1) < 15) {
    const c = cfg.cap;
    if (c && c.rotF === 0.5) c.rotF = 1;
    const l = cfg.legs;
    if (l && l.thighW === 1) l.thighW = 1.2;
  }
  // v16: бёдра обхватывают торс (hipLx/hipRx 0/0 → +3/-3). Трогаем только
  // нетронутый дефолт — ручную настройку не затираем.
  if ((cfg.v ?? 1) < 16) {
    const l = cfg.legs;
    if (l && (l.hipLx ?? 0) === 0 && (l.hipRx ?? 0) === 0) {
      l.hipLx = 3;
      l.hipRx = -3;
    }
  }
  // v17: срез локтя на уголок (0.36, дно выемки — его же ищет детектор).
  // Старые дефолты 0.48/0.30 резали середину предплечья. Трогаем только
  // нетронутые дефолты — ручную настройку не затираем.
  if ((cfg.v ?? 1) < 17) {
    const a = cfg.arms;
    if (a) {
      if (a.elbowL === 0.48 || a.elbowL === 0.3) a.elbowL = 0.36;
      if (a.elbowR === 0.48 || a.elbowR === 0.3) a.elbowR = 0.36;
    }
  }
  // v18: диапазон среза локтя шире (0.25–0.75 → 0.05–0.95): точку можно
  // ставить почти где угодно. Только расширяем, ничего не затираем.
  if ((cfg.v ?? 1) < 18) {
    const a = cfg.arms;
    if (a) {
      if (typeof a.elbowL === 'number') a.elbowL = Math.max(0.05, Math.min(0.95, a.elbowL));
      if (typeof a.elbowR === 'number') a.elbowR = Math.max(0.05, Math.min(0.95, a.elbowR));
    }
  }
  // v19: точка вылета АК висела в 20px перед стволом (табличные 57px при
  // показе 44px: кончик ствола — 0.85*44≈37px от точки хвата). Старый дефолт
  // 57/-3 в дефолтах уже исправлен на 38/-3; здесь чистим СОХРАНЁННЫЕ копии
  // этого дефолта — удаляем, чтобы рулил живой детект кончика по PNG
  // (window.__gunTips): он точнее и сам масштабируется с персонажем.
  // Ручную точку (не 57) не трогаем.
  if ((cfg.v ?? 1) < 19) {
    const wh = cfg.weaponHands;
    if (wh && typeof wh === 'object') {
      ['AK-47', 'bad_ak47'].forEach(k => {
        const c = wh[k];
        if (c && c.muzzle && c.muzzle.x === 57 && c.muzzle.y === -3) {
          delete c.muzzle;
        }
      });
    }
  }
  // v20: идеальный авто-подбор теперь сносит всё кривое сам, но старые сейвы
  // должны стартовать чисто без нажатия кнопки: чистим то, что точно ломало
  // сборку — per-режимные анимации ног, сдвиги таза/торса и ручной хват.
  // Размеры (s/thigh/shin/upper/fore) не трогаем.
  if ((cfg.v ?? 1) < 20) {
    if (cfg.legs && typeof cfg.legs === 'object') {
      delete cfg.legs._animModes;
      delete cfg.legs.mx; delete cfg.legs.my;
      if (typeof cfg.legs.ox === 'number' && cfg.legs.ox !== 0) delete cfg.legs.ox;
      if (typeof cfg.legs.oy === 'number' && cfg.legs.oy !== 0 && cfg.legs.oy !== 6) delete cfg.legs.oy;
      delete cfg.legs.thighPx; delete cfg.legs.thighPy; delete cfg.legs.thighBot;
      delete cfg.legs.shinPx; delete cfg.legs.shinPy; delete cfg.legs.shinBot;
      delete cfg.legs.px; delete cfg.legs.py;
    }
    if (cfg.torso && typeof cfg.torso === 'object') {
      delete cfg.torso.mx; delete cfg.torso.my;
      if (typeof cfg.torso.ox === 'number' && cfg.torso.ox !== 0) delete cfg.torso.ox;
    }
    if (cfg.weaponHands && typeof cfg.weaponHands === 'object') {
      Object.keys(cfg.weaponHands).forEach(k => {
        const c = cfg.weaponHands[k];
        if (!c || typeof c !== 'object') return;
        delete c.rearFrac; delete c.frontFrac;
        delete c.rearDrop; delete c.frontDrop;
        delete c.muzzle;
        delete c.gunOX; delete c.gunOY;
        // gunScale НЕ трогаем: это живой размер ствола (у автора 0.5–1.1),
        // а не legacy-мусор. Иначе свежие профили теряли авторские масштабы
        // (инкогнито видело другие стволы), а v20-сейвы — нет.
        if (Object.keys(c).length === 0) delete cfg.weaponHands[k];
      });
      if (Object.keys(cfg.weaponHands).length === 0) delete cfg.weaponHands;
    }
  }
  // Битые числа (NaN/Infinity из рантайма до сейва) — удалить, чтобы
  // встали дефолты, а не ломали превью (вырожденные размеры/позиции).
  // JSON-null не трогаем: null в арифметике даёт 0, это статус-кво.
  try {
    (function scrub(o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (typeof v === 'number' && !Number.isFinite(v)) delete o[k];
        else if (v !== null && typeof v === 'object') scrub(v);
      });
    })(cfg);
  } catch (e) {}
  cfg.v = CFG_VERSION;
  return cfg;
}

export function cloneRigConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg || RIG_DEFAULTS));
}

export function getRigConfig() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return migrateRigConfig(v);
  } catch (e) { /* noop */ }
  // Свежий профиль (новичок/инкогнито): отдаём сборку автора, а не null.
  // Иначе previewScale мутирует отвязанный {}, хитбокс падает на мелкий
  // фолбэк 30x56 — и в меню стоят карлики, хотя размеры в дефолтах большие.
  try {
    const fresh = cloneRigConfig(RIG_DEFAULTS);
    // Штамп текущей версии: свежий конфиг НЕ проходит чистки старых сейвов,
    // иначе стирались gunScale/хват/офсеты автора (а у автора с v20 — нет),
    // и стволы в инкогнито стояли не там. Заполнение недостающего
    // свежему не нужно — клон и так полный.
    fresh.v = CFG_VERSION;
    return migrateRigConfig(fresh);
  } catch (e) {
    return cloneRigConfig(RIG_DEFAULTS);
  }
}

export function saveRigConfig(cfg) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetRigConfig() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) { /* noop */ }
}

// Замок размеров тела: текущий размер запоминается как стоковый эталон,
// после чего Размер/Рост у всего, кроме рук, блокируются.
// Руки (s/upper/fore) крутятся всегда — их ещё подгоняют под оружие.
const STOCK_KEY = 'rigStock_v1';

function stockSnapshot(state) {
  const g = (part, fields) => {
    const out = {};
    const src = (state && state[part]) || {};
    const def = RIG_DEFAULTS[part] || {};
    fields.forEach(f => { out[f] = src[f] ?? def[f]; });
    return out;
  };
  return {
    torso: g('torso', ['s']),
    head: g('head', ['s']),
    cap: g('cap', ['s']),
    legs: g('legs', ['s', 'thigh', 'shin']),
    shoes: g('shoes', ['s'])
  };
}

export function getSizeLock(state) {
  try {
    const v = JSON.parse(localStorage.getItem(STOCK_KEY));
    if (v && typeof v === 'object' && v.locked && v.stock) return v;
  } catch (e) { /* нет замка */ }
  return { locked: false, stock: stockSnapshot(state) };
}

export function setSizeLock(state, locked) {
  try {
    if (locked) {
      localStorage.setItem(STOCK_KEY, JSON.stringify({ locked: true, stock: stockSnapshot(state) }));
    } else {
      const cur = getSizeLock(state);
      localStorage.setItem(STOCK_KEY, JSON.stringify({ locked: false, stock: cur.stock || stockSnapshot(state) }));
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Размер заморожен? Руки — никогда (их подгоняют под оружие).
export function isSizeLocked(key) {
  if (key === 'arms') return false;
  try {
    const v = JSON.parse(localStorage.getItem(STOCK_KEY));
    return !!(v && v.locked);
  } catch (e) {
    return false;
  }
}
