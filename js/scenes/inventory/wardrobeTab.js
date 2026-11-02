import { gameW } from '../../ui/layout.js?v=3';
import { gameState, setCharacterColor, getCharacterColors, equipHead, equipShoes, equipTorso, equipPants, hasHead, hasShoes, hasTorso, hasPants, getEquippedHead, getEquippedTorso, getEquippedPants, getEquippedShoes } from '../../data/gameState.js?v=171';
import { classDefinitions, getWeaponLabel, isClassUnlocked, classOpenLevel } from '../../data/weapons.js?v=170';
import { weaponSkins } from '../../data/skins.js?v=169';

import { GEAR_SETS, gearSetProgress } from '../../data/gearSets.js?v=172';
import { GEAR_ITEMS } from '../../data/wardrobe.js?v=172';
import { classAbilities, ultUnlocked } from '../../data/abilities.js?v=169';
import { getRank } from '../../data/ranks.js?v=169';

import Assault from '../../entities/Assault.js?v=319';
import Tank from '../../entities/Tank.js?v=319';
import Medic from '../../entities/Medic.js?v=319';
import Sniper from '../../entities/Sniper.js?v=320';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

const HEAD_COLORS = [
  '#ffe0c8', '#ffc8a0', '#d49a6a', '#8b5a2b',
  '#4a2f18', '#c8e6ff', '#ffdce8', '#e8e8e8'
];

const BODY_COLORS = [
  '#44ccff', '#ff5555', '#55ff55', '#ffee55', '#ff55ff',
  '#ffaa44', '#aa44ff', '#00ccaa', '#888888', '#ffffff'
];

const EQUIP_SLOTS = [
  { x: 1030, y: 395, slot: 'primary', label: 'ОСНОВНОЕ' },
  { x: 1030, y: 463, slot: 'secondary', label: 'ВТОРОЕ' },
  { x: 1030, y: 531, slot: 'melee', label: 'БЛИЖНЕЕ' }
];

const COMPARE_SLOTS = [
  { x: 300, y: 565, slot: 0 },
  { x: 500, y: 565, slot: 1 }
];

export function drawWardrobeClassTabs(panel, parent) {
    classDefinitions.forEach((cd, i) => {
      const x = panel.x + 109 + i * 186;
      const selected = cd.id === this.selectedClass;
      const unlocked = isClassUnlocked(cd.id, gameState.level);
      const tabLabel = unlocked ? cd.label : `${cd.label} (ур. ${classOpenLevel(cd.id)})`;
      const tab = this.add.text(x, panel.y + 28, tabLabel, {
        fontSize: '15px',
        color: selected ? '#ffff55' : unlocked ? '#ffffff' : '#667788',
        backgroundColor: selected ? '#2a2a5a' : unlocked ? '#2e2e72' : '#14142c',
        padding: 7,
        fixedWidth: 174,
        align: 'center'
      }).setOrigin(0.5);
      if (parent) parent.add(tab);
      tab.setInteractive({ useHandCursor: unlocked });
      tab.on('pointerdown', () => {
        if (!isClassUnlocked(cd.id, gameState.level)) return;
        this.selectedClass = cd.id;
        this.redraw();
      });
      tab.on('pointerover', () => tab.setStyle({ color: '#ffff55' }));
      tab.on('pointerout', () => {
        tab.setStyle({ color: cd.id === this.selectedClass ? '#ffff55' : (isClassUnlocked(cd.id, gameState.level) ? '#ffffff' : '#667788') });
      });
    });
  }

export function drawProfilePanel(panel, parent) {
    const px0 = panel.x + 16;
    const pw = panel.w - 32;

    // Вкладки классов: у каждого свой наряд, переключаем тут же
    // (как во вкладке оружия). Фиксированные слоты — не налезают.
    this.drawWardrobeClassTabs(panel, parent);

    const currentColors = getCharacterColors();
    const activeHead = currentColors.head.toString(16).padStart(6, '0');
    const activeBody = currentColors.body.toString(16).padStart(6, '0');
    const headHex = `#${activeHead}`;
    const bodyHex = `#${activeBody}`;

    // Квадратики вдвое меньше (17px) и впритык к надписи.
    this.drawSwatches(panel, 'ЦВЕТ ГОЛОВЫ', HEAD_COLORS, headHex, 'head', panel.y + 78, panel.y + 96, parent, 17);

    // Гардероб: купленные уборы (кроме сетовых — они надеваются в сетах
    // ниже) и обувь — клик надевает. Ряды впритык к заголовкам.
    // Наряд — У КАЖДОГО КЛАССА СВОЙ (вкладки классов сверху): купленное общее,
    // а надето у каждого своё. Подпись ниже напоминает, кого одеваем.
    const wc = this.selectedClass;
    const wcLabel = (classDefinitions.find(c => c.id === wc) || {}).label || wc;
    // Подпись НИЖЕ ряда свотчей (те кончаются на panel.y+113): иначе текст
    // залезает под интерактивные квадратики, как было при +138.
    const wardNote = this.add.text(panel.x + 16, panel.y + 126, `Наряд класса: ${wcLabel} — у каждого класса свой`, {
      fontSize: '13px', color: '#ffdd88'
    }).setOrigin(0, 0.5);
    if (parent) parent.add(wardNote);
    // Рядов уборов/обуви больше нет: только ник, цвет головы и сеты.
    // Отдельные вещи надеваются кликом по иконкам сетов ниже.
    // Сеты одежды: имя + бонус двумя строками (в одну не влезали —
    // соседние колонки сливались), ниже — 4 предмета.
    // Найденный — в цвете, ненайденный — серый. Клик по найденному надевает.
    // Шляпы в иконках меньше (×0.75) — широкие уборы вылезали из ячеек.
    // Сетка в 3 колонки: 11 сетов = 4 ряда и всё видно без прокрутки.
    const setTop = panel.y + 148;
    const setColW = Math.max(210, Math.floor((panel.w - 32) / 3));
    const setRowH = 78;
    GEAR_SETS.forEach((s, si) => {
      const scol = si % 3, srow = Math.floor(si / 3);
      const bx = px0 + scol * setColW;
      const by = setTop + srow * setRowH;
      const pr = gearSetProgress(s.id);
      const full = pr.worn >= pr.total;
      // Цвет сетки сета — по редкости (как у скинов), полный сет остаётся зелёным.
      const rc = s.rarityColor || '#ffffff';
      const nameLine = this.add.text(bx, by, `${s.name}${full ? ' ✓' : ''}`, {
        fontSize: '13px', fontStyle: 'bold',
        color: full ? '#aaffaa' : rc
      }).setOrigin(0, 0.5);
      if (parent) parent.add(nameLine);
      const bonusLine2 = this.add.text(bx, by + 17, s.bonusText, {
        fontSize: '11px',
        color: full ? '#7ddb7d' : '#99aacc'
      }).setOrigin(0, 0.5);
      if (parent) parent.add(bonusLine2);
      // Иконки впритык к своему названию (7px до бокса, 15 до чужих):
      // иначе подпись читается как название сета сверху.
      const iconY = by + 31;
      const order = [
        { tex: s.pieces.head, slot: 'head', eq: getEquippedHead(this.selectedClass), on: (t) => equipHead(t, this.selectedClass), small: true },
        { tex: s.pieces.torso, slot: 'torso', eq: getEquippedTorso(this.selectedClass), on: (t) => equipTorso(t, this.selectedClass) },
        { tex: s.pieces.pants, slot: 'pants', eq: getEquippedPants(this.selectedClass), on: (t) => equipPants(t, this.selectedClass) },
        { tex: s.pieces.shoes, slot: 'shoes', eq: getEquippedShoes(this.selectedClass), on: (t) => equipShoes(t, this.selectedClass) }
      ];
      order.forEach((p, i) => {
        const meta = GEAR_ITEMS.find(g => g.tex === p.tex);
        const owned = meta ? this._gearOwnedMeta(meta) : false;
        // Зелёным — только купленное И надетое (иначе наследие сейва
        // светило «?» как надетое).
        const isEq = !!owned && p.eq === p.tex;
        const ix = bx + i * 42;
        // Рамка по редкости вещи — независимо от владения; надетое — зелёное.
        const rarHex = meta ? parseInt(String(meta.rarityColor || '').replace('#', ''), 16) || 0x4466aa : 0x4466aa;
        const bg = this.add.rectangle(ix + 17, iconY + 17, 34, 34, isEq ? 0x224422 : 0x1a1a4a, 1);
        bg.setStrokeStyle(isEq ? 2 : 1, isEq ? 0x44cc44 : rarHex);
        if (parent) parent.add(bg);
        const pv = p.slot === 'pants' ? p.tex + '_icon' : p.tex;
        if (owned && this.textures.exists(pv)) {
          const im = this.add.image(ix + 17, iconY + 17, pv);
          try {
            const src = this.textures.get(pv).getSourceImage();
            if (src && src.width && src.height) {
              im.setScale(Math.min(26 / src.width, 26 / src.height) * (p.small ? 0.75 : 1));
            }
          } catch (e) {}
          if (parent) parent.add(im);
        } else {
          const tx = this.add.text(ix + 17, iconY + 17, '?', {
            fontSize: '16px', color: '#555566'
          }).setOrigin(0.5);
          if (parent) parent.add(tx);
        }
        if (owned) {
          bg.setInteractive({ useHandCursor: true });
          // Повторный клик по надетому — снять (в слот null).
          bg.on('pointerdown', () => {
            if (p.eq === p.tex) p.on(null);
            else p.on(p.tex);
            this.redraw();
          });
        }
      });
    });
    // Умения классов живут в отдельном окне (кнопка УМЕНИЯ) — из вкладки убраны.
  }

  // Есть ли вещь в гардеробе (по слоту) — для серых/цветных иконок сетов.
export function _gearOwnedMeta(meta) {
    try {
      if (!meta) return false;
      if (meta.slot === 'shoes') return hasShoes(meta.tex);
      if (meta.slot === 'torso') return hasTorso(meta.tex);
      if (meta.slot === 'pants') return hasPants(meta.tex);
      return hasHead(meta.tex);
    } catch (e) { return false; }
  }

  // Строка частей сета: что надето (✓), чего не хватает.
export function _setPartsLine(s) {
    try {
      const eq = { head: getEquippedHead(this.selectedClass), torso: getEquippedTorso(this.selectedClass), pants: getEquippedPants(this.selectedClass) };
      const lbl = (tex) => {
        const g = GEAR_ITEMS.find(x => x.tex === tex);
        return g ? g.label : tex;
      };
      return ['head', 'torso', 'pants']
        .map(k => `${lbl(s.pieces[k])} ${eq[k] === s.pieces[k] ? '✓' : '—'}`)
        .join('   ');
    } catch (e) { return ''; }
  }

  // Ряд гардероба: иконки купленных вещей + «снять». Клик — надеть.
  // Перенос по ширине панели: длинный ряд загибается вниз и возвращает
  // свой низ — иначе 15+ уборов уезжают за экран. Возвращает низ ряда.
export function drawGearRow(panel, parent, title, items, equippedTex, titleY, rowY, onPick, perRow) {
    const px0 = panel.x + 16;
    const t = this.add.text(px0, titleY, title, {
      fontSize: '14px',
      color: '#99aacc'
    }).setOrigin(0, 0.5);
    if (parent) parent.add(t);
    const size = 34;
    const gap = 8;
    const stride = size + gap;
    const maxW = (panel.x + panel.w - 16) - px0;
    const cols = Math.max(1, perRow || Math.floor((maxW + gap) / stride));
    items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = px0 + col * stride;
      const y = rowY + row * stride;
      const isEq = (equippedTex || null) === (it.tex || null);
      // Рамка по редкости вещи; если вещи нет в каталоге — обычный синий.
      const meta = GEAR_ITEMS.find(g => g.tex === it.tex);
      const rarHex = meta && meta.rarityColor ? parseInt(String(meta.rarityColor).replace('#', ''), 16) || 0x4466aa : 0x4466aa;
      const bg = this.add.rectangle(x + size / 2, y + size / 2, size, size, isEq ? 0x224422 : 0x1a1a4a, 1);
      bg.setStrokeStyle(isEq ? 3 : 1, isEq ? 0x44cc44 : rarHex);
      if (parent) parent.add(bg);
      // Превью: it.pv (стоковые кеды) или сама вещь; иначе прочерк.
      const pvKey = it.pv || it.tex;
      if (pvKey && this.textures.exists(pvKey)) {
        const im = this.add.image(x + size / 2, y + size / 2, pvKey);
        try {
          const src = this.textures.get(pvKey).getSourceImage();
          if (src && src.width && src.height) {
            im.setScale(Math.min((size - 8) / src.width, (size - 8) / src.height));
          }
        } catch (e) {}
        if (parent) parent.add(im);
      } else {
        const tx = this.add.text(x + size / 2, y + size / 2, '—', {
          fontSize: '18px', color: '#8899aa'
        }).setOrigin(0.5);
        if (parent) parent.add(tx);
      }
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        if (typeof onPick === 'function') onPick(it.tex);
        this.redraw();
      });
    });
    const rows = Math.max(1, Math.ceil(Math.max(1, items.length) / cols));
    return rowY + rows * stride;
  }

export function drawSwatches(panel, title, colors, activeHex, part, titleY, rowY, parent, size) {
    const px0 = panel.x + 16;
    const sz = size || 34;
    const gap = 8;

    const swatchTitle = this.add.text(px0, titleY, title, {
      fontSize: '14px',
      color: '#99aacc'
    }).setOrigin(0, 0.5);
    if (parent) parent.add(swatchTitle);

    colors.forEach((hex, i) => {
      const x = px0 + i * (sz + gap);
      const swatch = this.add.rectangle(
        x + sz / 2, rowY + sz / 2,
        sz, sz,
        parseInt(hex.slice(1), 16), 1
      );
      swatch.setStrokeStyle(hex === activeHex ? 3 : 1, hex === activeHex ? 0xffffff : 0x555577);
      swatch.setDepth(6);
      if (parent) parent.add(swatch);

      swatch.setInteractive({ useHandCursor: true });
      swatch.on('pointerdown', () => {
        setCharacterColor(part, hex);
        this.redraw();
      });
      swatch.on('pointerover', () => swatch.setStrokeStyle(2, 0xffffff));
      swatch.on('pointerout', () =>
        swatch.setStrokeStyle(hex === activeHex ? 3 : 1, hex === activeHex ? 0xffffff : 0x555577)
      );
    });
  }

export function _spawnPreview(classId, x, y, aimLeft, scale) {
    try {
      if (this._preview) {
        try { this._preview.destroy(); } catch (e) {}
        this._preview = null;
      }
      const Cls = PREVIEW_CLASSES[classId] || Assault;
      const p = new Cls(this, x, y, { name: 'preview', team: 'blue', noDefaults: true });
      if (scale && scale !== 1) p.previewScale(scale);
      if (p.body) {
        p.body.setAllowGravity(false);
        p.body.setImmovable(true);
      }
      p.setVelocity(0, 0);
      p._editorGrounded = true;
      p.aimAt(x + (aimLeft ? -200 : 200), y - 10);
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
      this._preview = p;
      return p;
    } catch (e) {
      return null;
    }
  }

export function drawMiscPanel(panel, parent) {
    const px0 = panel.x + 16;
    const pw = panel.w - 32;
    const add = (o) => { if (parent) parent.add(o); return o; };

    add(this.add.text(px0, panel.y + 50, 'ДРУГОЕ', {
      fontSize: '16px',
      color: '#dddddd'
    }).setOrigin(0, 0.5));

    const frags = gameState.dailyFrags | 0;
    add(this.add.text(px0, panel.y + 78, 'Фрагменты главной награды — нажми, чтобы обменять', {
      fontSize: '14px', color: '#ffdd88'
    }).setOrigin(0, 0.5));

    // Артефакты по нарастающей таинственности: осколок → руна → око → звезда.
    // Закрытые ячейки одинаковые (печать с «?») — что внутри, секрет
    // до получения. Раньше были 4 разные фигуры — казалось, что нужны
    // разные типы, хотя счётчик общий.
    const shapes = [
      { color: 0xb44dff, kind: 'shard' },
      { color: 0x33ddff, kind: 'rune' },
      { color: 0xff55aa, kind: 'eye' },
      { color: 0xffd24a, kind: 'star' }
    ];
    const cellS = 104, cellGap = 16;
    shapes.forEach((sh, i) => {
      const bx = px0 + i * (cellS + cellGap), by = panel.y + 96;
      const on = i < frags;
      const bgc = this.add.graphics();
      bgc.fillStyle(on ? 0x1a1a3a : 0x0d0d22, 1);
      bgc.fillRoundedRect(bx, by, cellS, cellS, 8);
      bgc.lineStyle(2, on ? sh.color : 0x333355);
      bgc.strokeRoundedRect(bx, by, cellS, cellS, 8);
      add(bgc);
      const fg = this.add.graphics();
      const fcx = bx + cellS / 2, fcy = by + cellS / 2, R = 26;
      const P = (dx, dy) => new Phaser.Geom.Point(fcx + dx, fcy + dy);
      if (!on) {
        // Печать: содержимое ячейки — секрет до получения фрагмента.
        fg.fillStyle(0x0d0d22, 1);
        fg.fillCircle(fcx, fcy, R);
        fg.lineStyle(2, 0x3a3a5a, 1);
        fg.strokeCircle(fcx, fcy, R);
        fg.lineStyle(1.5, 0x3a3a5a, 0.8);
        fg.strokeCircle(fcx, fcy, R * 0.62);
        add(fg);
        add(this.add.text(fcx, fcy - 1, '?', {
          fontSize: '30px', color: '#4a4a6a', fontStyle: 'bold'
        }).setOrigin(0.5));
      } else {
        // Свечение-подложка под артефакт.
        fg.fillStyle(sh.color, 0.16);
        fg.fillCircle(fcx, fcy, R + 12);
        if (sh.kind === 'shard') {
          // Осколок: рваный кристалл + трещина.
          fg.fillStyle(sh.color, 1);
          fg.fillPoints([P(0, -R), P(0.62 * R, -0.35 * R), P(0.4 * R, 0.72 * R),
            P(-0.18 * R, R), P(-0.7 * R, 0.18 * R), P(-0.5 * R, -0.62 * R)], true);
          fg.lineStyle(2, 0x0d0d22, 0.9);
          fg.lineBetween(fcx, fcy - R * 0.7, fcx + R * 0.1, fcy + R * 0.5);
        } else if (sh.kind === 'rune') {
          // Руна: кольцо + мачта с ветвями.
          fg.lineStyle(4, sh.color, 1);
          fg.strokeCircle(fcx, fcy, R * 0.92);
          fg.lineStyle(3.5, sh.color, 1);
          fg.lineBetween(fcx - R * 0.15, fcy - R * 0.6, fcx - R * 0.15, fcy + R * 0.6);
          fg.lineBetween(fcx - R * 0.15, fcy - R * 0.35, fcx + R * 0.4, fcy - R * 0.05);
          fg.lineBetween(fcx - R * 0.15, fcy + R * 0.05, fcx + R * 0.4, fcy + R * 0.35);
          fg.fillStyle(0xffffff, 0.85);
          fg.fillCircle(fcx - R * 0.15, fcy - R * 0.6, 2.5);
        } else if (sh.kind === 'eye') {
          // Око: миндалина + зрачок + блик.
          fg.lineStyle(3.5, sh.color, 1);
          fg.strokeEllipse(fcx, fcy, R * 2, R * 1.15);
          fg.fillStyle(sh.color, 1);
          fg.fillCircle(fcx, fcy, R * 0.34);
          fg.fillStyle(0x0d0d22, 1);
          fg.fillCircle(fcx, fcy, R * 0.15);
          fg.fillStyle(0xffffff, 0.9);
          fg.fillCircle(fcx - R * 0.1, fcy - R * 0.12, 2.5);
        } else {
          // Звезда: четырёхлучевая + внешнее кольцо + сердцевина.
          fg.lineStyle(1.5, sh.color, 0.7);
          fg.strokeCircle(fcx, fcy, R + 5);
          fg.fillStyle(sh.color, 1);
          const k = 0.2 * R;
          fg.fillPoints([P(0, -R), P(k, -k), P(R, 0), P(k, k),
            P(0, R), P(-k, k), P(-R, 0), P(-k, -k)], true);
          fg.fillStyle(0xffffff, 0.9);
          fg.fillCircle(fcx, fcy, 3);
        }
        add(fg);
      }
      const hit = this.add.rectangle(bx + cellS / 2, by + cellS / 2, cellS, cellS, 0xffffff, 0);
      add(hit);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this._openFragModal());
      hit.on('pointerover', () => {
        bgc.clear();
        bgc.fillStyle(0x1a1a3a, 1);
        bgc.fillRoundedRect(bx, by, cellS, cellS, 8);
        bgc.lineStyle(3, 0xffee55);
        bgc.strokeRoundedRect(bx, by, cellS, cellS, 8);
      });
      hit.on('pointerout', () => {
        bgc.clear();
        bgc.fillStyle(on ? 0x1a1a3a : 0x0d0d22, 1);
        bgc.fillRoundedRect(bx, by, cellS, cellS, 8);
        bgc.lineStyle(2, on ? sh.color : 0x333355);
        bgc.strokeRoundedRect(bx, by, cellS, cellS, 8);
      });
    });
    add(this.add.text(px0, panel.y + 216,
      'Даются по воскресеньям стрика ежедневки (дни 7, 14, 21 и 28). Собери 3 — обмен на награду или финал на 30-й день в окне подарка.', {
        fontSize: '13px', color: '#99aacc', wordWrap: { width: pw - 8 }
      }).setOrigin(0, 0));

    if (!frags) {
      add(this.add.text(px0, panel.y + 272, 'Пока пусто — забирай ежедневку в меню (подарок слева).', {
        fontSize: '14px', color: '#556677'
      }).setOrigin(0, 0.5));
    }
    // Истории боёв здесь нет — она отдельным окном из главного меню
    // (иконка-часы наверху).
  }

export function drawPlayerPanel() {
    const panel = { x: 795, y: 105, w: 475, h: 570 };
    const c = this.add.container(0, 0);
    this._dynamicContainers.push(c);

    if (this.view === 'skins') {
      this.playerPanelGfx = this.add.graphics();
      this.playerPanelGfx.fillStyle(0x1a1a3a, 1);
      this.playerPanelGfx.fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
      this.playerPanelGfx.lineStyle(2, 0x444488);
      this.playerPanelGfx.strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
      c.add(this.playerPanelGfx);

      const skinsTitle = this.add.text(panel.x + panel.w / 2, panel.y + 22, 'КОЛЛЕКЦИЯ СКИНОВ', {
        fontSize: '18px', color: '#dddddd'
      }).setOrigin(0.5);
      c.add(skinsTitle);

      // Манекен из старых PNG-частей убран: в игре давно GEO-риг,
      // а этот кусок торса с руками висел артефактом.
      const ownedIds = new Set(gameState.weaponSkins || []);
      const owned = weaponSkins.filter(s => ownedIds.has(s.id));

      const counts = new Map();
      owned.forEach(s => {
        counts.set(s.weapon, (counts.get(s.weapon) || 0) + 1);
      });

      const countEntries = [...counts.entries()];
      const listH = countEntries.length * 22 + 10;

      const statBg = this.add.graphics();
      statBg.fillStyle(0x0d0d2a, 1);
      statBg.fillRoundedRect(panel.x + 30, panel.y + 60, panel.w - 60, Math.min(listH + 50, panel.h - 80), 8);
      c.add(statBg);

      const skinsCount = this.add.text(panel.x + 50, panel.y + 80,
        `Скинов собрано: ${owned.length} из ${weaponSkins.length}`, {
          fontSize: '16px', color: '#ffee88'
        }).setOrigin(0, 0);
      c.add(skinsCount);

      // Строки в маске со скроллом колесом: иначе длинные коллекции
      // вылезают за блок (см. _skinCountWheel в create).
      const listTop = panel.y + 110, listHh = panel.h - 150;
      const maskG = this.add.graphics();
      maskG.fillStyle(0xffffff);
      maskG.fillRect(panel.x + 30, listTop, panel.w - 60, listHh);
      maskG.setVisible(false);
      c.add(maskG);
      const listC = this.add.container(0, 0);
      listC.setMask(maskG.createGeometryMask());
      c.add(listC);
      let ly = panel.y + 115;
      countEntries.forEach(([name, n]) => {
        const entry = this.add.text(panel.x + 50, ly, `${getWeaponLabel(name)} — ${n}`, {
          fontSize: '13px', color: '#99aacc'
        }).setOrigin(0, 0);
        listC.add(entry);
        ly += 22;
      });
      this._skinCount = {
        c: listC,
        x: panel.x + 30, ry: listTop, w: panel.w - 60, h: listHh,
        y: 0,
        max: Math.min(0, listHh - (ly - (panel.y + 115)) - 8)
      };

      return;
    }

    this.playerPanelGfx = this.add.graphics();
    this.playerPanelGfx.fillStyle(0x1a1a3a, 1);
    this.playerPanelGfx.fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
    this.playerPanelGfx.lineStyle(2, 0x444488);
    this.playerPanelGfx.strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 10);
    c.add(this.playerPanelGfx);

    const cd = classDefinitions.find(cl => cl.id === this.selectedClass);

    const classLabel = this.add.text(panel.x + panel.w / 2, panel.y + 13, cd.label, {
      fontSize: '18px', color: '#dddddd'
    }).setOrigin(0.5);
    c.add(classLabel);

    const colors = getCharacterColors();
    const cx = panel.x + panel.w / 2;

    const rankText = this.add.text(panel.x + 30, panel.y + 35,
      `${getRank(gameState.level)}  ·  ур. ${gameState.level} (${gameState.experience} оп.)`, {
        fontSize: '13px', color: '#ffddaa'
      }).setOrigin(0, 0.5);
    c.add(rankText);

    // Кнопка умений справа наверху от персонажа (отдельное окно —
    // задел под новые умения, список в профиле остаётся).
    const abilBtn = this.add.text(panel.x + panel.w - 16, panel.y + 40, 'УМЕНИЯ', {
      fontSize: '14px', color: '#ffffff', backgroundColor: '#334466', padding: 8
    }).setOrigin(1, 0.5);
    c.add(abilBtn);
    abilBtn.setInteractive({ useHandCursor: true });
    abilBtn.on('pointerdown', () => this._openAbilitiesModal());
    abilBtn.on('pointerover', () => abilBtn.setStyle({ color: '#ffff55' }));
    abilBtn.on('pointerout', () => abilBtn.setStyle({ color: '#ffffff' }));

    // Живое превью из редактора персонажа: настоящий риг выбранного класса
    // с его снаряжением из инвентаря. Приподнято выше к центру свободной полки,
    // чтобы ноги и оружие не залезали на заголовок «СНАРЯЖЕНИЕ» и слоты экипировки.
    this._preview = this._spawnPreview(this.selectedClass, panel.x + panel.w / 2, panel.y + 128, true, 1.5);

    this.drawEquipSlots(panel, c);

    // Блок навыков из правой панели убран (дерево качается из главного
    // меню, умения классов — по кнопке УМЕНИЯ). Ниже слотов — воздух.
  }

  // Отдельное окно умений (кнопка УМЕНИЯ): сейчас — умения классов,
  // дальше сюда же лягут новые умения. Закрывается крестиком,
  // умирает вместе с перерисовкой.
export function _openAbilitiesModal() {
    try { if (this._abilitiesModal) { try { this._abilitiesModal.destroy(); } catch (e) {} } } catch (e) {}
    this._abilitiesModal = null;
    const c = this.add.container(0, 0).setDepth(200);
    this._dynamicContainers.push(c);
    this._abilitiesModal = c;
    const PW = 720, PH = 480, PX = gameW(this) / 2, PY = 360;
    c.add(this.add.rectangle(PX, PY, gameW(this), 720, 0x000000, 0.6));
    const bg = this.add.graphics();
    bg.fillStyle(0x12122e, 0.98);
    bg.fillRoundedRect(PX - PW / 2, PY - PH / 2, PW, PH, 14);
    bg.lineStyle(2, 0x4466aa, 1);
    bg.strokeRoundedRect(PX - PW / 2, PY - PH / 2, PW, PH, 14);
    c.add(bg);
    c.add(this.add.text(PX, PY - PH / 2 + 32, 'УМЕНИЯ КЛАССОВ', {
      fontSize: '20px', color: '#9aacdd', fontStyle: 'bold'
    }).setOrigin(0.5));
    c.add(this.add.text(PX, PY - PH / 2 + 56, 'новые умения появятся здесь', {
      fontSize: '12px', color: '#667788'
    }).setOrigin(0.5));
    let ay = PY - PH / 2 + 96;
    classDefinitions.forEach(cd => {
      const ab = classAbilities[cd.id];
      if (!ab) return;
      const unlocked = ultUnlocked(cd.id);
      c.add(this.add.text(PX - PW / 2 + 40, ay, `${cd.label}: ${ab.name}`, {
        fontSize: '15px', color: unlocked ? '#ccffcc' : '#8899aa'
      }).setOrigin(0, 0.5));
      c.add(this.add.text(PX + PW / 2 - 40, ay, unlocked ? 'доступно' : `ур. ${ab.unlockLevel}`, {
        fontSize: '13px', color: unlocked ? '#aaffaa' : '#777788'
      }).setOrigin(1, 0.5));
      const d = this.add.text(PX - PW / 2 + 40, ay + 19, ab.desc, {
        fontSize: '12px', color: '#7788aa', wordWrap: { width: PW - 80 }
      }).setOrigin(0, 0.5);
      c.add(d);
      ay += 44 + d.displayHeight;
    });
    const closeBtn = this.add.text(PX, PY + PH / 2 - 32, 'Закрыть', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#553333', padding: 10
    }).setOrigin(0.5);
    c.add(closeBtn);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      try { c.destroy(); } catch (e) {}
      if (this._abilitiesModal === c) this._abilitiesModal = null;
    });
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ffff55' }));
    closeBtn.on('pointerout', () => closeBtn.setStyle({ color: '#ffffff' }));
  }
