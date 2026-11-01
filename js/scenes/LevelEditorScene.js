import { loadCustomLevels, saveCustomLevel } from '../data/customLevels.js?v=169';
import { resolveBuildingTex } from '../world/mapPrimitives.js?v=364';
import { bakePanorama } from '../data/bgPanorama.js?v=268';
import { gameW, UX } from '../ui/layout.js?v=3';

const OBJECT_TYPES = {
  wall:     { color: 0x6b5a4a, w: 60,   h: 200 },
  cover:    { color: 0x55556f, w: 60,   h: 86 },
  platform: { color: 0x333366, w: 200,  h: 16 },
  ground:   { color: 0x7a6248, w: 2400, h: 80 }
};

// Варианты земли: plain — цвет; остальные — рисованные плитки gr_*
// (generateGroundArt в BootScene, клавиша R листает варианты).
const GROUND_DEFS = [
  { id: 'plain', label: 'Земля', color: 0x7a6248, tex: null },
  { id: 'grass', label: 'Земля с травой', color: 0x5a7a3a, tex: 'gr_grass' },
  { id: 'sand', label: 'Земля пустыня', color: 0xa88a4a, tex: 'gr_sand' },
  { id: 'stones', label: 'Камни', color: 0x777777, tex: 'gr_stones' },
  { id: 'beton', label: 'Бетон', color: 0x888888, tex: 'gr_beton' },
  { id: 'betonsand', label: 'Бетон пустыня', color: 0x9a8a5a, tex: 'gr_beton_sand' },
  { id: 'scorch', label: 'Выжженная земля', color: 0x3a352c, tex: 'gr_scorch' }
];

// Палитра зданий — рисованные map_* (bld_*-PNG больше не грузим,
// старые ключи подменяются resolveBuildingTex при показе/сохранении).
const BUILDING_DEFS = [
  { tex: 'map_shop',    label: 'Магазин',   w: 260, h: 200 },
  { tex: 'map_apteka',  label: 'Аптека',    w: 240, h: 200 },
  { tex: 'map_stol',    label: 'Столовая',  w: 260, h: 200 },
  { tex: 'map_kino',    label: 'Кино',      w: 280, h: 200 },
  { tex: 'map_pochta',  label: 'Почта',     w: 260, h: 200 },
  { tex: 'map_garage',  label: 'Гараж',     w: 260, h: 200 },
  { tex: 'map_zdanie',  label: 'Здание',    w: 280, h: 220 },
  { tex: 'map_bigdom',  label: 'Дом',       w: 300, h: 240 },
  { tex: 'map_mini_dom', label: 'Дом малый', w: 240, h: 200 },
  { tex: 'map_domik',   label: 'Домик',     w: 260, h: 200 },
  { tex: 'map_domik2',  label: 'Домик 2',   w: 260, h: 200 },
  { tex: 'map_sarai',   label: 'Сарай',     w: 260, h: 200 },
  { tex: 'map_derevdom', label: 'Сарай 2',  w: 240, h: 200 },
  { tex: 'map_crate',   label: 'Ящики',     w: 120, h: 100 },
  { tex: 'map_rabica',  label: 'Забор',     w: 200, h: 140 }
];

const SPAWN_TYPES = {
  player: { color: 0x44ccff, label: 'Игрок', letter: 'P' },
  team:   { color: 0x3399ff, label: 'Команда', letter: 'T' },
  enemy:  { color: 0xff5555, label: 'Враг', letter: 'E' },
  medkit: { color: 0x33cc55, label: 'Аптечка', letter: '+' },
  armor:  { color: 0x5588ff, label: 'Броня', letter: 'A' },
  ammo:   { color: 0x8a5a2a, label: 'Патроны', letter: 'M' },
  frag:   { color: 0x88aa22, label: 'Граната', letter: 'G' },
  smoke:  { color: 0x9a9a9a, label: 'Дымовая', letter: 'D' }
};

const ITEM_SPAWN_TYPES = ['medkit', 'armor', 'ammo', 'frag', 'smoke'];
const COMBAT_SPAWN_TYPES = ['player', 'team', 'enemy'];
const GRID_SIZE = 40;

const THEMES = [
  { id: 'night',     label: 'Ночь',       bg: '#0a0a2a', bgTex: null },
  { id: 'sunset',    label: 'Закат',      bg: '#241024', bgTex: null },
  { id: 'wasteland', label: 'Пустошь',    bg: '#1a1c12', bgTex: null },
  { id: 'krisha',    label: 'Город',      bg: '#1a1820', bgTex: 'fon_krisha' },
  { id: 'ulica',     label: 'Улица',      bg: '#181620', bgTex: 'fon_ulici' },
  { id: 'pechera',   label: 'Пещера',     bg: '#080808', bgTex: 'fon_pechera' },
  { id: 'peshera',   label: 'Пещера 2',   bg: '#0a0a0c', bgTex: 'fon_peshera' },
  { id: 'pustoch',   label: 'Руины',      bg: '#1a1208', bgTex: 'fon_pustoch' },
  { id: 'pustinya',  label: 'Пустыня',    bg: '#2a2418', bgTex: 'fon_pustinya' },
  { id: 'zavod',     label: 'Завод',      bg: '#12141a', bgTex: 'fon_zavod' }
];

export default class LevelEditorScene extends Phaser.Scene {
  constructor() {
    super('LevelEditorScene');
  }

  create(data) {
    this.levelTheme = 'night';
    // ПКМ — удаление объектов: без этого браузер открывает своё меню
    // и удалять нормально невозможно.
    if (this.input.mouse && this.input.mouse.disableContextMenu) {
      this.input.mouse.disableContextMenu();
    }
    this.cameras.main.setBackgroundColor(this.themeDef().bg);
    this.editingId = (data && data.editingId) != null ? data.editingId : null;
    const _cx = gameW(this) / 2;
    const _dx = _cx - 640;

    this.mapWidth = 2400;
    this.mapHeight = 900;

    this.bgImg = null;
    this.updateEditorBg();

    this.objects = [];
    this.objectsGroup = this.add.container(0, 0);

    this.activeTool = 'wall';
    this.spawnMode = false;
    this.activeSpawnType = 'player';
    this.activeBuilding = 0;
    this.activeGround = 0;

    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.selected = null;
    this.resizeHandles = [];
    this.resizeState = null;
    this.handlesGroup = this.add.container(0, 0);

    this.gridEnabled = false;
    this.gridGfx = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.settingsPanel = null;

    this.add.text(_cx, 24, this.editingId != null ? 'РЕДАКТИРОВАНИЕ УРОВНЯ' : 'НОВЫЙ УРОВЕНЬ', {
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0);

    this.levelNameText = this.add.text(_cx, 58, 'Мой уровень', {
      fontSize: '18px',
      color: '#ffdd55',
      fontStyle: 'bold',
      backgroundColor: '#00000088',
      padding: 6
    }).setOrigin(0.5).setScrollFactor(0);
    this.levelNameText.setData('isUI', true);
    this.levelNameText.setInteractive({ useHandCursor: true });
    this.levelNameText.on('pointerdown', () => {
      const n = prompt('Имя уровня:', this.levelNameText.text);
      if (n) this.levelNameText.setText(n);
    });
    this.add.text(_cx, 82, 'нажми на имя, чтобы переименовать', {
      fontSize: '11px',
      color: '#778888'
    }).setOrigin(0.5).setScrollFactor(0);

    this.add.text(UX(this, 20), 120, 'Q — стена   W — укрытие   E — платформа   R — земля   B — здание', {
      fontSize: '14px',
      color: '#88aacc'
    }).setScrollFactor(0);
    this.add.text(UX(this, 20), 140, '1-3 — спавны (игрок/союзник/враг)   4-8 — предметы (аптечка/броня/патроны/граната/дым)', {
      fontSize: '13px',
      color: '#88aacc'
    }).setScrollFactor(0);
    this.add.text(UX(this, 20), 160, 'ЛКМ — добавить / перетащить   ПКМ или Delete — удалить', {
      fontSize: '13px',
      color: '#556677'
    }).setScrollFactor(0);
    this.add.text(UX(this, 20), 178, 'тяни за жёлтые углы — размер   Ctrl+колесо — прозрачность   ESC/middle — панорама', {
      fontSize: '13px',
      color: '#556677'
    }).setScrollFactor(0);
    this.add.text(UX(this, 20), 196, 'Ctrl+колесо — прозрачность   тяни угол/грань — ресайз   G — сетка/прилипание', {
      fontSize: '13px',
      color: '#556677'
    }).setScrollFactor(0);

    this.toolIndicator = this.add.text(_cx, 112, '', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffee88'
    }).setOrigin(0.5).setScrollFactor(0);

    if (this.editingId != null) {
      const lvl = loadCustomLevels().find(l => l.id === this.editingId);
      if (lvl) this.loadLevel(lvl);
    }

    this.setupInput();
    this.updateToolIndicator();

    this.makeBtn(_cx, 690, 'Сохранить', () => this.onSave(), '#287a45', 24);

    this.makeBtn(830 + _dx, 690, 'Отмена', () => this.scene.start('MyLevelsScene'), '#553333', 20);

    this.makeBtn(300 + _dx, 690, 'Настройки', () => this.openSettingsPanel(), '#2a2a5a', 18);
    this.makeBtn(110 + _dx, 690, 'Проверить', () => this.showValidation(), '#2a2a5a', 16);
    this._bgBtn = this.makeBtn(480 + _dx, 690, `Фон: ${this.themeDef().label}`, () => this.cycleTheme(), '#2a2a5a', 14);

    this.buildingPanel = null;
    this.buildingPanelScroll = 0;
  }

    themeDef() {
    return THEMES.find(t => t.id === this.levelTheme) || THEMES[0];
  }

  // Клик по UI — не трогает карту: иначе каждый клик по кнопкам
  // (Сохранить, панель зданий, корзина) ставил бы стену/спавн позади.
  _pointerOnUI(pointer) {
      try {
        const hits = this.input.hitTestPointer(pointer) || [];
        for (const h of hits) {
          if (h && typeof h.getData === 'function' && h.getData('isUI')) return true;
        }
      } catch (e) {}
      return false;
    }

  onSave() {
    const v = this.validateLevel();
    if (v.errors.length) {
      window.alert('Не могу сохранить:\n- ' + v.errors.join('\n- '));
      return;
    }
    if (v.warnings.length) {
      if (!window.confirm('Предупреждения:\n- ' + v.warnings.join('\n- ') + '\n\nВсё равно сохранить?')) return;
    }
    this.saveLevel();
    this.scene.start('MyLevelsScene');
  }

  showValidation() {
    const v = this.validateLevel();
    const parts = [
      ...v.errors.map(e => 'ОШИБКА: ' + e),
      ...v.warnings.map(w => 'Предупреждение: ' + w)
    ];
    window.alert(parts.length ? parts.join('\n') : 'Уровень в порядке ✓');
  }

  validateLevel() {
    const errors = [];
    const warnings = [];
    if (!this.objects.some(o => o.type === 'ground')) errors.push('нет земли');
    if (!this.objects.some(o => o.type === 'spawn' && o.spawnType === 'player')) errors.push('нет спавна игрока');
    if (!this.objects.some(o => o.type === 'spawn' && o.spawnType === 'enemy')) errors.push('нет ни одного врага');
    // Здания — тоже твёрдые (в игре лежат в covers): спавн на крыше не «парит».
    const solids = this.objects.filter(o => o.type === 'ground' || o.type === 'platform' || o.type === 'wall' || o.type === 'cover' || o.type === 'building');
    this.objects.filter(o => o.type === 'spawn' && COMBAT_SPAWN_TYPES.includes(o.spawnType)).forEach(sp => {
      const hasFloor = solids.some(s =>
        Math.abs(sp.x - s.x) <= Math.max(10, s.w / 2) &&
        Math.abs((s.y - s.h / 2) - (sp.y + 24)) <= 16
      );
      if (!hasFloor) warnings.push(`спавн ${SPAWN_TYPES[sp.spawnType].label} (${Math.round(sp.x)}, ${Math.round(sp.y)}) возможно парит в воздухе`);
    });
    return { errors, warnings };
  }

  loadLevel(lvl) {
    this.levelNameText.setText(lvl.name || 'Мой уровень');
    this.mapWidth = lvl.width || 2400;
    this.mapHeight = lvl.height || 900;
    this.levelTheme = lvl.theme || 'night';
    this.cameras.main.setBackgroundColor(this.themeDef().bg);
    const objects = lvl.objects || [];
    objects.forEach(o => {
      if (o.spawnType) {
        this.addSpawn(o.x, o.y, o.spawnType);
      } else if (o.type === 'ground') {
        this.addGround(o.y, o.h || 80, true, o.a, o.x, o.w, o.texKey);
      } else if (o.type === 'building') {
        this.addObject(o.x, o.y, 'building', o.w || 200, o.h || 200, o.a, o.texKey);
      } else if (o.type === 'platform') {
        this.addObject(o.x, o.y, 'platform', o.w, o.h, o.a);
      } else if (o.type === 'wall') {
        this.addObject(o.x, o.y, 'wall', o.w, o.h, o.a);
      } else {
        this.addObject(o.x, o.y, 'cover', o.w || 60, o.h || 86, o.a);
      }
    });
  }

  setupInput() {
    this.input.keyboard.on('keydown-Q', () => { this.spawnMode = false; this.activeTool = 'wall'; this.updateToolIndicator(); });
    this.input.keyboard.on('keydown-W', () => { this.spawnMode = false; this.activeTool = 'cover'; this.updateToolIndicator(); });
    this.input.keyboard.on('keydown-E', () => { this.spawnMode = false; this.activeTool = 'platform'; this.updateToolIndicator(); });
    this.input.keyboard.on('keydown-R', () => {
      this.spawnMode = false;
      // Повторное R при земле — следующий вариант (цвет/текстуры).
      if (this.activeTool === 'ground') {
        const list = this._groundVariants();
        this.activeGround = ((this.activeGround || 0) + 1) % list.length;
      } else {
        this.activeTool = 'ground';
      }
      this.updateToolIndicator();
    });
    // Цифры 1-8: в режиме зданий выбирают здание (1-0), иначе — спавны.
    // Раньше оба хендлера срабатывали сразу и инструмент слетал на спавн.
    this._pickSpawnOrBuilding = (bIdx, spawnType) => {
      if (this.activeTool === 'building') {
        this.activeBuilding = bIdx;
      } else {
        this.spawnMode = true;
        this.activeSpawnType = spawnType;
      }
      this.updateToolIndicator();
    };
    this.input.keyboard.on('keydown-ONE',   () => this._pickSpawnOrBuilding(0, 'player'));
    this.input.keyboard.on('keydown-TWO',   () => this._pickSpawnOrBuilding(1, 'team'));
    this.input.keyboard.on('keydown-THREE', () => this._pickSpawnOrBuilding(2, 'enemy'));
    this.input.keyboard.on('keydown-FOUR',  () => this._pickSpawnOrBuilding(3, 'medkit'));
    this.input.keyboard.on('keydown-FIVE',  () => this._pickSpawnOrBuilding(4, 'armor'));
    this.input.keyboard.on('keydown-SIX',   () => this._pickSpawnOrBuilding(5, 'ammo'));
    this.input.keyboard.on('keydown-SEVEN', () => this._pickSpawnOrBuilding(6, 'frag'));
    this.input.keyboard.on('keydown-EIGHT', () => this._pickSpawnOrBuilding(7, 'smoke'));
    this.input.keyboard.on('keydown-B', () => {
      if (this.buildingPanel) {
        // Повторное B закрывает панель и возвращает стену,
        // а не оставляет инструмент без выбора.
        this.toggleBuildingPanel();
        this.spawnMode = false;
        this.activeTool = 'wall';
      } else {
        this.spawnMode = false;
        this.activeTool = 'building';
        this.toggleBuildingPanel();
      }
      this.updateToolIndicator();
    });
    for (let i = 0; i < Math.min(BUILDING_DEFS.length, 10); i++) {
      const key = i < 9 ? `keydown-${i + 1}` : 'keydown-ZERO';
      this.input.keyboard.on(key, () => {
        if (this.activeTool === 'building') {
          this.activeBuilding = i;
          this.updateToolIndicator();
        }
      });
    }
    this.input.keyboard.on('keydown-UP', () => {
      if (this.activeTool === 'building') {
        this.activeBuilding = (this.activeBuilding + 1) % BUILDING_DEFS.length;
        this.updateToolIndicator();
      }
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      if (this.activeTool === 'building') {
        this.activeBuilding = (this.activeBuilding - 1 + BUILDING_DEFS.length) % BUILDING_DEFS.length;
        this.updateToolIndicator();
      }
    });
    // Delete — удалить выбранный объект (раньше только ПКМ, которое
    // перехватывал браузер).
    this.input.keyboard.on('keydown-DELETE', () => {
      if (!this.selected) return;
      const o = this.selected;
      if (o.gfx) {
        this.objectsGroup.remove(o.gfx);
        o.gfx.destroy();
      }
      const idx = this.objects.indexOf(o);
      if (idx >= 0) this.objects.splice(idx, 1);
      this.selected = null;
      this.highlightSelection();
    });
    this.input.keyboard.on('keydown-G', () => {
      this.gridEnabled = !this.gridEnabled;
      this.toolIndicator.setText(this.gridEnabled ? 'Сетка: ВКЛ (40px, прилипание)' : 'Сетка: ВЫКЛ');
      this.time.delayedCall(800, () => this.updateToolIndicator());
    });

    this.input.on('pointerdown', pointer => {
      if (this._pointerOnUI(pointer)) return;
      if (pointer.leftButtonDown()) {
        const handle = this.hitHandle(pointer.worldX, pointer.worldY);
        if (handle && this.selected) {
          const o = this.selected;
          this.resizeState = {
            o,
            edge: handle.edge,
            L: o.x - o.w / 2,
            R: o.x + o.w / 2,
            T: o.y - o.h / 2,
            B: o.y + o.h / 2
          };
          return;
        }
        const hit = this.objects.find(o =>
          Math.abs(pointer.worldX - o.x) <= Math.max(10, o.w / 2) &&
          Math.abs(pointer.worldY - o.y) <= Math.max(10, o.h / 2)
        );
        if (hit && hit.type !== 'spawn') {
          const dx = pointer.worldX - hit.x;
          const dy = pointer.worldY - hit.y;
          const hw = hit.w / 2;
          const hh = hit.h / 2;
          const edgeThreshold = 16;
          const nearEdge =
            Math.abs(Math.abs(dx) - hw) < edgeThreshold ||
            Math.abs(Math.abs(dy) - hh) < edgeThreshold;
          if (nearEdge) {
            let edge = '';
            if (Math.abs(dx) >= hw - edgeThreshold) edge += dx > 0 ? 'e' : 'w';
            if (Math.abs(dy) >= hh - edgeThreshold) edge += dy > 0 ? 's' : 'n';
            if (!edge) edge = dx > 0 ? 'e' : 'w';
            this.selected = hit;
            this.highlightSelection();
            this.resizeState = {
              o: hit,
              edge,
              L: hit.x - hit.w / 2,
              R: hit.x + hit.w / 2,
              T: hit.y - hit.h / 2,
              B: hit.y + hit.h / 2
            };
            return;
          }
        }
        if (hit) {
          this.selected = hit;
          this.highlightSelection();
          if (!hit.locked) {
            this.dragging = hit;
            this.dragOffset.x = pointer.worldX - hit.x;
            this.dragOffset.y = pointer.worldY - hit.y;
          }
          return;
        }
        this.selected = null;
        this.highlightSelection();
        let px = pointer.worldX;
        let py = pointer.worldY;
        if (this.gridEnabled) {
          px = this.snapV(px);
          py = this.snapV(py);
        }
        if (this.spawnMode) {
          this.addSpawn(px, py, this.activeSpawnType);
        } else if (this.activeTool === 'ground') {
          const gd = this._groundDef();
          const groundH = OBJECT_TYPES.ground.h;
          this.addGround(this.mapHeight - groundH / 2, groundH, false, 1, undefined, undefined, gd.tex);
        } else if (this.activeTool === 'building') {
          const bd = BUILDING_DEFS[this.activeBuilding];
          // Без текстуры не ставим: вместо здания встал бы пустой прямоугольник.
          if (!bd || !this.textures.exists(bd.tex)) {
            this.toolIndicator.setText(`Нет текстуры ${bd ? bd.tex : '?'} — здание не ставится`);
            return;
          }
          this.addObject(px, py, 'building', bd.w, bd.h, 1, bd.tex);
        } else {
          const def = OBJECT_TYPES[this.activeTool];
          this.addObject(px, py, this.activeTool, def.w, def.h);
        }
      }
      if (pointer.rightButtonDown()) {
        this.removeObjectAt(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on('pointermove', pointer => {
      if (this.resizeState) {
        this.applyResize(pointer.worldX, pointer.worldY);
        return;
      }
      if (this.dragging) {
        let nx = pointer.worldX - this.dragOffset.x;
        let ny = pointer.worldY - this.dragOffset.y;
        if (this.gridEnabled) {
          nx = this.snapV(nx);
          ny = this.snapV(ny);
        }
        // Земель много — каждая двигается свободно (лока на центр нет).
        this.dragging.x = nx;
        this.dragging.y = ny;
        if (this.dragging.gfx) {
          this.dragging.gfx.x = nx;
          this.dragging.gfx.y = ny;
        }
      }
    });

    this.input.on('pointerup', () => {
      if (this.resizeState) {
        this.selected = this.resizeState.o;
        this.resizeState = null;
        this.highlightSelection();
      }
      if (this.dragging) {
        this.dragging = null;
      }
    });

    this.input.on('pointerdown', pointer => {
      if (pointer.middleButtonDown() && !this._pointerOnUI(pointer)) {
        this._pan = { x: pointer.x, y: pointer.y };
      }
    });
    this.input.on('pointermove', pointer => {
      if (this._pan) {
        this.cameras.main.scrollX -= (pointer.x - this._pan.x);
        this.cameras.main.scrollY -= (pointer.y - this._pan.y);
        this._pan = { x: pointer.x, y: pointer.y };
      }
    });
    this.input.on('pointerup', () => { this._pan = null; });

    this.input.keyboard.on('keydown-ESC', () => {
      this.cameras.main.setScroll(0, 0);
      this.cameras.main.setZoom(1);
    });

    this.input.on('wheel', (pointer, over, deltaX, deltaY, deltaZ) => {
      // Колесо — ТОЛЬКО зум камеры (и Ctrl+колесо — прозрачность).
      // Растягивание — тяни за жёлтые квадратики на гранях с зажатой ЛКМ.
      // Над панелью зданий колесо крутит список, а не зум.
      if (this._wheelOverPanel(pointer)) {
        this._scrollPanel(deltaY > 0 ? 1 : -1);
        return;
      }
      const hover = this.objects.find(o =>
        Math.abs(pointer.worldX - o.x) <= Math.max(10, o.w / 2) &&
        Math.abs(pointer.worldY - o.y) <= Math.max(10, o.h / 2)
      );
      if (hover && hover.type !== 'spawn' && pointer.ctrlKey) {
        this.setObjectAlpha(hover, deltaY > 0 ? 0.1 : -0.1);
        return;
      }
      const step = deltaY > 0 ? -0.12 : 0.12;
      const z = Phaser.Math.Clamp(this.cameras.main.zoom + step, 0.35, 2);
      this.cameras.main.setZoom(z);
    });
  }

  hitHandle(x, y) {
    // Допуск в экранных пикселях: на дальнем зуме квадратики мелкие.
    const tol = 12 / Math.max(0.35, this.cameras.main.zoom);
    for (const h of this.resizeHandles) {
      if (Phaser.Math.Distance.Between(x, y, h.x, h.y) <= tol) {
        return h;
      }
    }
    return null;
  }

  applyResize(px, py) {
    const s = this.resizeState;
    const o = s.o;
    if (!o || !o.gfx || !o.gfx.parent) {
      this.resizeState = null;
      return;
    }
    let L = s.L, R = s.R, T = s.T, B = s.B;
    if (s.edge.includes('w')) L = px;
    if (s.edge.includes('e')) R = px;
    if (s.edge.includes('n')) T = py;
    if (s.edge.includes('s')) B = py;
    if (R - L < 20) R = L + 20;
    if (B - T < 20) B = T + 20;
    // Земель может быть много — каждая тянется свободно (лока на центр нет).
    o.x = (L + R) / 2;
    o.y = (T + B) / 2;
    o.w = R - L;
    o.h = B - T;
    this.drawObject(o);
    // Картинки (здания, текстурная земля) drawObject не трогает — тянем сами.
    if (o.gfx && o.gfx.type === 'Image') o.gfx.setDisplaySize(o.w, o.h);
    this.drawHandles();
  }

  setObjectAlpha(o, delta) {
    o.a = Phaser.Math.Clamp((o.a == null ? 1 : o.a) + delta, 0.15, 1);
    if (o.gfx && o.gfx.type === 'Image') {
      o.gfx.setAlpha(o.a);
    } else {
      this.drawObject(o);
    }
    this.toolIndicator.setText(
      `${this._objLabel(o)}   прозрачность: ${Math.round(o.a * 100)}%`
    );
    this.time.delayedCall(1200, () => this.updateToolIndicator());
  }

  _objLabel(o) {
    if (o.type === 'spawn') return `Спавн: ${SPAWN_TYPES[o.spawnType]?.label || o.spawnType}`;
    if (o.type === 'ground') return 'Земля';
    if (o.type === 'building') {
      const def = BUILDING_DEFS.find(d => d.tex === o.texKey);
      return `Здание: ${def ? def.label : o.texKey} (${Math.round(o.w)}x${Math.round(o.h)})`;
    }
    return `Блок: ${o.type} (${o.w}x${o.h})`;
  }

  snapV(v) {
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

  // UI не отдаляется с зумом камеры: каждый кадр возвращаем интерфейсу
  // экранный размер/позицию (компенсация зума). Мир и сетку не трогаем.
  // UI = scrollFactorX 0 (+ маска панели), либо UI-контейнеры (у контейнеров
  // scrollFactor нет — исключаем только мировые objectsGroup/handlesGroup).
  // База запоминается при первом кадре объекта.
  // ВАЖНО: зум крутится вокруг центра камеры (640,360), а не нуля —
  // компенсация идёт от пивота, иначе UI уплывает (проверено замером).
  _fixUI() {
    const cam = this.cameras.main;
    const z = cam.zoom || 1;
    const maskShape = this.buildingPanel && this.buildingPanel._maskShape;
    // Маска панели живёт вне display list — фиксим вручную, тем же
    // преобразованием, иначе она уезжает от компенсированного контента.
    if (maskShape) this._fixUIObj(maskShape, z);
    const content = this.buildingPanel && this.buildingPanel._content;
    const list = this.children.list;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o || o === this.gridGfx) continue;
      if (o === this.objectsGroup || o === this.handlesGroup) continue;
      // Контент панели скроллится — его ведём отдельно (см. ниже).
      if (o === content) continue;
      const sf = (typeof o.scrollFactorX === 'number') ? o.scrollFactorX : 0;
      if (sf !== 0 && o !== maskShape) continue;
      this._fixUIObj(o, z);
    }
    // Контент панели: РОВНО тот же трансформ, что у самой панели и маски
    // (иначе фон/заголовок и список разъезжаются при зуме — было на скрине),
    // плюс скролл списка. Абсолютное позиционирование, не +=.
    if (content) {
      if (content._uix === undefined) content._uix = { x: content.x, y: content.y, sx: content.scaleX, sy: content.scaleY, z: 1 };
      const b = content._uix;
      const k = b.z / z;
      content.setPosition(
        640 + (b.x - 640) * k,
        360 + (b.y - 360) * k + (content.__scrollY || 0) * k
      );
      content.setScale(b.sx * k, b.sy * k);
    }
  }

  _fixUIObj(o, z) {
    // База — всегда в координатах дизайна (зум 1): весь UI прописан
    // константами под единицу, в какой бы момент объект ни создался.
    if (o._uix === undefined) {
      o._uix = { x: o.x, y: o.y, sx: o.scaleX, sy: o.scaleY, z: 1 };
    }
    const b = o._uix;
    const k = b.z / z;
    if (k === 1 && b.sx === o.scaleX) return;
    if (o.setPosition) o.setPosition(640 + (b.x - 640) * k, 360 + (b.y - 360) * k);
    if (o.setScale) o.setScale(b.sx * k, b.sy * k);
  }

  // Колесо над панелью зданий — крутит список, а не зум.
  _wheelOverPanel(pointer) {
    if (!this.buildingPanel) return false;
    const x = pointer.x;
    const y = pointer.y;
    return x >= gameW(this) - 190 && x <= gameW(this) - 10 && y >= 110 && y <= 660;
  }

  _scrollPanel(dir) {
    const p = this.buildingPanel;
    if (!p || !p._content) return;
    const minY = Math.min(0, p._visibleH - p._contentH);
    // Скролл храним отдельно: _fixUI каждый кадр пересчитывает позицию.
    p._content.__scrollY = Phaser.Math.Clamp((p._content.__scrollY || 0) + dir * 64, minY, 0);
  }

  // Подкрутить список к активному зданию (при открытии и смене).
  _scrollPanelToActive() {
    const p = this.buildingPanel;
    if (!p || !p._content) return;
    const cols = 3;
    const cellH = 64;
    const row = Math.floor((this.activeBuilding || 0) / cols);
    const minY = Math.min(0, p._visibleH - p._contentH);
    p._content.__scrollY = Phaser.Math.Clamp(p._visibleH / 2 - (row * cellH + cellH / 2), minY, 0);
  }

  update() {
    this._fixUI();
    if (!this.gridEnabled) return;
    const cam = this.cameras.main;
    const g = this.gridGfx;
    g.clear();
    if (cam.zoom < 0.12) return;
    g.lineStyle(1, 0x7aaaff, 0.12);
    const gs = GRID_SIZE;
    const xEnd = cam.scrollX + cam.width / cam.zoom;
    for (let wx = Math.floor(cam.scrollX / gs) * gs; wx <= xEnd; wx += gs) {
      const sx = (wx - cam.scrollX) * cam.zoom;
      if (sx < 0) continue;
      g.lineBetween(sx, 0, sx, cam.height);
    }
    const yEnd = cam.scrollY + cam.height / cam.zoom;
    for (let wy = Math.floor(cam.scrollY / gs) * gs; wy <= yEnd; wy += gs) {
      const sy = (wy - cam.scrollY) * cam.zoom;
      if (sy < 0) continue;
      g.lineBetween(0, sy, cam.width, sy);
    }
  }

  openSettingsPanel() {
    const _cx = gameW(this) / 2;
    const _dx = _cx - 640;
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = null;
      return;
    }
    const c = this.add.container(0, 0);
    c.add(this.add.rectangle(_cx, 320, 380, 300, 0x14143a, 0.96).setScrollFactor(0).setInteractive().setData('isUI', true));
    c.add(this.add.text(_cx, 200, 'НАСТРОЙКИ УРОВНЯ', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0));
    this._mwLabel = this.add.text(470 + _dx, 260, '', { fontSize: '15px', color: '#ffee88' }).setOrigin(0.5).setScrollFactor(0);
    c.add(this._mwLabel);
    c.add(this.makeBtn(560 + _dx, 260, '−', () => this.changeMapSize(-200, 0), '#2a2a5a', 18));
    c.add(this.makeBtn(720 + _dx, 260, '+', () => this.changeMapSize(200, 0), '#2a2a5a', 18));
    this._mhLabel = this.add.text(470 + _dx, 315, '', { fontSize: '15px', color: '#ffee88' }).setOrigin(0.5).setScrollFactor(0);
    c.add(this._mhLabel);
    c.add(this.makeBtn(560 + _dx, 315, '−', () => this.changeMapSize(0, -100), '#2a2a5a', 18));
    c.add(this.makeBtn(720 + _dx, 315, '+', () => this.changeMapSize(0, 100), '#2a2a5a', 18));
    this._thLabel = this.add.text(_cx, 375, '', { fontSize: '15px', color: '#ffee88' }).setOrigin(0.5).setScrollFactor(0);
    c.add(this._thLabel);
    c.add(this.makeBtn(_cx, 415, 'Сменить тему', () => this.cycleTheme(), '#2a2a5a', 14));
    c.add(this.makeBtn(_cx, 470, 'Готово', () => this.openSettingsPanel(), '#287a45', 16));
    this.settingsPanel = c;
    this.refreshSettingsLabels();
  }

  refreshSettingsLabels() {
    if (this._mwLabel) this._mwLabel.setText(`Ширина: ${this.mapWidth}`);
    if (this._mhLabel) this._mhLabel.setText(`Высота: ${this.mapHeight}`);
    if (this._thLabel) this._thLabel.setText(`Тема: ${this.themeDef().label}`);
    if (this._bgBtn) this._bgBtn.setText(`Фон: ${this.themeDef().label}`);
  }

  changeMapSize(dw, dh) {
    const oldH = this.mapHeight;
    this.mapWidth = Phaser.Math.Clamp(this.mapWidth + dw, 1200, 4800);
    this.mapHeight = Phaser.Math.Clamp(this.mapHeight + dh, 600, 1800);
    // Все земли, лежавшие на дне, остаются на дне; картинки-земли
    // тоже тянутся (drawObject их не трогает — только displaySize).
    this.objects.filter(o => o.type === 'ground').forEach((ground, gi) => {
      if (gi === 0) {
        ground.w = this.mapWidth;
        ground.x = this.mapWidth / 2;
      }
      if (Math.abs((ground.y + ground.h / 2) - oldH) <= 2) {
        ground.y = this.mapHeight - ground.h / 2;
      }
      if (ground.gfx) {
        if (ground.gfx.type === 'Image') {
          ground.gfx.setDisplaySize(ground.w, ground.h);
          ground.gfx.x = ground.x;
          ground.gfx.y = ground.y;
        } else {
          ground.gfx.x = ground.x;
          ground.gfx.y = ground.y;
        }
      }
      this.drawObject(ground);
    });
    this.refreshSettingsLabels();
  }

  cycleTheme() {
    const idx = THEMES.findIndex(t => t.id === this.levelTheme);
    this.levelTheme = THEMES[(idx + 1) % THEMES.length].id;
    this.cameras.main.setBackgroundColor(this.themeDef().bg);
    this.updateEditorBg();
    this.refreshSettingsLabels();
  }

  updateEditorBg() {
    if (this.bgImg) {
      this.bgImg.destroy();
      this.bgImg = null;
    }
    // Превью — та же рисованная панорама, что в бою (WYSIWYG).
    // PNG fon_* больше не грузим; ветка с bgTex — страховочный фолбэк.
    const th = this.themeDef();
    let key = null;
    try {
      const pano = bakePanorama(this, this.levelTheme);
      if (pano && this.textures.exists(pano)) key = pano;
    } catch (e) {}
    if (!key && th.bgTex && this.textures.exists(th.bgTex)) key = th.bgTex;
    if (key) {
      const tex = this.textures.get(key);
      const src = tex.getSourceImage();
      const ratio = src.height / src.width;
      const bgW = this.mapWidth;
      const bgH = Math.round(bgW * ratio);
      this.bgImg = this.add.image(this.mapWidth / 2, this.mapHeight - bgH / 2, key);
      this.bgImg.setDisplaySize(bgW, bgH);
      this.bgImg.setDepth(-1);
    }
  }

  drawObject(o) {
    const g = o.gfx;
    if (!g || !g.parent) return;
    if (o.type === 'building') return;
    if (typeof g.clear !== 'function') return;
    g.clear();
    const a = o.a == null ? 1 : o.a;
    if (o.type === 'spawn') return;
    if (o.type === 'ground') {
      g.fillStyle(OBJECT_TYPES.ground.color, a);
      g.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
      g.lineStyle(2, 0xc8a878, 0.9 * a);
      g.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
      return;
    }
    const def = OBJECT_TYPES[o.type];
    g.fillStyle(def.color, 0.92 * a);
    g.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
    g.lineStyle(2, 0xffffff, 0.7 * a);
    g.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
  }

  highlightSelection() {
    this.objects.forEach(o => {
      if (o.type === 'spawn' || o.type === 'ground') return;
      if (o.type === 'building') {
        if (o === this.selected) {
          o.gfx.setTint(0xffffaa);
        } else {
          o.gfx.clearTint();
        }
        return;
      }
      const isSel = o === this.selected;
      o.gfx.lineStyle(3, isSel ? 0xffff44 : 0xffffff, isSel ? 1 : 0.7);
      o.gfx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
    });
    this.drawHandles();
  }

  drawHandles() {
    this.handlesGroup.removeAll(true);
    this.resizeHandles = [];
    const o = this.selected;
    if (!o || o.type === 'spawn') return;
    const L = o.x - o.w / 2, R = o.x + o.w / 2;
    const T = o.y - o.h / 2, B = o.y + o.h / 2;
    let edges = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    // Земля тянется и вширь (сегменты), и ввысь.
    if (o.type === 'ground') edges = ['n', 's', 'e', 'w'];
    const pts = {
      nw: [L, T], n: [o.x, T], ne: [R, T],
      e: [R, o.y], se: [R, B], s: [o.x, B],
      sw: [L, B], w: [L, o.y]
    };
    edges.forEach(edge => {
      const [hx, hy] = pts[edge];
      const h = this.add.graphics();
      h.fillStyle(0xffdd44, 0.95);
      h.fillRect(hx - 5, hy - 5, 10, 10);
      h.lineStyle(1, 0x000000, 1);
      h.strokeRect(hx - 5, hy - 5, 10, 10);
      this.handlesGroup.add(h);
      this.resizeHandles.push({ x: hx, y: hy, edge });
    });

    if (o.type !== 'ground') {
      const barY = T - 24;
      const delBtn = this.add.text(L, barY, '🗑', {
        fontSize: '16px', backgroundColor: '#553333', padding: 4
      }).setOrigin(0.5).setDepth(120);
      delBtn.setData('isUI', true);
      delBtn.setInteractive({ useHandCursor: true });
      delBtn.on('pointerdown', () => {
        this.objectsGroup.remove(o.gfx);
        o.gfx.destroy();
        const idx = this.objects.indexOf(o);
        if (idx >= 0) this.objects.splice(idx, 1);
        this.selected = null;
        this.highlightSelection();
      });
      this.handlesGroup.add(delBtn);

      const lockLabel = o.locked ? '🔓' : '🔒';
      const lockBtn = this.add.text(L + 28, barY, lockLabel, {
        fontSize: '16px', backgroundColor: '#2a2a5a', padding: 4
      }).setOrigin(0.5).setDepth(120);
      lockBtn.setData('isUI', true);
      lockBtn.setInteractive({ useHandCursor: true });
      lockBtn.on('pointerdown', () => {
        o.locked = !o.locked;
        this.highlightSelection();
      });
      this.handlesGroup.add(lockBtn);
    }
  }

    makeBtn(x, y, label, cb, bg = '#252560', fs = 18) {
    const btn = this.add.text(x, y, label, {
      fontSize: `${fs}px`,
      color: '#ffffff',
      backgroundColor: bg,
      padding: 10
    }).setOrigin(0.5).setScrollFactor(0);
    btn.setData('isUI', true);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', cb);
    btn.on('pointerover', () => btn.setStyle({ color: '#ffff55' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
    return btn;
  }

  updateToolIndicator() {
    if (this.spawnMode) {
      this.toolIndicator.setText(`Спавн: ${SPAWN_TYPES[this.activeSpawnType].label}`);
    } else if (this.activeTool === 'ground') {
      const gd = this._groundDef();
      this.toolIndicator.setText(`Земля: ${gd.label} (R — сменить, можно несколько)`);
    } else if (this.activeTool === 'building') {
      const bd = BUILDING_DEFS[this.activeBuilding];
      this.toolIndicator.setText(`Здание: ${bd.label}  (B+↑↓ или 1-0 — смена, тяни за жёлтые углы)`);
      this._scrollPanelToActive();
    } else {
      const extra = this.selected && this.selected.type === this.activeTool &&
        this.selected.a != null
        ? `  α=${Math.round(this.selected.a * 100)}%`
        : '';
      this.toolIndicator.setText(`Блок: ${this.activeTool}  (${OBJECT_TYPES[this.activeTool].w}x${OBJECT_TYPES[this.activeTool].h})${extra}`);
    }
    this.highlightBuildingInPanel();
  }

  toggleBuildingPanel() {
    if (this.buildingPanel) {
      this.buildingPanel.destroy();
      this.buildingPanel = null;
      return;
    }
    const panelW = 180;
    const cellH = 64;
    const panelH = 560;
    const startX = gameW(this) - panelW / 2 - 10;
    const startY = 130;
    const c = this.add.container(0, 0);
    c.setDepth(150);
    // Фон полностью непрозрачный + светлая подложка под миниатюры:
    // тёмные спрайты читаются, список не выглядит «прозрачным».
    c.add(this.add.rectangle(startX, startY + panelH / 2, panelW, panelH, 0x0a0a2a, 1).setScrollFactor(0));
    c.add(this.add.text(startX, startY - 20, 'ЗДАНИЯ', {
      fontSize: '13px', color: '#ffdd55', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0));
    const thumbSize = 48;
    const cols = 3;
    const cellW = panelW / cols;
    const visibleH = panelH - 40;
    const totalRows = Math.ceil(BUILDING_DEFS.length / cols);
    const contentH = totalRows * cellH;
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(startX - panelW / 2, startY, panelW, visibleH);
    const mask = maskShape.createGeometryMask();
    const content = this.add.container(0, 0);
    content.setMask(mask);
    BUILDING_DEFS.forEach((bd, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX - panelW / 2 + col * cellW + cellW / 2;
      const cy = startY + row * cellH + cellH / 2;
      const hasTex = this.textures.exists(bd.tex);
      const back = this.add.rectangle(cx, cy, thumbSize + 8, thumbSize + 8, 0x2a2a4a).setScrollFactor(0);
      content.add(back);
      if (hasTex) {
        const img = this.add.image(cx, cy, bd.tex).setDisplaySize(thumbSize, thumbSize).setScrollFactor(0);
        content.add(img);
      } else {
        const r = this.add.rectangle(cx, cy, thumbSize, thumbSize, 0x55556f).setScrollFactor(0);
        content.add(r);
      }
      const lbl = this.add.text(cx, cy + thumbSize / 2 + 2, bd.label, {
        fontSize: '8px', color: '#aabbcc'
      }).setOrigin(0.5, 0).setScrollFactor(0);
      content.add(lbl);
      const hit = this.add.rectangle(cx, cy, cellW - 4, cellH - 4, 0xffffff, 0).setScrollFactor(0);
      hit.setData('isUI', true);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.activeBuilding = i;
        this.spawnMode = false;
        this.activeTool = 'building';
        this.updateToolIndicator();
      });
      content.add(hit);
    });
    // Контент — внутрь панели (иначе висит на глубине 0 и не виден).
    c.add(content);
    this.buildingPanel = c;
    this.buildingPanel._content = content;
    this.buildingPanel._maskShape = maskShape;
    this.buildingPanel._startY = startY;
    this.buildingPanel._panelH = panelH;
    this.buildingPanel._contentH = contentH;
    this.buildingPanel._visibleH = visibleH;
    content.setY(0);
    this._scrollPanelToActive();
    this.highlightBuildingInPanel();
  }

  highlightBuildingInPanel() {
    if (!this.buildingPanel || !this.buildingPanel._content) return;
    const children = this.buildingPanel._content.list;
    let idx = 0;
    for (let i = 0; i < children.length; i++) {
      if (children[i].type === 'Rectangle' && children[i].fillAlpha === 0) {
        if (idx === this.activeBuilding) {
          children[i].setStrokeStyle(2, 0xffdd44);
        } else {
          children[i].setStrokeStyle(0);
        }
        idx++;
      }
    }
  }

  addObject(x, y, type, w, h, alpha, texKey) {
    // Старые уровни хранят bld_* — показываем рисованный аналог.
    if (type === 'building' && texKey) {
      try { texKey = resolveBuildingTex(texKey); } catch (e) {}
    }
    if (type === 'building' && texKey && this.textures.exists(texKey)) {
      const img = this.add.image(x, y, texKey);
      img.setDisplaySize(w, h);
      this.objectsGroup.add(img);
      this.objects.push({ type, x, y, w, h, gfx: img, texKey, a: alpha == null ? 1 : alpha });
      return;
    }
    const gfx = this.add.graphics();
    gfx.x = x;
    gfx.y = y;
    this.objectsGroup.add(gfx);
    this.objects.push({ type, x, y, w, h, gfx, a: alpha == null ? 1 : alpha });
    this.drawObject(this.objects[this.objects.length - 1]);
  }

  // Настоящий PNG (не canvas-заглушка): только его тянем картинкой.
  _isRealTex(key) {
    try {
      return !!(key && window.__realTextures && window.__realTextures.has(key));
    } catch (e) {
      return false;
    }
  }

  // Доступные варианты земли: plain всегда + текстуры с реальными PNG.
  _groundVariants() {
    return GROUND_DEFS.filter(g => !g.tex || this._isRealTex(g.tex));
  }

  _groundDef() {
    const list = this._groundVariants();
    return list[this.activeGround % list.length] || list[0];
  }

  addGround(y, h, silent, alpha, x, w, texKey) {
    const wdt = w || this.mapWidth;
    const cx = (x == null) ? this.mapWidth / 2 : x;
    const a = alpha == null ? 1 : alpha;
    const useTex = texKey && this.textures.exists(texKey) && this._isRealTex(texKey);
    let gfx;
    if (useTex) {
      gfx = this.add.image(cx, y, texKey);
      gfx.setDisplaySize(wdt, h);
      if (a < 1) gfx.setAlpha(a);
    } else {
      gfx = this.add.graphics();
      gfx.x = cx;
      gfx.y = y;
    }
    this.objectsGroup.add(gfx);
    const o = { type: 'ground', x: cx, y, w: wdt, h, gfx, a };
    if (useTex) o.texKey = texKey;
    this.objects.push(o);
    this.drawObject(o);
  }

  addSpawn(x, y, type) {
    const def = SPAWN_TYPES[type];
    const wrap = this.add.container(x, y);
    const gfx = this.add.graphics();
    gfx.fillStyle(def.color, 1);
    gfx.fillCircle(0, 0, 13);
    gfx.lineStyle(2, 0xffffff, 1);
    gfx.strokeCircle(0, 0, 13);
    wrap.add(gfx);
    const lbl = this.add.text(0, 0, def.letter, {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    wrap.add(lbl);
    this.objectsGroup.add(wrap);
    this.objects.push({ type: 'spawn', spawnType: type, x, y, w: 26, h: 26, gfx: wrap });
  }

  removeObjectAt(x, y) {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      const dx = Math.abs(x - o.x);
      const dy = Math.abs(y - o.y);
      const hit = (o.type === 'spawn')
        ? (dx <= 14 && dy <= 14)
        : (dx <= Math.max(10, o.w / 2) && dy <= Math.max(10, o.h / 2));
      if (hit) {
        this.objectsGroup.remove(o.gfx);
        o.gfx.destroy();
        this.objects.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  saveLevel() {
    const objects = this.objects.map(o => {
      if (o.type === 'spawn') {
        return { type: 'spawn', spawnType: o.spawnType, x: Math.round(this.clampX(o.x)), y: Math.round(this.clampY(o.y)) };
      }
      const obj = { type: o.type, x: Math.round(this.clampX(o.x)), y: Math.round(this.clampY(o.y)), w: Math.round(o.w), h: Math.round(o.h) };
      if (o.a != null && o.a < 1) obj.a = +(+o.a).toFixed(2);
      if (o.type === 'building' && o.texKey) obj.texKey = o.texKey;
      if (o.type === 'ground' && o.texKey) obj.texKey = o.texKey;
      return obj;
    });

    const enemies = objects.filter(o => o.spawnType === 'enemy').length;
    const levelDef = {
      name: this.levelNameText.text,
      width: this.mapWidth,
      height: this.mapHeight,
      theme: this.levelTheme,
      enemies: Math.max(1, enemies),
      objective: 'Уничтожить всех врагов',
      reward: { coins: 200, experience: 100 },
      objects
    };

    saveCustomLevel(levelDef, this.editingId);
  }

  clampX(v) {
    return Phaser.Math.Clamp(v, 60, this.mapWidth - 60);
  }

  clampY(v) {
    return Phaser.Math.Clamp(v, 120, this.mapHeight - 40);
  }
}
