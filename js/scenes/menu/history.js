import { gameState } from '../../data/gameState.js?v=171';

import { ensureClassBadgeTextures, classBadgeKey } from '../../data/weapons.js?v=170';
import { completedAchievements } from '../../data/achievements.js?v=170';
import { medalById } from '../../data/medals.js?v=176';

import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';
import { gameW } from '../../ui/layout.js?v=3';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

// Версия игры (бета, не выпущена).
export const GAME_VERSION = 'Beta v0.21';

// Баттл-пасс «Контракты» живёт в data/pass.js (40 ярусов × 2 ряда,
// сезон 30 дней, задания строго по порядку).
// Здесь — только позиция ленты (переживает переоткрытия окна).
let passScrollX = 0;

// Открытая секция центра («single» — режимы, «online» — мок онлайна).
// Модульная переменная — переживает перестройки колонки без рестарта сцены.
let openSection = 'single';

// Подписи режимов для истории боёв.
function _matchModeLabel(mode) {
  return {
    CAMPAIGN: 'Кампания', TDM: 'Командный бой', FFA: 'Каждый за себя',
    CTF: 'Захват флага', BOMB: 'Бомба', TRIAL: 'Испытание', KOTH: 'Захват точек'
  }[mode] || mode || '?';
}

// Авторские PNG-значки для кнопок (id иконки → ключ текстуры).
// Нет файла — рисуется вектор из _drawBtnIcon.
const BTN_ICON_PNG = {
  cart: 'значок магазин',
  backpack: 'значок инвентарь',
  star: 'значок дерево навыков',
  dna: 'значок геном',
  case: 'значок кейсы',
  list: 'значок выбрать матч',
  friends: 'значок друзья',
  swords: 'значок свободная игра',
  globe: 'значок онлайн',
  flag: 'значок компания',
  skull: 'значок испытание',
  medal: 'значок рейтинг',
  bolt: 'значок быстрая игра',
  single: 'значок одиночная игра'
};

export function createHistoryIcon(x, y) {
    const pngKey = 'значок история боёв';
    const g = this.add.graphics();
    let iconImg = null;
    const draw = (hover) => {
      g.clear();
      if (this.textures.exists(pngKey)) {
        if (!iconImg) {
          iconImg = this.add.image(x, y, pngKey);
        }
        try {
          const src = this.textures.get(pngKey).getSourceImage();
          if (src && src.width && src.height) {
            iconImg.setScale(Math.min(30 / src.width, 30 / src.height));
          } else {
            iconImg.setDisplaySize(30, 30);
          }
        } catch (e) {
          iconImg.setDisplaySize(30, 30);
        }
        iconImg.setTint(hover ? 0xffe066 : 0xffffff);
        return;
      }
      if (iconImg) iconImg.setVisible(false);
      g.fillStyle(0x1a1a3c, 1);
      g.fillCircle(x, y, 13);
      g.lineStyle(2, hover ? 0xffe066 : 0x8fb8ff, 1);
      g.strokeCircle(x, y, 13);
      g.lineStyle(2.5, hover ? 0xffe066 : 0x8fb8ff, 1);
      g.lineBetween(x, y, x, y - 7);
      g.lineBetween(x, y, x + 5, y + 2);
    };
    draw(false);
    const hit = this.add.rectangle(x, y, 34, 34, 0xffffff, 0.001);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this._openHistoryModal());
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
  }

  // История боёв — отдельное окно из главного меню (в инвентаре её нет).
  // Список + колесо прокрутки, кнопка СЧЁТ открывает детальный счёт матча.
export function _openHistoryModal() {
    if (this._historyModal) return;
    const cx = gameW(this) / 2, cy = 360, W = 780, H = 580;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeHistoryModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    elems.push(this.add.text(cx, cy - H / 2 + 26, 'ИСТОРИЯ БОЁВ', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));

    const listX = cx - W / 2 + 24, listW = W - 48;
    const y0 = cy - H / 2 + 62, viewH = H - 62 - 64;
    const hist = (gameState.matchHistory || [])
      .filter(m => m && m.mode !== 'CAMPAIGN')
      .slice(0, 20);
    const box = this.add.container(0, 0).setDepth(202);
    elems.push(box);
    const rowH = 38;
    if (!hist.length) {
      box.add(this.add.text(listX, y0 + 10, 'Пока пусто — сыграй бой.', {
        fontSize: '14px', color: '#556677'
      }).setOrigin(0, 0.5));
    }
    hist.forEach((m, i) => {
      const y = y0 + 10 + i * rowH;
      const band = this.add.graphics();
      band.fillStyle(i % 2 ? 0x1a1a40 : 0x12122e, 1);
      band.fillRoundedRect(listX - 6, y - 19, listW + 12, rowH, 6);
      box.add(band);
      const dt = new Date(m.t || 0);
      const date = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}, ` +
        `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      const mode = _matchModeLabel(m.mode);
      let main, resTxt = '', resColor = '#ffffff';
      if (m.mode === 'TRIAL') {
        const tr = m.trial || {};
        main = `${date} · ${mode} · Волна ${tr.wave | 0} · Фраги ${tr.kills | 0}`;
        if (tr.newBest) { resTxt = 'РЕКОРД!'; resColor = '#ffd24a'; }
      } else if (m.mode === 'FFA') {
        main = `${date} · ${mode} · место #${m.myPlace != null ? m.myPlace : '–'}`;
        resTxt = m.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
        resColor = m.won ? '#88dd88' : '#ff8888';
      } else {
        main = `${date} · ${mode} · ${m.scoreBlue | 0} : ${m.scoreRed | 0} · #${m.myPlace != null ? m.myPlace : '–'}`;
        resTxt = m.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
        resColor = m.won ? '#88dd88' : '#ff8888';
      }
      box.add(this.add.text(listX, y, main, {
        fontSize: '13px', color: '#ffffff'
      }).setOrigin(0, 0.5));
      if (resTxt) {
        const resT = this.add.text(listX + 460, y, resTxt, {
          fontSize: '13px', color: resColor, fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        box.add(resT);
        // АФК-метка сразу за исходом (только если был АФК).
        if (m.afk) {
          box.add(this.add.text(listX + 460 + resT.displayWidth + 8, y, 'АФК', {
            fontSize: '12px', color: '#ff5555', fontStyle: 'bold'
          }).setOrigin(0, 0.5));
        }
      }
      const btn = this.add.text(listX + listW - 8, y, 'СЧЁТ', {
        fontSize: '12px', color: '#ffffff', backgroundColor: '#252560', padding: 5
      }).setOrigin(1, 0.5);
      box.add(btn);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this._openMatchModal(m));
      btn.on('pointerover', () => btn.setStyle({ color: '#ffff55' }));
      btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
      // Вторая строка: монеты/опыт + значки взятых медалей (если были).
      let sub2 = `+${m.coins | 0} 💰  +${m.xp | 0}`;
      try {
        const icons = (m.medals || []).map(id => {
          const md = medalById(id);
          return md ? md.icon : '';
        }).join('');
        if (icons) sub2 += '  ' + icons;
      } catch (e) {}
      box.add(this.add.text(listX + 8, y + 15, sub2, {
        fontSize: '11px', color: '#aaccdd'
      }).setOrigin(0, 0.5));
    });
    // Прокрутка колесом (видно 12 строк, всего до 20).
    const maskG = this.add.graphics().setDepth(202);
    maskG.fillStyle(0xffffff);
    maskG.fillRect(listX - 8, y0 - 12, listW + 16, viewH + 24);
    maskG.setVisible(false);
    elems.push(maskG);
    box.setMask(maskG.createGeometryMask());
    const contentH = hist.length * rowH + 10;
    const scrollMin = Math.min(0, viewH - contentH);
    const modal = { elems, box, scrollY: 0, scrollMin, wheelHandler: null, escHandler: null };
    modal.wheelHandler = (pointer, objs, dx, dy) => {
      if (!this._historyModal) return;
      modal.scrollY = Phaser.Math.Clamp(modal.scrollY - dy * 0.5, modal.scrollMin, 0);
      modal.box.setY(modal.scrollY);
    };
    this.input.on('wheel', modal.wheelHandler);
    const closeBtn = this.add.text(cx, cy + H / 2 - 30, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(202);
    elems.push(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeHistoryModal());
    modal.escHandler = () => {
      if (this._matchModal) this._closeMatchModal();
      else this._closeHistoryModal();
    };
    this.input.keyboard.on('keydown-ESC', modal.escHandler);
    this._historyModal = modal;
  }

export function _closeHistoryModal() {
    const m = this._historyModal;
    if (!m) return;
    if (this._matchModal) this._closeMatchModal();
    if (m.wheelHandler) {
      try { this.input.off('wheel', m.wheelHandler); } catch (e) {}
    }
    if (m.escHandler) {
      try { this.input.keyboard.off('keydown-ESC', m.escHandler); } catch (e) {}
    }
    m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    if (m.box) { try { m.box.destroy(); } catch (e) {} }
    this._historyModal = null;
  }

  // Детальный счёт матча: таблицы команд (имя/фраги/смерти/урон),
  // своя строка подсвечена + место в команде.
export function _openMatchModal(m) {
    if (this._matchModal || !m) return;
    try { ensureClassBadgeTextures(this); } catch (e) {}
    const cx = gameW(this) / 2, cy = 360, W = 660, H = 560;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.55).setDepth(210);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeMatchModal());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(211)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);
    const dt = new Date(m.t || 0);
    const date = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}, ` +
      `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const title = this.add.text(cx, cy - H / 2 + 24,
      `Одиночная · ${_matchModeLabel(m.mode)} · ${date}`, {
        fontSize: '17px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(212);
    elems.push(title);
    // Испытание: без поражения — волна и рекорд вместо счёта.
    let resStr, resColor;
    if (m.mode === 'TRIAL') {
      const tr = m.trial || {};
      resStr = `Волна ${tr.wave | 0} · Фраги ${tr.kills | 0}` +
        (tr.newBest ? ' · РЕКОРД!' : '');
      resColor = tr.newBest ? '#ffd24a' : '#dddddd';
    } else {
      resStr = `${m.won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}` +
        (m.mode === 'FFA'
          ? ` · место №${m.myPlace != null ? m.myPlace : '–'}`
          : ` · ${m.scoreBlue | 0} : ${m.scoreRed | 0} · место в команде №${m.myPlace != null ? m.myPlace : '–'}`);
      resColor = m.won ? '#88dd88' : '#ff8888';
    }
    const res = this.add.text(cx, cy - H / 2 + 52, resStr, {
      fontSize: '14px', color: resColor, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(212);
    elems.push(res);

    // Награды и задачи боя под исходом (испытание — мимо, там своя строка).
    // Таблицы команд едут вниз на занятую высоту.
    let _tShift = 0;
    if (m.mode !== 'TRIAL') {
      let ey = cy - H / 2 + 76;
      const medals = m.medals || [];
      if (medals.length) {
        let names = '';
        try {
          names = medals.map(id => {
            const md = medalById(id);
            return md ? `${md.icon} ${md.name}` : '';
          }).filter(Boolean).join('   ');
        } catch (e) {}
        if (names) {
          const medT = this.add.text(cx, ey, names, {
            fontSize: '13px', color: '#ffd24a', fontStyle: 'bold', align: 'center',
            wordWrap: { width: 600 }
          }).setOrigin(0.5, 0).setDepth(212);
          elems.push(medT);
          ey += medT.displayHeight + 8;
        }
      }
      const o = m.obj || {};
      const objT = this.add.text(cx, ey,
        `Задачи — доставки:${o.deliver | 0} · воры:${o.thief | 0} · возвраты:${o.ret | 0} · дефузы:${o.defuse | 0} · точки:${o.cap | 0}`, {
        fontSize: '12px', color: '#99aacc', align: 'center'
      }).setOrigin(0.5, 0).setDepth(212);
      elems.push(objT);
      if (m.afk) {
        elems.push(this.add.text(cx + objT.displayWidth / 2 + 8, ey, '· АФК', {
          fontSize: '12px', color: '#ff5555', fontStyle: 'bold'
        }).setOrigin(0, 0).setDepth(212));
      }
      ey += 24;
      // Щит (высота 37) должен начинаться ПОД строкой задач, а не на ней:
      // центр щита = низ задач + зазор + половина щита.
      _tShift = ey + 4 + 18 - (cy - H / 2 + 88);
    }

    const drawTeam = (list, tx, teamColor, teamName, teamBadge) => {
      // Щит вместо слова «СИНИЕ/КРАСНЫЕ» (нет арта — слово как раньше).
      if (teamBadge && this.textures.exists(teamBadge)) {
        const him = this.add.image(tx, cy - H / 2 + 88 + _tShift, teamBadge)
          .setOrigin(0.5).setDepth(212);
        him.setDisplaySize(30, 37);
        elems.push(him);
      } else {
        const head = this.add.text(tx, cy - H / 2 + 88 + _tShift, teamName, {
          fontSize: '15px', color: teamColor, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(212);
        elems.push(head);
      }
      // Шапка статов — значки вместо букв (фиксированные колонки, как строки).
      // Нет арта — буквы как раньше. КПД — та же механика вклада
      // (contribScore по kills/dmg — остального история не хранит).
      const sEdges = [tx + 6, tx + 42, tx + 84, tx + 118];
      const sCols = ['Ф', 'С', 'УРОН', 'КПД'];
      const sIcons = { 'Ф': 'icon_stat_frags', 'С': 'icon_stat_deaths', 'УРОН': 'icon_stat_damage', 'КПД': 'icon_stat_kpd' };
      sCols.forEach((cn, ci) => {
        const ik = sIcons[cn];
        if (ik && this.textures.exists(ik)) {
          const im = this.add.image(sEdges[ci], cy - H / 2 + 103 + _tShift, ik)
            .setOrigin(1, 0).setDepth(212);
          im.setDisplaySize(14, 14);
          elems.push(im);
        } else {
          elems.push(this.add.text(sEdges[ci], cy - H / 2 + 110 + _tShift, cn, {
            fontSize: '10px', color: '#667788'
          }).setOrigin(1, 0.5).setDepth(212));
        }
      });
      (list || []).slice(0, 9).forEach((r, i) => {
        const y = cy - H / 2 + 134 + _tShift + i * 24;
        const badge = classBadgeKey(r.cls);
        const shift = (badge && this.textures.exists(badge)) ? 20 : 0;
        if (shift) {
          elems.push(this.add.image(tx - 128 + 8, y, badge).setDepth(212));
        }
        const nm = this.add.text(tx - 128 + shift, y, String(r.me ? '► ' : '') + String(r.name).slice(0, 14), {
          fontSize: '13px', color: r.me ? '#ffd24a' : '#ffffff', fontStyle: r.me ? 'bold' : 'normal'
        }).setOrigin(0, 0.5).setDepth(212);
        elems.push(nm);
        const sVals = [r.kills | 0, r.deaths | 0, r.dmg | 0, (r.kills | 0) * 30 + Math.floor((r.dmg | 0) / 25)];
        sVals.forEach((v, ci) => {
          elems.push(this.add.text(sEdges[ci], y, String(v), {
            fontSize: '12px', color: r.me ? '#ffd24a' : '#dddddd'
          }).setOrigin(1, 0.5).setDepth(212));
        });
      });
    };
    if (m.mode === 'TRIAL') {
      const tr = m.trial || {};
      elems.push(this.add.text(cx, cy - H / 2 + 120,
        `Время: ${tr.time || '–'}   Монеты: +${m.coins | 0}   Опыт: +${m.xp | 0}`, {
          fontSize: '14px', color: '#99aacc'
        }).setOrigin(0.5).setDepth(212));
    } else if (m.mode === 'FFA') {
      drawTeam(m.all, cx, '#dddddd', 'ВСЕ УЧАСТНИКИ');
    } else {
      drawTeam(m.blue, cx - 160, '#6db4ff', 'СИНИЕ', 'badge_blue');
      drawTeam(m.red, cx + 160, '#ff6666', 'КРАСНЫЕ', 'badge_red');
    }
    const closeBtn = this.add.text(cx, cy + H / 2 - 30, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(212);
    elems.push(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeMatchModal());
    this._matchModal = { elems };
  }

export function _closeMatchModal() {
    const m = this._matchModal;
    if (!m) return;
    m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    this._matchModal = null;
  }

  // Иконка-медаль достижений: авторский PNG, иначе вектор (кольцо + звезда).
  // Точка — только если есть незабранные награды.
export function createAchIcon(x, y) {
    let unclaimed = false;
    try {
      const claimed = gameState.achievements || [];
      unclaimed = completedAchievements().some(a => !claimed.includes(a.id));
    } catch (e) {}
    const pngKey = 'значок достижения';
    const g = this.add.graphics();
    let iconImg = null;
    // Пропорции оригинала (влезает в 30px без растягивания), подложки нет.
    const fitIcon = () => {
      if (!iconImg) {
        iconImg = this.add.image(x, y, pngKey);
      }
      try {
        const src = this.textures.get(pngKey).getSourceImage();
        if (src && src.width && src.height) {
          iconImg.setScale(Math.min(30 / src.width, 30 / src.height));
        } else {
          iconImg.setDisplaySize(30, 30);
        }
      } catch (e) {
        iconImg.setDisplaySize(30, 30);
      }
    };
    const draw = (hover) => {
      g.clear();
      if (this.textures.exists(pngKey)) {
        fitIcon();
        iconImg.setTint(hover ? 0xffe066 : 0xffffff);
      } else {
        if (iconImg) iconImg.setVisible(false);
        g.fillStyle(0x1a1a3c, 1);
        g.fillCircle(x, y, 13);
        g.lineStyle(2, hover ? 0xffe066 : 0xffd24a, 1);
        g.strokeCircle(x, y, 13);
        g.fillStyle(hover ? 0xffe066 : 0xffd24a, 1);
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + i * Math.PI / 5;
          const rad = i % 2 === 0 ? 7 : 3;
          pts.push(new Phaser.Geom.Point(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad));
        }
        g.fillPoints(pts, true);
      }
      if (unclaimed) {
        g.fillStyle(0xff3333, 1);
        g.fillCircle(x + 10, y - 10, 5);
        g.lineStyle(1, 0xffffff, 1);
        g.strokeCircle(x + 10, y - 10, 5);
      }
    };
    draw(false);
    const hit = this.add.rectangle(x, y, 34, 34, 0xffffff, 0.001);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.scene.start('AchievementsScene'));
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
  }

  // Контракты недели — кнопка по нижнему краю + отдельная панель.
  // Строка баттл-пасса в меню: счёт обычных наград + остаток сезона.
  // Кнопка подсвечивается, пока есть незабранная награда.
