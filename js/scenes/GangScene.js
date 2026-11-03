// GangScene — окно «Банда» (ТЗ п.14.6): ростер, карта Новиграда, контракты, казна.
// Ростер слева, карта в центре (органические цветные районы по держателю),
// контракты справа. Всё подписано: сверху — как играть одной строкой.
import { gameW, UX } from '../ui/layout.js?v=3';
import { classOfWeapon, weaponsList, getWeaponLabel } from '../data/weapons.js?v=170';
import { gameState } from '../data/gameState.js?v=175';
import {
  ensureGang, ensureTurf, turfTick, ENEMY_GANGS, GANG_COSTS, GANG_RULES,
  hireMember, buySlot, healAll, claimIncome, assignGun, toggleBattle,
  setLieutenant, dismissMember, acceptRecruit, declineRecruit, contractReward,
  gangBadgeKey
} from '../data/gang.js?v=7';

const CLASS_LABEL = { Assault: 'Штурмовик', Tank: 'Танк', Medic: 'Медик', Sniper: 'Снайпер' };
const HOLDER_CSS = { player: '#35d07f', syndicate: '#ff6666', swarm: '#c07bff', chimera: '#7db8ff' };
const HOLDER_FILL = { player: 0x27ae60, syndicate: 0xd3544c, swarm: 0x8e44ad, chimera: 0x2980c9 };
function holderName(h) {
  if (h === 'player') return 'Наш';
  const g = ENEMY_GANGS.find(x => x.id === h);
  return g ? g.name : h;
}
// Детерминированный рандом (карта стабильна между перерисовками).
function _rand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export default class GangScene extends Phaser.Scene {
  constructor() { super('GangScene'); }

  create() {
    try { turfTick(); } catch (e) {}
    const g = ensureGang();
    const t = ensureTurf();
    this.cameras.main.setBackgroundColor('#0a0a20');
    const _cx = gameW(this) / 2;
    // Глубина фона: три горизонтальные полосы (сверху светлее) + тонкие
    // золотые линейки сверху/снизу — вместо плоской синевы.
    try {
      const bgb = this.add.graphics();
      bgb.fillStyle(0x0d0d28, 1);
      bgb.fillRect(0, 0, gameW(this), 240);
      bgb.fillStyle(0x0a0a20, 1);
      bgb.fillRect(0, 240, gameW(this), 240);
      bgb.fillStyle(0x070718, 1);
      bgb.fillRect(0, 480, gameW(this), 240);
      bgb.lineStyle(1, 0xffd24a, 0.25);
      bgb.lineBetween(0, 60, gameW(this), 60);
      bgb.lineBetween(0, 690, gameW(this), 690);
    } catch (e) {}
    this.add.text(_cx, 26, 'НОВИГРАД — ВОЙНА БАНД', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    // Золотая черта с ромбом под заголовком.
    try {
      const fl = this.add.graphics();
      fl.lineStyle(2, 0xffd24a, 0.8);
      fl.lineBetween(_cx - 140, 46, _cx + 140, 46);
      fl.fillStyle(0xffd24a, 0.9);
      const dd = 6;
      fl.fillPoints([
        new Phaser.Geom.Point(_cx, 46 - dd), new Phaser.Geom.Point(_cx + dd, 46),
        new Phaser.Geom.Point(_cx, 46 + dd), new Phaser.Geom.Point(_cx - dd, 46)
      ], true);
    } catch (e) {}
    // Рамка ПЕРЕД текстом (иначе закроет его).
    try {
      const bf = this.add.graphics();
      bf.fillStyle(0x3a2430, 1);
      bf.fillRoundedRect(70 - 52, 28 - 17, 104, 34, 8);
      bf.lineStyle(2, 0xa06a7a, 1);
      bf.strokeRoundedRect(70 - 52, 28 - 17, 104, 34, 8);
      bf.lineStyle(1, 0xffffff, 0.15);
      bf.lineBetween(70 - 44, 28 - 13, 70 + 44, 28 - 13);
    } catch (e) {}
    const back = this.add.text(UX(this, 70), 28, '← Назад', { fontSize: '18px', color: '#ffffff', padding: 8 }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setStyle({ color: '#ffff55' }));
    back.on('pointerout', () => back.setStyle({ color: '#ffffff' }));
    back.on('pointerdown', () => this.scene.start('MenuScene'));

    this._panel(208, 86, 384, 578, 'Моя банда', 0x1f6a3d);
    this._panel(_cx, 86, 464, 578, 'КАРТА ГОРОДА', 0x2a5aaa);
    this._panel(1072, 86, 384, 578, 'КОНТРАКТЫ', 0xa07a1a);
    this._roster(g, t);
    this._map(t);
    this._contracts(t);
    try {
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
    } catch (e) {}
  }

  // Панель: градиентное тело, акцентная шапка, двойная рамка, заклёпки.
  // Без смены координат и размеров — только красота.
  _panel(cx, top, w, h, title, accent) {
    const g = this.add.graphics();
    const ac = accent != null ? accent : 0x3a3a6a;
    try {
      g.fillGradientStyle(0x1a1a36, 0x1a1a36, 0x0e0e24, 0x0e0e24, 1);
      g.fillRoundedRect(cx - w / 2, top, w, h, 12);
    } catch (e) {
      g.fillStyle(0x12122a, 0.95);
      g.fillRoundedRect(cx - w / 2, top, w, h, 12);
    }
    // шапка: акцентная полоса сверху
    try {
      g.fillStyle(ac, 0.85);
      g.fillRoundedRect(cx - w / 2 + 3, top + 3, w - 6, 30, { tl: 9, tr: 9, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.1);
      g.fillRoundedRect(cx - w / 2 + 3, top + 3, w - 6, 4, { tl: 9, tr: 9, bl: 0, br: 0 });
    } catch (e) {}
    g.lineStyle(2, 0x0a0a1a, 1);
    g.strokeRoundedRect(cx - w / 2, top, w, h, 12);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(cx - w / 2 + 3, top + 3, w - 6, h - 6, 9);
    // Верхний хайлайт — глубина панели.
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(cx - w / 2 + 14, top + 3, cx + w / 2 - 14, top + 3);
    // заклёпки по углам
    try {
      g.fillStyle(0x8a8aa8, 1);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        g.fillCircle(cx + sx * (w / 2 - 10), top + (sy < 0 ? 10 : h - 10), 2.5);
      });
    } catch (e) {}
    this.add.text(cx, top + 17, title, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
  }

  // Кнопка в рамке: фон + бордюр по виду, ховер подсвечивает рамку.
  _btn(x, y, label, cb, opts = {}) {
    const fs = (opts.fs || 13) + 'px';
    const col = opts.disabled ? '#667788' : '#ffffff';
    const bgc = opts.disabled ? 0x1c1c30 : (opts.green ? 0x1e4a24 : (opts.gold ? 0x4a3a10 : 0x23234e));
    const brc = opts.disabled ? 0x3a3a55 : (opts.green ? 0x35d07f : (opts.gold ? 0xffd24a : 0x5a5ab8));
    const probe = this.add.text(0, 0, label, { fontSize: fs });
    const bw = probe.displayWidth + 20, bh = probe.displayHeight + 12;
    probe.destroy();
    const fr = this.add.graphics();
    const paint = (hot) => {
      try {
        fr.clear();
        fr.fillStyle(bgc, 1);
        fr.fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 7);
        fr.fillStyle(0xffffff, hot ? 0.12 : 0.06);
        fr.fillRoundedRect(x - bw / 2, y - bh / 2, bw, 5, { tl: 7, tr: 7, bl: 0, br: 0 });
        fr.lineStyle(hot ? 2.5 : 1.5, hot ? 0xffff88 : brc, 1);
        fr.strokeRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 7);
      } catch (e) {}
    };
    paint(false);
    const b = this.add.text(x, y, label, { fontSize: fs, color: col }).setOrigin(0.5);
    if (!opts.disabled) {
      b.setInteractive({ useHandCursor: true });
      b.on('pointerover', () => { b.setStyle({ color: '#ffff55' }); paint(true); });
      b.on('pointerout', () => { b.setStyle({ color: '#ffffff' }); paint(false); });
      b.on('pointerdown', cb);
    }
    return b;
  }

  _roster(g, t) {
    const x0 = UX(this, 208);
    // Строка «Бойцов N/M» убрана (решение владельца) — сразу слоты.
    // Слот фиксированный 68px и у бойца, и у пустышки: найм не дёргает вёрстку.
    const SLOT_H = 68;
    let y = 130;
    // Вербовка: лучший синий бот прошлого победного боя просится в банду.
    if (g.pendingRecruit) {
      const r = g.pendingRecruit;
      const card = this.add.graphics();
      card.fillStyle(0x4a3a12, 1);
      card.fillRoundedRect(x0 - 175, y, 350, 64, 8);
      card.lineStyle(2, 0xffd24a, 1);
      card.strokeRoundedRect(x0 - 175, y, 350, 64, 8);
      this.add.text(x0, y + 12, `Просится в банду: ${r.name}`, { fontSize: '13px', color: '#ffd24a', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(x0, y + 30, `${CLASS_LABEL[r.class] || r.class} — отличился в прошлом победном бою`, { fontSize: '11px', color: '#c0b080' }).setOrigin(0.5);
      this._btn(x0 - 80, y + 50, 'ВЗЯТЬ', () => { acceptRecruit(); this.scene.restart(); }, { green: true, fs: 12 });
      this._btn(x0 + 80, y + 50, 'ОТКАЗ', () => { declineRecruit(); this.scene.restart(); }, { fs: 12 });
      y += 76;
    }
    (g.members || []).forEach((m, mi) => {
      const st = m.lieutenant != null ? '★ смотрящий' : (m.wounded ? '✚ ранен' : (m.inBattle ? 'в бой' : 'в запасе'));
      const col = m.wounded ? '#ff8888' : m.lieutenant != null ? '#ffd24a' : (m.inBattle ? '#c0ffd0' : '#99aacc');
      const chipBg = m.wounded ? 0x4a1a1a : m.lieutenant != null ? 0x4a3a12 : (m.inBattle ? 0x1a4a2a : 0x1a1a38);
      // Карточка бойца: зебра-подложка + цветной корешок статуса.
      // Высота равна SLOT_H — как у пустого слота.
      try {
        const cg = this.add.graphics();
        if (mi % 2) {
          cg.fillStyle(0xffffff, 0.03);
          cg.fillRoundedRect(x0 - 175, y - 14, 350, SLOT_H, 6);
        }
        cg.fillStyle(chipBg, 0.9);
        cg.fillRoundedRect(x0 - 175, y - 14, 4, SLOT_H, { tl: 4, bl: 4, tr: 0, br: 0 });
      } catch (e) {}
      this.add.text(x0 - 165, y, `${m.wounded ? '✚ ' : ''}${m.name}`, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
      this._chip(x0 + 165, y, st, col, chipBg);
      y += 17;
      this.add.text(x0 - 165, y, `${CLASS_LABEL[m.class] || m.class} · ур.${m.level | 0} · ${m.gun || 'штатный ствол'} · фрагов ${m.frags | 0}`, {
        fontSize: '11px', color: '#7788aa'
      }).setOrigin(0, 0.5);
      y += 19;
      let bx = x0 - 128;
      const step = 86;
      this._btn(bx, y, m.inBattle && m.lieutenant == null ? 'В БОЮ ✓' : 'В БОЙ', () => { toggleBattle(m.id); this.scene.restart(); }, { fs: 10, disabled: m.lieutenant != null }); bx += step;
      this._btn(bx, y, 'СТВОЛ ▸', () => { this._gunMenu(m); }, { fs: 10 }); bx += step;
      const ownDs = (t.districts || []).filter(d => d.holder === 'player');
      if (m.lieutenant != null || ownDs.length) {
        this._btn(bx, y, m.lieutenant != null ? 'СНЯТЬ ★' : 'СМОТРЯЩИЙ', () => { this._cycleLieutenant(m, t); }, { fs: 10 }); bx += step;
      }
      this._btn(bx, y, '✕', () => { dismissMember(m.id); this.scene.restart(); }, { fs: 10 });
      y += SLOT_H - 17 - 19;
    });
    for (let i = (g.members || []).length; i < (g.slots | 0); i++) {
      // Пустой слот — та же высота SLOT_H: появление бойца не дёргает список.
      try {
        const sg = this.add.graphics();
        sg.fillStyle(0xffffff, 0.02);
        sg.fillRoundedRect(x0 - 175, y - 14, 350, SLOT_H, 6);
        sg.lineStyle(1, 0x3a3a5a, 0.9);
        sg.strokeRoundedRect(x0 - 175, y - 14, 350, SLOT_H, 6);
      } catch (e) {}
      this.add.text(x0, y + 20, '— пустой слот —', { fontSize: '11px', color: '#556078' }).setOrigin(0.5);
      y += SLOT_H;
    }
    y += 4;
    const canHire = (g.members || []).length < (g.slots | 0);
    this._btn(x0 - 90, y, `НАНЯТЬ · ${GANG_COSTS.hire}`, () => { if (hireMember().ok) this.scene.restart(); }, { fs: 11, green: canHire, disabled: !canHire });
    const slotPrice = (g.slots | 0) === 4 ? GANG_COSTS.slot5 : GANG_COSTS.slot6;
    const canSlot = (g.slots | 0) < GANG_RULES.maxMembers;
    this._btn(x0 + 90, y, canSlot ? `СЛОТ · ${slotPrice}` : 'СЛОТОВ МАКС', () => { if (buySlot().ok) this.scene.restart(); }, { fs: 11, disabled: !canSlot });
    y += 30;
    const woundedN = (g.members || []).filter(m => m && m.wounded).length;
    this._btn(x0 - 90, y, woundedN ? `ЛЕЧИТЬ · ${woundedN * GANG_COSTS.healEach}` : 'РАНЕНЫХ НЕТ', () => { if (healAll().ok) this.scene.restart(); }, { fs: 11, green: !!woundedN, disabled: !woundedN });
    const pool = Math.floor(Number(g.incomePool) || 0);
    this._btn(x0 + 90, y, pool ? `КАЗНА +${pool}` : 'КАЗНА ПУСТА', () => { if (claimIncome().ok) this.scene.restart(); }, { fs: 11, gold: !!pool, disabled: !pool });
  }

  // Чип статуса: замер пробником, плашка, поверх текст.
  _chip(xRight, y, str, color, bg) {
    try {
      const probe = this.add.text(0, 0, str, { fontSize: '12px' });
      const w = probe.displayWidth;
      probe.destroy();
      const g = this.add.graphics();
      g.fillStyle(bg, 1);
      g.fillRoundedRect(xRight - w - 14, y - 11, w + 14, 22, 11);
      this.add.text(xRight - 7, y, str, { fontSize: '12px', color }).setOrigin(1, 0.5);
    } catch (e) {
      this.add.text(xRight, y, str, { fontSize: '12px', color }).setOrigin(1, 0.5);
    }
  }

  // Независимое меню стволов: только стволы класса бойца (строго —
  // снайперу миниган не дать) + штатный. Выбор — сразу, без карусели.
  _gunMenu(m) {
    try {
      if (this._gunModal) return;
      const cls = m.class;
      const owned = (gameState.unlockedWeapons || []).filter(Boolean);
      let list = [];
      try {
        list = owned.filter(w => { try { return classOfWeapon(w) === cls; } catch (e) { return false; } });
      } catch (e) {}
      const depth = 70;
      const elems = [];
      const _cx = gameW(this) / 2;
      const overlay = this.add.rectangle(_cx, 360, gameW(this), 720, 0x000000, 0.6).setDepth(depth);
      overlay.setInteractive();
      overlay.on('pointerdown', () => this._closeGunMenu());
      elems.push(overlay);
      const RH = 34;
      const rows = list.length + 1;
      const H = Math.min(150 + rows * RH, 500);
      const bg = this.add.graphics().setDepth(depth + 1);
      bg.fillStyle(0x14142e, 1);
      bg.fillRoundedRect(_cx - 230, 360 - H / 2, 460, H, 12);
      bg.lineStyle(2, 0xffd24a, 1);
      bg.strokeRoundedRect(_cx - 230, 360 - H / 2, 460, H, 12);
      bg.lineStyle(1, 0xffffff, 0.1);
      bg.strokeRoundedRect(_cx - 227, 360 - H / 2 + 3, 454, H - 6, 10);
      elems.push(bg);
      const close = () => this._closeGunMenu();
      elems.push(this.add.text(_cx, 360 - H / 2 + 18, `СТВОЛ — ${m.name} (${CLASS_LABEL[cls] || cls})`, {
        fontSize: '15px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(depth + 2));
      let y = 360 - H / 2 + 52;
      const rowBtn = (ry, label, picked, cb) => {
        const t = this.add.text(_cx - 200, ry, label, {
          fontSize: '13px', color: picked ? '#ffd24a' : '#ffffff', fontStyle: picked ? 'bold' : 'normal'
        }).setOrigin(0, 0.5).setDepth(depth + 2);
        elems.push(t);
        const b = this.add.text(_cx + 200, ry, picked ? '✓' : 'ВЗЯТЬ', {
          fontSize: '12px', color: picked ? '#667788' : '#ffffff', backgroundColor: picked ? '#22223a' : '#1e4a24', padding: 5
        }).setOrigin(1, 0.5).setDepth(depth + 2);
        elems.push(b);
        if (!picked) {
          b.setInteractive({ useHandCursor: true });
          b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
          b.on('pointerout', () => b.setStyle({ color: '#ffffff' }));
          b.on('pointerdown', cb);
        }
      };
      // Штатный ствол (снять) — всегда доступен.
      rowBtn(y, `Штатный ствол${!m.gun ? ' ✓' : ''}`, !m.gun, () => { assignGun(m.id, null); this.scene.restart(); });
      y += RH;
      if (!list.length) {
        elems.push(this.add.text(_cx, y, 'Нет открытых стволов этого класса', {
          fontSize: '12px', color: '#667788'
        }).setOrigin(0.5, 0.5).setDepth(depth + 2));
        y += RH;
      }
      list.forEach(w => {
        let info = w;
        try {
          const wd = (weaponsList || []).find(x => x && x.name === w);
          const nm = (typeof getWeaponLabel === 'function') ? getWeaponLabel(w) : w;
          info = wd ? `${nm} · УРН ${wd.damage | 0} · ДАЛЬН ${wd.range | 0}` : nm;
        } catch (e) {}
        const picked = m.gun === w;
        rowBtn(y, (picked ? '► ' : '') + info, picked, () => { assignGun(m.id, w); this.scene.restart(); });
        y += RH;
      });
      const cb = this.add.text(_cx, 360 + H / 2 - 24, 'ЗАКРЫТЬ', {
        fontSize: '13px', color: '#ffffff', backgroundColor: '#553333', padding: 6
      }).setOrigin(0.5).setDepth(depth + 2);
      elems.push(cb);
      cb.setInteractive({ useHandCursor: true });
      cb.on('pointerdown', close);
      try {
        this.input.keyboard.once('keydown-ESC', close);
      } catch (e) {}
      this._gunModal = { elems };
    } catch (e) {}
  }

  _closeGunMenu() {
    try {
      const m = this._gunModal;
      if (!m) return;
      (m.elems || []).forEach(o => { try { o.destroy(); } catch (e) {} });
      this._gunModal = null;
    } catch (e) {}
  }

  _cycleLieutenant(m, t) {
    try {
      if (m.lieutenant != null) { setLieutenant(m.id, null); this.scene.restart(); return; }
      const ownDs = (t.districts || []).filter(d => d.holder === 'player' && !d.lieutenant);
      if (!ownDs.length) return;
      setLieutenant(m.id, ownDs[0].id);
      this.scene.restart();
    } catch (e) {}
  }

  // Карта — сплошная мозаика: районы делят общие волнистые границы
  // (без дыр и налезаний), вокруг вода и песочный берег. Сетка 3×3
  // с дрожащими узлами и общими серединами рёбер; сид фиксирован.
  _map(t) {
    const cx = gameW(this) / 2, top = 116;
    const mw = 424, mh = 400;
    const mx = cx - mw / 2, my = top;
    const bg = this.add.graphics();
    bg.fillStyle(0x101528, 1);
    bg.fillRoundedRect(mx, my, mw, mh, 10);
    bg.lineStyle(2, 0x2a3a5a, 1);
    bg.strokeRoundedRect(mx, my, mw, mh, 10);
    // Вода + пара волн.
    const pad = 18;
    const wx = mx + pad, wy = my + pad, ww = mw - pad * 2, wh = mh - pad * 2;
    const sea = this.add.graphics();
    sea.fillStyle(0x182a44, 1);
    sea.fillRoundedRect(wx, wy, ww, wh, 8);
    sea.lineStyle(1.5, 0x4a6a9a, 0.5);
    sea.strokeCircle(wx + 52, wy + wh - 44, 24);
    sea.strokeCircle(wx + ww - 62, wy + 46, 30);
    sea.strokeCircle(wx + ww - 36, wy + wh - 56, 16);

    // Узлы 4×4: края почти ровно, внутри дрожь сильнее.
    const rnd = _rand(90210);
    const gx = (i) => wx + 8 + (ww - 16) * (i / 3);
    const gy = (j) => wy + 8 + (wh - 16) * (j / 3);
    const N = [];
    for (let j = 0; j < 4; j++) {
      N.push([]);
      for (let i = 0; i < 4; i++) {
        const edge = (i === 0 || j === 0 || i === 3 || j === 3);
        const jr = edge ? 5 : 15;
        N[j].push(new Phaser.Geom.Point(gx(i) + (rnd() - 0.5) * 2 * jr, gy(j) + (rnd() - 0.5) * 2 * jr));
      }
    }
    // Общие середины рёбер (соседи делят — швы совпадают).
    const mid = (a, b, amt) => new Phaser.Geom.Point(
      (a.x + b.x) / 2 + (rnd() - 0.5) * 2 * amt,
      (a.y + b.y) / 2 + (rnd() - 0.5) * 2 * amt
    );
    const H = [], V = [];
    for (let j = 0; j < 4; j++) { H.push([]); for (let i = 0; i < 3; i++) H[j].push(mid(N[j][i], N[j][i + 1], 9)); }
    for (let j = 0; j < 3; j++) { V.push([]); for (let i = 0; i < 4; i++) V[j].push(mid(N[j][i], N[j + 1][i], 9)); }
    const cellPoly = (ci, rj) => ([
      N[rj][ci], H[rj][ci], N[rj][ci + 1], V[rj][ci + 1],
      N[rj + 1][ci + 1], H[rj + 1][ci], N[rj + 1][ci], V[rj][ci]
    ]);

    const g = this.add.graphics();
    const polys = [];
    (t.districts || []).forEach((d, k) => {
      const pts = cellPoly(k % 3, Math.floor(k / 3));
      polys.push(pts);
      const fill = HOLDER_FILL[d.holder] != null ? HOLDER_FILL[d.holder] : 0x555566;
      g.fillStyle(fill, 0.95);
      g.fillPoints(pts, true);
      g.lineStyle(2, 0x0a0a1a, 0.9);
      g.strokePoints(pts, true);
    });
    // Берег: песочная кайма + тёмная кромка по внешнему контуру.
    const coast = [
      N[0][0], H[0][0], N[0][1], H[0][1], N[0][2], H[0][2], N[0][3],
      V[0][3], N[1][3], V[1][3], N[2][3], V[2][3], N[3][3],
      H[3][2], N[3][2], H[3][1], N[3][1], H[3][0], N[3][0],
      V[2][0], N[2][0], V[1][0], N[1][0], V[0][0]
    ];
    const cg = this.add.graphics();
    cg.lineStyle(7, 0xc9b37e, 0.55);
    cg.strokePoints(coast, true);
    cg.lineStyle(2.5, 0x0a0a1a, 0.95);
    cg.strokePoints(coast, true);

    // Улицы по диагоналям + домики строго внутри полигонов.
    const det = this.add.graphics();
    det.lineStyle(2, 0x000000, 0.22);
    polys.forEach((pts) => {
      det.lineBetween(pts[0].x, pts[0].y, pts[4].x, pts[4].y);
      det.lineBetween(pts[2].x, pts[2].y, pts[6].x, pts[6].y);
      const poly = new Phaser.Geom.Polygon(pts);
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      det.fillStyle(0x000000, 0.25);
      let placed = 0, guard = 0;
      while (placed < 6 && guard++ < 40) {
        const hx = minX + rnd() * (maxX - minX), hy = minY + rnd() * (maxY - minY);
        if (Phaser.Geom.Polygon.Contains(poly, hx, hy)) { det.fillRect(hx - 3, hy - 2, 6, 4); placed++; }
      }
    });

    // Названия с обводкой + влияние + звезда смотрящего (по центроидам).
    const lrnd = _rand(517);
    (t.districts || []).forEach((d, k) => {
      const ci = k % 3, rj = Math.floor(k / 3);
      const c = this._centroid([N[rj][ci], N[rj][ci + 1], N[rj + 1][ci + 1], N[rj + 1][ci]]);
      const rot = (lrnd() - 0.5) * 0.22;
      const nm = this.add.text(c.x, c.y - 9, d.name, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center'
      }).setOrigin(0.5).setRotation(rot);
      try { nm.setStroke('#0a0a1a', 5); } catch (e) {}
      const sub = this.add.text(c.x, c.y + 13, `${holderName(d.holder)} · мы ${d.influence.player | 0}${d.lieutenant ? ' ★' : ''}`, {
        fontSize: '11px', color: d.holder === 'player' ? '#eaffea' : '#dde4ff', fontStyle: 'bold', align: 'center'
      }).setOrigin(0.5).setRotation(rot);
      try { sub.setStroke('#0a0a1a', 4); } catch (e) {}
    });
    // Легенда цветов — крупно и по центру под картой. Имена — из
    // ENEMY_GANGS (сюжетные, без дрейфа). Доход — тултипом при наведении
    // на НАШ район (см. ховер ниже): чужие районы молчат.
    // Двухпроходная центровка: создали — замерили — сдвинули.
    const legY = my + mh + 22;
    const legItems = [['Мы', 'player']].concat(ENEMY_GANGS.map(g => [g.name, g.id]));
    const legMade = [];
    let legX = 0;
    const LEG_GAP = 30, LEG_BW = 34, LEG_TX = 44;
    legItems.forEach(([nm, h]) => {
      // Индивидуальный бейдж банды; нет арта — цветная точка как раньше.
      let badgeShown = false;
      try {
        const bkey = gangBadgeKey(h);
        if (bkey && this.textures.exists(bkey)) {
          const bi = this.add.image(legX + LEG_BW / 2, legY, bkey);
          bi.setDisplaySize(LEG_BW, Math.round(LEG_BW * 80 / 64));
          legMade.push(bi);
          badgeShown = true;
        }
      } catch (e) {}
      if (!badgeShown) {
        const dot = this.add.graphics();
        dot.fillStyle(HOLDER_FILL[h], 1);
        dot.fillCircle(legX + LEG_BW / 2, legY, 10);
        dot.lineStyle(1.5, 0x0a0a1a, 0.9);
        dot.strokeCircle(legX + LEG_BW / 2, legY, 10);
        legMade.push(dot);
      }
      const lt = this.add.text(legX + LEG_TX, legY, nm, { fontSize: '13px', color: HOLDER_CSS[h], fontStyle: 'bold' }).setOrigin(0, 0.5);
      legMade.push(lt);
      legX += LEG_TX + lt.displayWidth + LEG_GAP;
    });
    try {
      const legW = legX - LEG_GAP;
      const dx = cx - legW / 2;
      legMade.forEach(o => { o.x += dx; });
    } catch (e) {}
    this._turfHover(t, polys);
  }

  // Ховер районов: доход показываем только на нашем (300/день, 450 со ★).
  _turfHover(t, polys) {
    try {
      this._turfTipBg = this.add.graphics().setDepth(60).setVisible(false);
      this._turfTipTx = this.add.text(0, 0, '', {
        fontSize: '12px', color: '#ffe1a0', fontStyle: 'bold', align: 'center'
      }).setOrigin(0.5, 1).setDepth(61).setVisible(false);
    } catch (e) { return; }
    this.input.on('pointermove', (p) => {
      try {
        let found = null;
        for (const pts of (polys || [])) {
          if (Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(pts), p.x, p.y)) {
            const k = polys.indexOf(pts);
            found = (t.districts || [])[k] || null;
            break;
          }
        }
        if (!found || found.holder !== 'player') {
          this._turfTipBg.setVisible(false);
          this._turfTipTx.setVisible(false);
          return;
        }
        const inc = Math.round(GANG_COSTS.districtIncome * (found.lieutenant ? 1.5 : 1));
        const label = `Доход: ${inc}/день${found.lieutenant ? ' (★)' : ''}`;
        this._turfTipTx.setText(label);
        // Позиция — над курсором с клампом по экрану.
        const tw = Math.max(80, this._turfTipTx.displayWidth + 20);
        let tx = Phaser.Math.Clamp(p.x, tw / 2 + 4, gameW(this) - tw / 2 - 4);
        let ty = Math.max(56, p.y - 14);
        this._turfTipTx.setPosition(tx, ty).setVisible(true);
        const bg = this._turfTipBg;
        bg.clear();
        bg.fillStyle(0x000000, 0.85);
        bg.fillRoundedRect(tx - tw / 2, ty - 26, tw, 24, 6);
        bg.lineStyle(1, 0xaa8844, 1);
        bg.strokeRoundedRect(tx - tw / 2, ty - 26, tw, 24, 6);
        bg.setVisible(true);
      } catch (e) {}
    });
  }

  _centroid(pts) {
    try {
      let x = 0, y = 0;
      pts.forEach(p => { x += p.x; y += p.y; });
      return new Phaser.Geom.Point(x / Math.max(1, pts.length), y / Math.max(1, pts.length));
    } catch (e) { return new Phaser.Geom.Point(640, 300); }
  }

  _contracts(t) {
    const cx = UX(this, 1072);
    // Награда боя — в самой карточке (ролл при генерации, см. gang.js):
    // строка показывает ровно то, что выплатит settleBattle.
    // Замер: заголовок + 2 строки + кнопка = 136px, шаг 148.
    let y = 146;
    const list = (t.contracts || []).slice(0, 3);
    if (!list.length) this.add.text(cx, y, '— нет контрактов —', { fontSize: '13px', color: '#556078' }).setOrigin(0.5);
    list.forEach(c => {
      const d = (t.districts || []).find(x => x && x.id === c.districtId);
      const eg = ENEMY_GANGS.find(x => x.id === c.enemy);
      const days = Math.max(0, Math.ceil((Number(c.expiresAt) - Date.now()) / (24 * 3600 * 1000)));
      const rw = contractReward(c);
      const card = this.add.graphics();
      card.fillStyle(0x1a1a38, 1);
      card.fillRoundedRect(cx - 175, y, 350, 136, 8);
      card.lineStyle(2, 0x554422, 1);
      card.strokeRoundedRect(cx - 175, y, 350, 136, 8);
      // Полоса врага слева — сразу видно, против кого контракт.
      try {
        const egc = ENEMY_GANGS.find(x => x.id === c.enemy);
        const ecol = egc ? egc.color : 0x554422;
        card.fillStyle(ecol, 1);
        card.fillRoundedRect(cx - 175, y, 7, 136, { tl: 8, tr: 0, bl: 8, br: 0 });
        // Верхняя акцентная кромка + внутренний светлый контур.
        card.fillStyle(ecol, 0.55);
        card.fillRoundedRect(cx - 175, y, 350, 5, { tl: 8, tr: 8, bl: 0, br: 0 });
        card.lineStyle(1, 0xffffff, 0.1);
        card.strokeRoundedRect(cx - 172, y + 3, 344, 130, 7);
        // Затемнение низа карточки — глубина.
        card.fillStyle(0x000000, 0.22);
        card.fillRoundedRect(cx - 175, y + 104, 350, 32, { tl: 0, tr: 0, bl: 8, br: 8 });
      } catch (e) {}
      this.add.text(cx, y + 12, c.text, { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: 270 } }).setOrigin(0.5, 0);
      // Бейдж врага в правом верхнем углу (был по центру справа — налезал
      // на строку награды). Заголовок сужен до 270, чтобы не задевать.
      try {
        const bkey = gangBadgeKey(c.enemy);
        if (bkey && this.textures.exists(bkey)) {
          this.add.image(cx + 150, y + 24, bkey).setDisplaySize(22, 28);
        }
      } catch (e) {}
      this.add.text(cx, y + 56, `${c.mode} · ${eg ? eg.name : c.enemy} · ${d ? d.name : ''} · ещё ${days} дн.`, { fontSize: '11px', color: HOLDER_CSS[c.enemy] || '#99aacc' }).setOrigin(0.5);
      this.add.text(cx, y + 72, `Победа +${rw.winInfl} влияния, +${rw.bonus} монет · провал −${rw.loseInfl}`, { fontSize: '11px', color: '#ffe1a0', align: 'center' }).setOrigin(0.5);
      this._btn(cx, y + 106, 'В БОЙ', () => {
        // Контракт — отдельный бой (не свободная игра): сразу в GameScene
        // с классом/сложностью/лимитами из сейва, банда идёт своим составом.
        try {
          this.scene.start('GameScene', {
            mode: c.mode,
            contractId: c.id,
            selectedClass: (gameState.lastClass && ['Assault', 'Tank', 'Medic', 'Sniper'].includes(gameState.lastClass)) ? gameState.lastClass : 'Assault',
            playerName: gameState.playerName,
            scoreLimit: c.mode === 'CTF' ? gameState.ctfLimit
              : c.mode === 'BOMB' ? (gameState.bombLimit || 3)
              : c.mode === 'KOTH' ? (gameState.kothLimit || 200)
              : gameState.scoreLimit,
            suddenStart: c.mode === 'CTF' ? !!gameState.ctfSuddenStart : false
          });
        } catch (e) {}
      }, { green: true, fs: 12 });
      y += 148;
    });
  }
}
