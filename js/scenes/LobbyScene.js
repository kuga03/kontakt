import { gameState, saveGameState, renamePlayer, syncGameState } from '../data/gameState.js';
import { getBotDifficulty, nextBotDifficulty, botDifficulties } from '../data/difficulty.js';
import { campaignLevels } from '../data/levels.js';
import { classDefinitions, isClassUnlocked, classOpenLevel } from '../data/weapons.js';
import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';
import { gameW, UX } from '../ui/layout.js';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

// Режим свободной игры переживает перезагрузку (localStorage, как
// разрешение/лимит FPS в настройках). Битое значение — TDM.
const LOBBY_MODE_KEY = 'lobbyMode';
function getLobbyMode() {
  try {
    const v = localStorage.getItem(LOBBY_MODE_KEY);
    return ['FFA', 'TDM', 'CTF', 'BOMB', 'KOTH'].includes(v) ? v : 'TDM';
  } catch (e) { return 'TDM'; }
}
function saveLobbyMode(id) {
  try { localStorage.setItem(LOBBY_MODE_KEY, id); } catch (e) {}
}

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  // Кнопка как в главном меню: nine-slice подложка fon_btn (углы целы,
  // середина тянется), при наведении — pressed-слой + жёлтый текст.
  _mbtn(x, y, label, cb, opts = {}) {
    const fs = opts.fontSize || 22;
    const baseColor = opts.color || '#ffffff';
    const txt = this.add.text(0, 0, label, {
      fontSize: fs + 'px',
      color: opts.active ? '#ffff44' : baseColor
    }).setOrigin(0.5);
    // compact: меньше отступы → меньше PNG-подложка.
    // fixedW: единая ширина для ряда одинаковых кнопок.
    let tw = opts.fixedW || (txt.displayWidth + (opts.compact ? 48 : 96));
    let th = txt.displayHeight + (opts.compact ? 14 : 26);
    let bg = null;
    let bgPress = null;
    if (this.textures.exists('fon_btn')) {
      const src = this.textures.get('fon_btn').getSourceImage();
      const sw = Math.max(1, (src && src.width) || 1258);
      const sh = Math.max(1, (src && src.height) || 346);
      // ВАЖНО: равномерный масштаб по ширине, высота — строго по пропорциям
      // арта (th = tw / aspect). Старый max(th/sh, tw/sw) раздувал высокие
      // кнопки в высоту: широкие плашки (карта/боты/цель) становились
      // огромными и перекрывали соседей.
      const sc = tw / sw;
      th = Math.max(th, Math.round(sh * sc));
      // Текст не должен вылезать из плашки: если шрифт великоват для
      // узкой кнопки — ужмём текст, а не растянем фон.
      const maxTxtH = th * 0.62;
      if (txt.displayHeight > maxTxtH && txt.displayHeight > 0) {
        txt.setScale(maxTxtH / txt.displayHeight);
      }
      bg = this.add.image(0, 0, 'fon_btn');
      bg.setScale(sc);
      if (opts.green) bg.setTint(0x77dd77);
      if (this.textures.exists('fon_btn_pressed')) {
        bgPress = this.add.image(0, 0, 'fon_btn_pressed');
        bgPress.setScale(sc);
        if (opts.green) bgPress.setTint(0x77dd77);
        bgPress.setVisible(false);
      }
    } else {
      bg = this.add.rectangle(0, 0, tw, th, opts.green ? 0x287a45 : 0x252560);
    }
    const kids = bgPress ? [bg, bgPress, txt] : [bg, txt];
    const c = this.add.container(x, y, kids);
    c.setSize(tw, th);
    c.setInteractive({ useHandCursor: true });
    // Выбранная кнопка остаётся вжатой, пока не выберут другую
    // (перестройка сцены передаёт active заново).
    let isActive = !!opts.active;
    const showPressed = (on) => {
      if (bgPress) {
        bgPress.setVisible(on);
        if (bg) bg.setVisible(!on);
      }
    };
    if (isActive) showPressed(true);
    c.on('pointerover', () => {
      txt.setColor('#ffff55');
      txt.y = 1;
      try {
        if (this.cache.audio.exists('sfx_hover') && !this.sound.locked) {
          this.sound.play('sfx_hover', { volume: 0.18 });
        }
      } catch (e) { /* noop */ }
      showPressed(true);
    });
    c.on('pointerout', () => {
      txt.setColor(isActive ? '#ffff44' : baseColor);
      txt.y = 0;
      showPressed(isActive);
    });
    c.on('pointerdown', () => {
      showPressed(false);
      cb();
    });
    return {
      container: c,
      w: tw,
      h: th,
      setActive: (v) => {
        isActive = !!v;
        opts.active = isActive;
        txt.setColor(isActive ? '#ffff44' : baseColor);
        showPressed(isActive);
      }
    };
  }

  create(data = {}) {
    const _cx = gameW(this) / 2;
    // Режим и персонаж переживают перезагрузку: режим — localStorage
    // (как разрешение в настройках), персонаж — lastClass в сейве.
    // data.mode в приоритете (кампания и прямые переходы).
    this.mode = data.mode || getLobbyMode();
    // Контракт банды (п.14.6): идём в бой за влияние + бонус.
    this.contractId = data.contractId || this.contractId || null;
    this.selectedClass = data.selectedClass || gameState.lastClass || 'Assault';
    // Закрытый класс из старого сейва/ссылки — откат на штурмовика
    // (танк со 2, медик с 3, снайпер с 4 уровня).
    if (!isClassUnlocked(this.selectedClass, gameState.level)) this.selectedClass = 'Assault';
    syncGameState();
    const campLv = Math.max(1, Math.floor(Number(gameState && gameState.campaignLevel) || 1));
    this.levelIndex = data.levelIndex ?? Math.max(0, Math.min(campaignLevels.length - 1, campLv - 1));
    this.activeButton = null;
    this._previews = [];

    this.cameras.main.setBackgroundColor('#0a0a2a');

    this.bg = null;
    if (this.textures.exists('fon_menu')) {
      const src = this.textures.get('fon_menu').getSourceImage();
      const ratio = src.height / src.width;
      const bgW = Math.max(1280 * 1.15, gameW(this) + 64);
      const bgH = Math.round(bgW * ratio);
      this.bg = this.add.image(_cx, 720 - bgH / 2, 'fon_menu');
      this.bg.setDisplaySize(bgW, bgH);
      this.bg.setAlpha(0.3);
      this.bg.setDepth(-1);
    }

    const isCampaign = this.mode === 'CAMPAIGN';
    const cl = isCampaign ? campaignLevels[this.levelIndex] : null;

    // Ник экранируем: кавычка/тег ломали бы DOM-инпут.
    const safeNick = String(gameState.playerName || 'Игрок')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').slice(0, 16);
    this.interface = this.add.dom(_cx, 40);
    this.interface.createFromHTML(
      `<div style="color:#fff;font-family:Arial;display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">Имя:</span>
        <input id="nameInput" type="text" maxlength="16" value="${safeNick}"
          style="font-size:18px;padding:6px 10px;width:220px;">
        <button id="saveName" style="font-size:18px;padding:6px 12px;cursor:pointer;">Сохранить</button>
      </div>`
    );

    this.interface.addListener('click');
    this.interface.on('click', event => {
      if (event.target.id === 'saveName') {
        const input = this.interface.getChildByID('nameInput');
        renamePlayer(input.value);
      }
    });

    this.add.text(_cx, 90, isCampaign ? 'КАМПАНИЯ' : 'ЛОББИ', {
      fontSize: '42px',
      color: '#ffffff'
    }).setOrigin(0.5);

    if (isCampaign && cl) {
      const MODE_LABELS = { FFA: 'Каждый за себя', TDM: 'Командный бой', CTF: 'Захват флага', BOMB: 'Бомба', KOTH: 'Захват точек', CAMPAIGN: 'Сюжет' };
      const clMode = cl.mode && cl.mode !== 'CAMPAIGN' ? ` · Режим: ${MODE_LABELS[cl.mode] || cl.mode}` : '';
      const clMap = cl.mapName ? ` · Карта: ${cl.mapName}` : '';
      this.add.text(_cx, 145, `Уровень ${cl.id}: ${cl.name}`, {
        fontSize: '24px',
        color: '#ffff55'
      }).setOrigin(0.5);

      this.add.text(_cx, 185, `Цель: ${cl.objective}  |  Враги: ${cl.enemies}${clMode}${clMap}`, {
        fontSize: '16px',
        color: '#aaccff'
      }).setOrigin(0.5);
    }
    // Подпись режима убрана — активная кнопка и так подсвечена.

    const classStartY = isCampaign ? 320 : 280;

    this.levelNameText = null;

    if (!isCampaign) {
      const modeY = 190;
      const modes = [
        { id: 'FFA', label: 'Каждый за себя' },
        { id: 'TDM', label: 'Командный бой' },
        { id: 'CTF', label: 'Захват флага' },
        { id: 'BOMB', label: 'Бомба' },
        { id: 'KOTH', label: 'Захват точек' }
      ];
      // Одинаковый размер: ширина по самой длинной надписи.
      // Пять кнопок — плотнее ряд и кап ширины, иначе вылезут за экран.
      let modeW = 0;
      modes.forEach(m => {
        const probe = this.add.text(0, 0, m.label, { fontSize: '20px' });
        modeW = Math.max(modeW, probe.displayWidth);
        probe.destroy();
      });
      modeW = Math.min(modeW + 64, 220);
      modes.forEach((m, i) => {
        const isM = m.id === this.mode;
        this._mbtn(UX(this, 150 + i * 245), modeY, m.label, () => {
          saveLobbyMode(m.id);
          this.scene.restart({
            mode: m.id,
            selectedClass: this.selectedClass,
            levelIndex: this.levelIndex
          });
        }, { fontSize: 20, active: isM, fixedW: modeW });
      });
    }

    const classBtns = [];
    if (isCampaign) {
      // Кампания: классы в ряд, под каждым — его персонаж.
      // Невыбранные серые (внешность per-класс — позже).
      // Кнопки одинаковые: ширина по самой длинной надписи.
      const order = ['Assault', 'Tank', 'Medic', 'Sniper'];
      // Чуть меньше + кап: PNG соседей не налезают, зазоры ~50px.
      let clsW = 0;
      order.forEach(className => {
        const disp = this._clsLabel(className);
        const probe = this.add.text(0, 0, disp.text, { fontSize: '18px' });
        clsW = Math.max(clsW, probe.displayWidth);
        probe.destroy();
      });
      clsW = Math.min(clsW + 64, 190);
      order.forEach((className, index) => {
        const isSelected = className === this.selectedClass;
        const disp = this._clsLabel(className);
        const bx = UX(this, 280 + index * 240);
        const b = this._mbtn(bx, 295, disp.text, () => {
          if (disp.locked) return;
          this.selectedClass = className;
          gameState.lastClass = className;
          saveGameState();
          this.scene.restart({
            mode: this.mode,
            selectedClass: className,
            levelIndex: this.levelIndex
          });
        }, { fontSize: 18, active: isSelected, fixedW: clsW, color: disp.locked ? '#667788' : undefined });
        classBtns.push(b);
        this._spawnHeroPreview(bx, 435, className, isSelected);
      });
    } else {
      // Классы в ряд как в кампании, но компактно: сверху режимы с
      // описанием, снизу панель настроек — превью уменьшены.
      let clsW2 = 0;
      ['Assault', 'Tank', 'Medic', 'Sniper'].forEach(className => {
        const disp = this._clsLabel(className);
        const probe = this.add.text(0, 0, disp.text, { fontSize: '16px' });
        clsW2 = Math.max(clsW2, probe.displayWidth);
        probe.destroy();
      });
      clsW2 = Math.min(clsW2 + 56, 200);
      ['Assault', 'Tank', 'Medic', 'Sniper'].forEach((className, index) => {
        const isSelected = className === this.selectedClass;
        const disp = this._clsLabel(className);
        // Ряд сдвинут влево: справа в том же ряду живёт выбор карты.
        const bx = UX(this, 160 + index * 230);
        const b = this._mbtn(bx, 292, disp.text, () => {
          if (disp.locked) return;
          classBtns.forEach(o => o.setActive(false));
          b.setActive(true);
          this.selectedClass = className;
          gameState.lastClass = className;
          saveGameState();
          this.scene.restart({
            mode: this.mode,
            selectedClass: className,
            levelIndex: this.levelIndex
          });
        }, { fontSize: 16, active: isSelected, fixedW: clsW2, color: disp.locked ? '#667788' : undefined });
        classBtns.push(b);
        // Свободная игра: герои в полтора раза крупнее (0.85 → ~1.28).
        this._spawnHeroPreview(bx, 371, className, isSelected, 1.275);
      });
    }

    // Блок настроек свободной игры: цель, боты и сложность в одной панели
    // (режим выбирается рядом выше). В кампании — старые места.
    // Ширины кнопок — по максимуму всех вариантов подписей: при переключении
    // кнопки не прыгают в размерах. Панель — строго по контенту, без пустот.
    const probeW = (label, fs) => {
      const t = this.add.text(0, 0, label, { fontSize: fs + 'px' });
      const w = t.displayWidth;
      t.destroy();
      return w;
    };
    let diffW = 0;
    (botDifficulties || []).forEach(d => {
      diffW = Math.max(diffW, probeW(`Сложность: ${d.label} ▸`, 14));
    });
    diffW = Math.min(diffW + 40, 210);
    // Компактные плашки настроек: +40 вместо +96, шрифт 15 вместо 18/20.
    // Ширина — максимум по ВСЕМ вариантам подписей, поэтому при смене
    // режима/значения размер не прыгает (проверено для FFA/TDM/CTF/BOMB/KOTH).
    // Одна ручка состава на все режимы: столько игроков в каждой команде
    // (в FFA — столько ботов).
    const botsW = Math.min(probeW('Игроков в команде: 8 ▸', 15) + 40, 230);
    let goalW = 0;
    ['Цель: 60 фрагов ▸', 'Флаги: 10 ▸', 'Установки: 5 ▸', 'Очки: 300 ▸'].forEach(l => {
      goalW = Math.max(goalW, probeW(l, 15));
    });
    goalW = Math.min(goalW + 40, 230);
    if (!isCampaign) {
      const px0 = Math.min(UX(this, 300) - diffW / 2, _cx - botsW / 2, UX(this, 980) - goalW / 2) - 20;
      const px1 = Math.max(UX(this, 300) + diffW / 2, _cx + botsW / 2, UX(this, 980) + goalW / 2) + 20;
      const pg = this.add.graphics();
      pg.fillStyle(0x10102a, 0.9);
      pg.fillRoundedRect(px0, 488, px1 - px0, 100, 12);
      pg.lineStyle(2, 0x444488);
      pg.strokeRoundedRect(px0, 488, px1 - px0, 100, 12);
      this.add.text(_cx, 497, 'НАСТРОЙКИ ИГРЫ', {
        fontSize: '15px', color: '#8fb8ff', fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    const startY = isCampaign ? 600 : 678;
    const startLabel = isCampaign ? 'НАЧАТЬ УРОВЕНЬ' : 'НАЧАТЬ';

    this._mbtn(_cx, startY, startLabel, () => {
      this.scene.start('GameScene', {
        mode: this.mode,
        selectedClass: this.selectedClass,
        levelIndex: this.levelIndex,
        playerName: gameState.playerName,
        contractId: this.contractId || null,
        // Захват флага: игра до выбранного числа доставок.
        // Бомба: игра до выбранного числа установок.
        // Точки: игра до выбранного числа очков.
        scoreLimit: this.mode === 'CTF' ? gameState.ctfLimit
          : this.mode === 'BOMB' ? (gameState.bombLimit || 3)
          : this.mode === 'KOTH' ? (gameState.kothLimit || 200)
          : gameState.scoreLimit,
        // k300: старт CTF сразу с ОТ (золото в центре).
        suddenStart: this.mode === 'CTF' ? !!gameState.ctfSuddenStart : false
      });
    }, { fontSize: isCampaign ? 24 : 30, green: true });

    const diffKey = isCampaign ? 'campaignDifficulty' : 'freeDifficulty';
    const diffCfg = getBotDifficulty(gameState[diffKey]);

    const diffX = isCampaign ? UX(this, 250) : UX(this, 300);
    const diffY = isCampaign ? 585 : 555;

    this._mbtn(diffX, diffY, `Сложность: ${diffCfg.label} ▸`, () => {
      let next = nextBotDifficulty(gameState[diffKey]);
      // Песочница — только свободная игра: в кампании её пропускаем.
      if (isCampaign) { while (next === 'sandbox') next = nextBotDifficulty(next); }
      gameState[diffKey] = next;
      saveGameState();
      this.scene.restart({
        mode: this.mode,
        selectedClass: this.selectedClass,
        levelIndex: this.levelIndex
      });
    }, { fontSize: 14, compact: true, fixedW: diffW });

    // Приписка к сложности: где опыт есть, а где нет.
    // Ветеран +10% (код в GameScene), новичок — без опыта.
    const diffNote = diffCfg.id === 'novice' ? 'опыт не начисляется'
      : diffCfg.id === 'veteran' ? '+10% к опыту'
      : diffCfg.id === 'sandbox' ? 'боты не стреляют, наград нет' : '';
    if (diffNote) {
      this.add.text(diffX, diffY + 39, diffNote, {
        fontSize: '13px',
        color: diffCfg.id === 'novice' ? '#ff8888' : (diffCfg.id === 'sandbox' ? '#99aacc' : '#88ff88')
      }).setOrigin(0.5);
    }

    if (!isCampaign) {
      // Одна ручка на все свободные режимы: «Игроков в команде» — это
      // состав и синих, и красных (игрок входит в синих; союзники —
      // остальные слоты), в FFA — общее число ботов. Пишем значение
      // синхронно во все поля, иначе режимы начнут расходиться.
      // Диапазон — тот же, что проверяет gameState (2–8).
      const teamOpts = [2, 3, 4, 5, 6, 8];
      const _teamFix = (v) => teamOpts.includes(v) ? v : 5;
      const _curTeam = () => this.mode === 'FFA'
        ? _teamFix(gameState.botCount)
        : _teamFix(gameState.blueBots);
      const _teamRestart = () => {
        this.scene.restart({
          mode: this.mode,
          selectedClass: this.selectedClass,
          levelIndex: this.levelIndex
        });
      };
      this._mbtn(_cx, 555, `Игроков в команде: ${_curTeam()} ▸`, () => {
        const next = teamOpts[(teamOpts.indexOf(_curTeam()) + 1) % teamOpts.length];
        gameState.botCount = next;
        gameState.blueBots = next;
        gameState.redBots = next;
        // Старый флаг «без союзников» больше не кнопка: состав задаётся
        // этой ручкой, иначе выбор «8» молча давал бы 0 союзников.
        gameState.noAllies = false;
        saveGameState();
        _teamRestart();
      }, { fontSize: 15, compact: true, fixedW: botsW });
    }

    if (!isCampaign && this.mode !== 'CTF' && this.mode !== 'BOMB' && this.mode !== 'KOTH') {
      const limit = gameState.scoreLimit;
      this._mbtn(UX(this, 980), 555, `Цель: ${limit} фрагов ▸`, () => {
        const options = [15, 30, 45, 60];
        gameState.scoreLimit = options[(options.indexOf(gameState.scoreLimit) + 1) % options.length];
        saveGameState();
        this.scene.restart({
          mode: this.mode,
          selectedClass: this.selectedClass,
          levelIndex: this.levelIndex
        });
      }, { fontSize: 15, compact: true, fixedW: goalW });
    }

    if (!isCampaign && this.mode === 'CTF') {
      const opts = [1, 3, 5, 7, 10];
      if (!opts.includes(gameState.ctfLimit)) gameState.ctfLimit = 3;
      this._mbtn(UX(this, 980), 555, `Флаги: ${gameState.ctfLimit} ▸`, () => {
        gameState.ctfLimit = opts[(opts.indexOf(gameState.ctfLimit) + 1) % opts.length];
        saveGameState();
        this.scene.restart({
          mode: this.mode,
          selectedClass: this.selectedClass,
          levelIndex: this.levelIndex
        });
      }, { fontSize: 15, compact: true, fixedW: goalW });
      // k300: старт сразу с ОТ — золото в центре с первой секунды,
      // обычных флагов нет. Только свободная игра.
      const suddenLabel = gameState.ctfSuddenStart ? 'ОТ сразу: ДА ▸' : 'ОТ сразу: нет ▸';
      this._mbtn(UX(this, 980), 610, suddenLabel, () => {
        gameState.ctfSuddenStart = !gameState.ctfSuddenStart;
        saveGameState();
        this.scene.restart({
          mode: this.mode,
          selectedClass: this.selectedClass,
          levelIndex: this.levelIndex
        });
      }, { fontSize: 15, compact: true, fixedW: goalW });
    }

    if (!isCampaign && this.mode === 'BOMB') {
      const bopts = [1, 3, 5];
      if (!bopts.includes(gameState.bombLimit)) gameState.bombLimit = 3;
      this._mbtn(UX(this, 980), 555, `Установки: ${gameState.bombLimit} ▸`, () => {
        gameState.bombLimit = bopts[(bopts.indexOf(gameState.bombLimit) + 1) % bopts.length];
        saveGameState();
        this.scene.restart({
          mode: this.mode,
          selectedClass: this.selectedClass,
          levelIndex: this.levelIndex
        });
      }, { fontSize: 15, compact: true, fixedW: goalW });
    }

    if (!isCampaign && this.mode === 'KOTH') {
      const kopts = [100, 200, 300];
      if (!kopts.includes(gameState.kothLimit)) gameState.kothLimit = 200;
      this._mbtn(UX(this, 980), 555, `Очки: ${gameState.kothLimit} ▸`, () => {
        gameState.kothLimit = kopts[(kopts.indexOf(gameState.kothLimit) + 1) % kopts.length];
        saveGameState();
        this.scene.restart({
          mode: this.mode,
          selectedClass: this.selectedClass,
          levelIndex: this.levelIndex
        });
      }, { fontSize: 15, compact: true, fixedW: goalW });
    }

    // Выбор карты убран: свободная игра всегда берёт карту по режиму.
    // Старое сохранённое значение иначе оставило бы игрока на ручной карте
    // без возможности вернуться к «Авто».
    if (!isCampaign && gameState.freeMapId && gameState.freeMapId !== 'auto') {
      gameState.freeMapId = 'auto';
      saveGameState();
    }

    this._mbtn(UX(this, 110), 40, 'Назад', () => this.scene.start('MenuScene'), { fontSize: 20 });
  }

  // Подпись класса с замком: закрытые видны, но серые и не выбираются.
  // Открытие: штурмовик — 1, танк — 2, медик — 3, снайпер — 4 уровень.
  _clsLabel(className) {
    const base = (classDefinitions.find(c => c.id === className) || {}).label || className;
    if (isClassUnlocked(className, gameState.level)) return { text: base, locked: false };
    return { text: `${base} (ур. ${classOpenLevel(className)})`, locked: true };
  }

  // Живое превью класса: настоящий риг из редактора со снаряжением класса.
  // Невыбранный — серый. Пушка в руках та, что надета у класса в инвентаре;
  // у голого класса руки пустые (noDefaults — без штатных стволов и ножа),
  // чтобы было видно, у кого ничего не выбрано.
  // scale — размер (в кампании 1.45, в свободной компактно 0.85).
  _spawnHeroPreview(bx, y, className, isSelected, scale) {
    try {
      this._previews = this._previews || [];
      const Cls = PREVIEW_CLASSES[className] || Assault;
      const p = new Cls(this, bx, y, { name: className, team: 'blue', noDefaults: true });
      // Превью крупнее (×1.45): в выборе классов герой должен читаться.
      p.previewScale(scale || 1.45);
      if (p.body) {
        p.body.setAllowGravity(false);
        p.body.setImmovable(true);
      }
      p.setVelocity(0, 0);
      p._editorGrounded = true;
      p.aimAt(bx + 200, y - 10);
      p.updateBars();
      if (p.updateGun) p.updateGun();
      p.healthBar.setVisible(false);
      p.armorBar.setVisible(false);
      p.nameText.setVisible(false);
      // Безоружный класс: прячем и векторный ствол (иначе рисует силуэт).
      if (!p.weapon) {
        p._gunAllowed = false;
        p._setGunVisible(false);
      }
      if (!isSelected) this._grayPreview(p);
      this._previews.push(p);
    } catch (e) { /* превью не роняет лобби */ }
  }

  // Невыбранный персонаж — бесцветный (не плоский серый, а приглушённый:
  // светлое остаётся светлым, тёмное — тёмным, цвет уходит).
  // Только тинт (дешёвый, разовый): postFX-матрица на каждой детали давала
  // отдельный проход рендера и роняла слабые ПК до единиц FPS — запрещена.
  // Тинт цветность не убивает (только темнит), поэтому фигурам считаем
  // честный gray по яркости пикселя, картинкам — светлый мьют.
  _grayPreview(p) {
    const grayOf = (hex) => {
      try {
        const n = (Number(hex) >>> 0) || 0;
        const l = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
        return (l << 16) | (l << 8) | l;
      } catch (e) { return 0x888888; }
    };
    const mute = (o) => {
      try {
        if (!o) return;
        if (typeof o.setTint === 'function') { o.setTint(0x9a9a9a); return; }
        if (typeof o.setFillStyle === 'function' &&
            o.fillColor !== undefined && o.fillColor !== null) {
          o.setFillStyle(grayOf(o.fillColor), 1);
          return;
        }
        if ('fillColor' in o && Number.isFinite(+o.fillColor)) {
          try { o.fillColor = grayOf(o.fillColor); } catch (e) {}
        }
      } catch (e) {}
    };
    const paint = (o) => {
      if (!o || !o.active) return;
      // Шею не трогаем никогда (невидимая, alpha 0 — setFillStyle её засветит
      // серым кругом у головы). То же — любой объект с alpha 0.
      if (o === p.neck) return;
      try { if (o.alpha === 0) return; } catch (e) {}
      if (typeof o.getChildren === 'function') {
        o.getChildren().forEach(paint);
        return;
      }
      mute(o);
    };
    try {
      // Флаг держит серость: риг каждый кадр сносит тинт ногам/обуви
      // (см. tintList в rig.js) — без флага штаны не сереют.
      try { p._grayLock = true; } catch (e) {}
      // Полный список частей — через _smokeParts (тот же, что у дымового
      // госта): торс, руки, ноги, пушка — всё, а не только голова.
      const parts = (typeof p._smokeParts === 'function') ? p._smokeParts() : null;
      if (parts && parts.length) {
        parts.forEach(paint);
      } else {
        (p._allParts || []).forEach(paint);
        if (p.head) paint(p.head);
        if (p.neck) paint(p.neck);
        if (p.gunImg) paint(p.gunImg);
      }
    } catch (e) {}
  }

  update() {
    if (this.bg) {
      const p = this.input.activePointer;
      const nx = (p.x / this.cameras.main.width - 0.5) * 2;
      const ny = (p.y / this.cameras.main.height - 0.5) * 2;
      const maxX = 32;
      const maxY = 18;
      this.bg.x = gameW(this) / 2 + nx * maxX;
      this.bg.y = (720 - this.bg.displayHeight / 2) + ny * maxY;
    }
    // Живые превью классов: поза статична (задана при спавне), поэтому
    // обслуживаем их раз в 4 кадра, а не каждый — на слабых ПК это кадры.
    this._prevTick = ((this._prevTick | 0) + 1) % 4;
    if (this._prevTick !== 0) return;
    (this._previews || []).forEach(pv => {
      if (!pv || !pv.active || pv.dead) return;
      try {
        pv.updateBars();
        if (pv.updateGun) pv.updateGun();
        pv.healthBar.setVisible(false);
        pv.armorBar.setVisible(false);
        pv.nameText.setVisible(false);
      } catch (e) { /* превью не роняет лобби */ }
    });
  }
}
