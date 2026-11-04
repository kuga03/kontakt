import { gameW, UX } from '../ui/layout.js';
import { gameState, saveGameState, mostPlayedClass, addCoins } from '../data/gameState.js';
import { getRank } from '../data/ranks.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { detectPlatform, platformLabel, getViewer, getPlatformFriends, inviteFriend } from '../platform/index.js';
import { CLASS_IDS, CLASS_LABELS, mockFriendProfile, buildSelfProfile, fmtPct, fmtLastSeen } from '../data/friendProfiles.js';
import { MEDALS, getMedalCounts } from '../data/medals.js';
import { drawMedalIcons } from '../ui/medalsView.js';
import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';

const PREVIEW_CLASSES = { Assault, Tank, Medic, Sniper };

// Создание клана — платное.
const CLAN_PRICE = 30000;

// Друзья и клан: локальный список + друзья с платформы (VK пикер / Ya).
// Клик по другу — окно профиля: уровень, звание, живой персонаж,
// общий винрейт + винрейт по каждому классу, K/D, любимое оружие,
// серия побед, ачивки, клан, «был в сети».
// Стата чужих пока демо (детерминирована по нику): реальная появится
// с сервером, интерфейс окна уже финальный.
export default class FriendsScene extends Phaser.Scene {
  constructor() {
    super('FriendsScene');
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#0a0a2a');
    const _cx = gameW(this) / 2;
    this._profileModal = null;
    this._profilePreview = null;
    this._exitOnClose = null;
    this._inputModal = null;
    this._platformFriends = [];
    if (this.textures.exists('fon_menu')) {
      const src = this.textures.get('fon_menu').getSourceImage();
      const ratio = src.height / src.width;
      const bgW = gameW(this) * 1.15;
      const bgH = Math.round(bgW * ratio);
      this.add.image(_cx, 720 - bgH / 2, 'fon_menu')
        .setDisplaySize(bgW, bgH)
        .setAlpha(0.35)
        .setDepth(-1);
    }
    this.add.text(_cx, 30, 'ДРУЗЬЯ И КЛАН', {
      fontSize: '34px', color: '#ffffff'
    }).setOrigin(0.5);

    const plat = detectPlatform();
    this._sub = this.add.text(_cx, 62, platformLabel(plat) + ' · нажми на друга — откроется профиль', {
      fontSize: '13px', color: '#667788'
    }).setOrigin(0.5);

    if (!Array.isArray(gameState.friends)) gameState.friends = [];

    this._panel(250, 100, 440, 470, 'ДРУЗЬЯ');
    this._panel(830, 100, 620, 470, 'КЛАН');
    this._friendsBox = this.add.container(0, 0);
    this._renderFriends();

    this._renderClan();

    const addBtn = this.add.text(UX(this, 250), 592, '+ ДОБАВИТЬ ДРУГА', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: 8
    }).setOrigin(0.5);
    addBtn.setInteractive({ useHandCursor: true });
    addBtn.on('pointerdown', () => {
      this._openInputModal({
        title: 'ДОБАВИТЬ ДРУГА',
        sub: 'Введи ник — потом открой его профиль',
        fields: [{ id: 'nick', label: 'Ник друга', max: 16, placeholder: 'Например, Михалыч' }],
        okLabel: 'ДОБАВИТЬ',
        onOk: (vals) => {
          const name = (vals.nick || '').trim().slice(0, 16);
          if (!name) return false; // пусто — не закрываем, пусть введёт
          if (!gameState.friends.some(f => f && f.name === name)) {
            gameState.friends.push({ name, added: Date.now() });
            saveGameState();
          }
          this._closeInputModal();
          this.scene.restart();
          return false;
        }
      });
    });

    // Кнопки платформы: позвать из VK / обновить список.
    const platBtn = this.add.text(UX(this, 250), 632, plat === 'vk' ? '👥 ВЫБРАТЬ ИЗ VK' : '📨 ПОЗВАТЬ В ИГРУ', {
      fontSize: '13px', color: '#ffffff', backgroundColor: '#3a3a7a', padding: 7
    }).setOrigin(0.5);
    platBtn.setInteractive({ useHandCursor: true });
    platBtn.on('pointerdown', async () => {
      if (plat === 'vk') {
        const list = await getPlatformFriends();
        if (list && list.length) {
          let added = 0;
          list.forEach(u => {
            if (!gameState.friends.some(f => f && f.name === u.name)) {
              gameState.friends.push({ name: u.name, added: Date.now(), fromPlatform: true });
              added++;
            }
          });
          if (added) saveGameState();
          this.scene.restart();
        } else {
          const r = await inviteFriend();
          this._toast(r === 'invite-sent' ? 'Приглашение отправлено!' : 'Открой игру во VK — там выбор друзей');
        }
      } else {
        const r = await inviteFriend();
        this._toast(r === 'invite-sent' ? 'Приглашение отправлено!' : 'Скинь другу ссылку на игру — позвать из игры можно во VK');
      }
    });

    const meBtn = this.add.text(UX(this, 830), 592, '👤 МОЙ ПРОФИЛЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#252560', padding: 8
    }).setOrigin(0.5);
    meBtn.setInteractive({ useHandCursor: true });
    meBtn.on('pointerdown', () => this._openSelfProfile());

    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));

    this.input.keyboard.on('keydown-ESC', () => {
      if (this._inputModal) this._closeInputModal();
      else if (this._profileModal) this._closeProfile();
    });

    // Имя смотрящего из SDK — подтягиваем тихо, без ломки сцены.
    getViewer(() => gameState.playerName).then(v => {
      if (!v || v.platform === 'local' || v.platform === 'iframe') return;
      try { this._sub.setText(platformLabel(plat) + ` · ты: ${v.name}`); } catch (e) {}
    }).catch(() => {});

    // Приход из главного меню («ПРОФИЛЬ»): сразу открываем свой профиль.
    // Только по явному view:'self' — обычный вход (view:'friends'/без
    // параметров) профиль сам не открывает никогда.
    if (data && (data.view === 'self' || data.openSelf)) this._openSelfProfile(data.returnTo || null);
    // Вход одноразовый: внутренние рестарты сцены (добавил друга и т.п.)
    // не должны заново открывать профиль.
    try {
      if (data) { data.view = 'friends'; delete data.openSelf; }
    } catch (e) {}
  }

  _openSelfProfile(returnTo) {
    const me = buildSelfProfile(gameState, mostPlayedClass);
    me.achievementsTotal = ACHIEVEMENTS.length;
    this._openProfile(me, null);
    // Приход из главного меню: закрытие профиля возвращает обратно.
    this._exitOnClose = returnTo || null;
  }

  _renderFriends() {
    try { this._friendsBox.removeAll(true); } catch (e) {}
    const friends = gameState.friends || [];
    if (!friends.length) {
      this._friendsBox.add(this.add.text(UX(this, 250), 200, 'Пока пусто.\nНажми на друга —\nувидишь его уровень,\nперсонажа и винрейт\nпо классам.', {
        fontSize: '14px', color: '#556677', align: 'center'
      }).setOrigin(0.5, 0));
      return;
    }
    let fy = 150;
    const shown = friends.slice(0, 10);
    shown.forEach((f) => {
      if (!f || !f.name) return;
      const prof = mockFriendProfile(f.name, f.added);
      // Точка статуса.
      const dot = this.add.graphics();
      dot.fillStyle(prof.online ? 0x44dd44 : 0x667788, 1);
      dot.fillCircle(56, fy, 5);
      this._friendsBox.add(dot);
      const nm = this.add.text(UX(this, 70), fy, (f.fromPlatform ? '🌐 ' : '') + prof.name, {
        fontSize: '16px', color: '#ffffff'
      }).setOrigin(0, 0.5);
      nm.setInteractive({ useHandCursor: true });
      nm.on('pointerdown', () => this._openProfile(prof, f));
      nm.on('pointerover', () => nm.setStyle({ color: '#ffff55' }));
      nm.on('pointerout', () => nm.setStyle({ color: '#ffffff' }));
      this._friendsBox.add(nm);
      const lvl = this.add.text(UX(this, 70), fy + 15, `ур. ${prof.level} · ${prof.online ? 'в сети' : 'не в сети'}`, {
        fontSize: '11px', color: prof.online ? '#66cc66' : '#556677'
      }).setOrigin(0, 0.5);
      this._friendsBox.add(lvl);
      const open = this.add.text(UX(this, 285), fy, 'ПРОФИЛЬ', {
        fontSize: '12px', color: '#8fb8ff', backgroundColor: '#1a1a4a', padding: 5
      }).setOrigin(0, 0.5);
      open.setInteractive({ useHandCursor: true });
      open.on('pointerdown', () => this._openProfile(prof, f));
      this._friendsBox.add(open);
      const inClan = gameState.clan && (gameState.clan.members || []).includes(f.name);
      const canInvite = !!(gameState.clan && !inClan);
      const tag = this.add.text(UX(this, 368), fy, inClan ? '[в клане]' : '[позвать]', {
        fontSize: '11px', color: inClan ? '#88dd88' : canInvite ? '#ffee88' : '#556677',
        backgroundColor: canInvite ? '#252560' : null, padding: 4
      }).setOrigin(0, 0.5);
      if (canInvite) {
        tag.setInteractive({ useHandCursor: true });
        tag.on('pointerdown', () => {
          gameState.clan.members = gameState.clan.members || [];
          gameState.clan.members.push(f.name);
          saveGameState();
          this.scene.restart();
        });
      }
      this._friendsBox.add(tag);
      const del = this.add.text(UX(this, 445), fy, '✕', {
        fontSize: '13px', color: '#ff8888', backgroundColor: '#442222', padding: 4
      }).setOrigin(0, 0.5);
      del.setInteractive({ useHandCursor: true });
      del.on('pointerdown', () => {
        const gi = gameState.friends.findIndex(v => v && v.name === f.name);
        if (gi >= 0) gameState.friends.splice(gi, 1);
        if (gameState.clan) {
          gameState.clan.members = (gameState.clan.members || []).filter(n => n !== f.name);
        }
        saveGameState();
        this.scene.restart();
      });
      this._friendsBox.add(del);
      fy += 42;
    });
    if (friends.length > shown.length) {
      this._friendsBox.add(this.add.text(UX(this, 60), fy, `…и ещё ${friends.length - shown.length}`, {
        fontSize: '13px', color: '#667788'
      }).setOrigin(0, 0.5));
    }
  }

  _renderClan() {
    if (!gameState.clan) {
      this.add.text(UX(this, 830), 220, 'Своего клана пока нет.\nСоздание — 30 000 монет.\nСоздай — и зови друзей\nкнопкой «позвать» слева.', {
        fontSize: '15px', color: '#99aacc', align: 'center'
      }).setOrigin(0.5, 0);
      const mk = this.add.text(UX(this, 830), 380, 'СОЗДАТЬ КЛАН · 30 000', {
        fontSize: '17px', color: '#ffffff', backgroundColor: '#5a4a1a', padding: 10
      }).setOrigin(0.5);
      mk.setInteractive({ useHandCursor: true });
      mk.on('pointerdown', () => {
        this._openInputModal({
          title: 'НОВЫЙ КЛАН',
          sub: `Стоит 30 000 монет · у тебя ${gameState.coins | 0}`,
          fields: [
            { id: 'cname', label: 'Название клана', max: 20, placeholder: 'Например, Волки' },
            { id: 'ctag', label: 'Тег (2–5 букв)', max: 5, placeholder: 'ВОЛК' }
          ],
          okLabel: 'СОЗДАТЬ ЗА 30 000',
          onOk: (vals) => {
            const nm = (vals.cname || '').trim().slice(0, 20);
            const tg = (vals.ctag || '').trim().slice(0, 5).toUpperCase();
            if (!nm || !tg) return false;
            if ((gameState.coins | 0) < CLAN_PRICE) {
              this._toast('Не хватает монет! Нужно 30 000.');
              return false;
            }
            addCoins(-CLAN_PRICE);
            gameState.clan = { name: nm, tag: tg, members: [] };
            saveGameState();
            this._closeInputModal();
            this.scene.restart();
            return false;
          }
        });
      });
    } else {
      const c = gameState.clan;
      this.add.text(UX(this, 830), 150, `[${c.tag}] ${c.name}`, {
        fontSize: '22px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(UX(this, 830), 180, `Участники: ${(c.members || []).length + 1} (ты — глава)`, {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0.5);
      this.add.text(UX(this, 620), 215, `${gameState.playerName} (глава)`, {
        fontSize: '15px', color: '#aaffaa'
      }).setOrigin(0, 0.5);
      let my = 245;
      const shownM = (c.members || []).slice(0, 8);
      shownM.forEach(n => {
        this.add.text(UX(this, 620), my, n, {
          fontSize: '15px', color: '#ffffff'
        }).setOrigin(0, 0.5);
        const kick = this.add.text(UX(this, 1000), my, 'выгнать', {
          fontSize: '12px', color: '#ff8888', backgroundColor: '#442222', padding: 4
        }).setOrigin(0, 0.5);
        kick.setInteractive({ useHandCursor: true });
        kick.on('pointerdown', () => {
          c.members = c.members.filter(v => v !== n);
          saveGameState();
          this.scene.restart();
        });
        my += 30;
      });
      if ((c.members || []).length > shownM.length) {
        this.add.text(UX(this, 620), my, `…и ещё ${(c.members || []).length - shownM.length}`, {
          fontSize: '13px', color: '#667788'
        }).setOrigin(0, 0.5);
      }
      // Кнопка — внутри панели клана: внизу экрана её перекрывал «МОЙ ПРОФИЛЬ».
      const dis = this.add.text(UX(this, 830), 545, 'РАСПУСТИТЬ КЛАН', {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#553333', padding: 8
      }).setOrigin(0.5);
      dis.setInteractive({ useHandCursor: true });
      dis.on('pointerdown', () => {
        this._openConfirmModal({
          title: 'РАСПУСТИТЬ КЛАН?',
          text: 'Участники разойдутся, название и тег пропадут.',
          okLabel: 'РАСПУСТИТЬ',
          onOk: () => {
            gameState.clan = null;
            saveGameState();
            this.scene.restart();
          }
        });
      });
    }
  }

  // ---- Окно профиля ----
  _openProfile(prof, friendRef) {
    // Ручное открытие чужого профиля отменяет «вернуться назад».
    this._exitOnClose = null;
    if (this._profileModal) this._closeProfile();
    const cx = gameW(this) / 2, cy = 360, W = 920, H = 600;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeProfile());
    const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
      .setStrokeStyle(2, 0xffd24a, 1);
    elems.push(overlay, bg);

    const title = this.add.text(cx, cy - H / 2 + 24,
      (prof.isSelf ? 'МОЙ ПРОФИЛЬ · ' : 'ПРОФИЛЬ · ') + prof.name + (prof.clanTag ? ` [${prof.clanTag}]` : ''), {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202);
    elems.push(title);
    const sub = this.add.text(cx, cy - H / 2 + 50,
      `${getRank(prof.level)} · ур. ${prof.level} · ${fmtLastSeen(prof)}` +
      (prof.isMock ? ' · демо-данные до сети' : ''), {
      fontSize: '13px', color: prof.isMock ? '#cc9955' : '#99aacc'
    }).setOrigin(0.5).setDepth(202);
    elems.push(sub);

    // Слева — живой персонаж (любимый класс в его цветах).
    const px = cx - 320, py = cy + 40;
    const ay = py + 20; // якорь персонажа — сидит низко в рамке
    const frame = this.add.graphics().setDepth(202);
    frame.lineStyle(2, 0x3a3a6a, 1);
    frame.strokeRoundedRect(px - 130, py - 190, 260, 330, 12);
    elems.push(frame);
    const clsName = CLASS_LABELS[prof.favClass] || prof.favClass;
    elems.push(this.add.text(px, py - 208, prof.favWeapon ? `${clsName} · ${prof.favWeapon}` : `${clsName} · без оружия`, {
      fontSize: '13px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));
    try {
      const Cls = PREVIEW_CLASSES[prof.favClass] || Assault;
      // Цвета друга подменяем только на момент создания рига, потом возвращаем.
      const realH = gameState.playerHeadColor, realB = gameState.playerBodyColor;
      if (!prof.isSelf) {
        gameState.playerHeadColor = prof.headColor;
        gameState.playerBodyColor = prof.bodyColor;
      }
      let p = null;
      try {
        p = new Cls(this, px, ay, { name: 'friend_preview', team: 'blue', noDefaults: true });
        p.previewScale(1.8);
        if (p.body) { p.body.setAllowGravity(false); p.body.setImmovable(true); }
        p.setVelocity(0, 0);
        p._editorGrounded = true;
        // Свой ствол — только реально надетый (без подмены на АК);
        // у моков друга оружие всегда есть из генератора.
        if (prof.isSelf) {
          try { if (prof.favWeapon) p.addWeapon(prof.favWeapon); } catch (e1) {}
        } else {
          try {
            p.addWeapon(prof.favWeapon);
          } catch (e1) {
            try { p.addWeapon('AK-47'); } catch (e2) {}
          }
        }
        try { p.activeWeaponIndex = p.inventory.length - 1; } catch (e3) {}
        try { p._lastGunName = null; } catch (e4) {}
        p.aimAt(px + 200, ay - 10);
        p.updateBars();
        if (p.updateGun) p.updateGun();
        this._liftPreview(p);
        p.healthBar.setVisible(false);
        p.armorBar.setVisible(false);
        p.nameText.setVisible(false);
        if (!p.weapon) { p._gunAllowed = false; p._setGunVisible(false); }
      } finally {
        if (!prof.isSelf) { gameState.playerHeadColor = realH; gameState.playerBodyColor = realB; }
      }
      this._profilePreview = p;
    } catch (e) {
      this._profilePreview = null;
      try { console.warn('[FriendsScene] preview failed:', e); } catch (ee) {}
    }
    elems.push(this.add.text(px, py + 168, `Рейтинг: ${prof.rating | 0}`, {
      fontSize: '14px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));

    // Справа — цифры.
    const tx = cx + 80;
    const rows = [
      [`Матчи: ${prof.matches | 0}`, `Победы: ${prof.wins | 0}`],
      [`Винрейт: ${fmtPct(prof.winrate)}`, `Поражения: ${prof.losses | 0}`],
      [`Фраги: ${prof.kills | 0} / ${prof.deaths | 0}`, `K/D: ${isFinite(prof.kd) ? prof.kd.toFixed(2) : '—'}`],
      [`Ачивки: ${prof.achievements | 0}${prof.achievementsTotal ? '/' + prof.achievementsTotal : ''}`, `Кейсы: ${prof.cases | 0}`],
      [`Кампания: ${prof.campaignWins | 0} ур.`, prof.isSelf && prof.flags != null ? `Флаги: ${prof.flags | 0}` : `Серия побед: ${prof.isSelf ? '—' : (prof.winStreak | 0)}`],
      [prof.registeredDays ? `В игре: ${prof.registeredDays} дн.` : (prof.isSelf && prof.coinsEarned != null ? `Заработано: ${prof.coinsEarned | 0}` : 'В игре давно'),
       prof.addedAt ? `Дружим с ${this._fmtDate(prof.addedAt)}` : (prof.clanName ? `Клан: ${prof.clanName}` : 'Без клана')]
    ];
    let ry = cy - H / 2 + 90;
    rows.forEach(pair => {
      elems.push(this.add.text(tx - 130, ry, pair[0], { fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(202));
      elems.push(this.add.text(tx + 150, ry, pair[1], { fontSize: '14px', color: '#dddddd' }).setOrigin(0, 0.5).setDepth(202));
      ry += 28;
    });

    // Винрейт по классам — 4 строки с барами.
    elems.push(this.add.text(tx + 10, ry + 8, 'ПОБЕДЫ ПО КЛАССАМ', {
      fontSize: '13px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202));
    ry += 32;
    CLASS_IDS.forEach(c => {
      const s = (prof.perClass && prof.perClass[c]) || { matches: 0, wins: 0, kills: 0 };
      const wr = s.matches > 0 ? s.wins / s.matches : 0;
      const favMark = c === prof.favClass ? ' ★' : '';
      elems.push(this.add.text(tx - 130, ry, `${CLASS_LABELS[c]}${favMark}`, {
        fontSize: '13px', color: c === prof.favClass ? '#ffd24a' : '#ffffff', fontStyle: c === prof.favClass ? 'bold' : 'normal'
      }).setOrigin(0, 0.5).setDepth(202));
      elems.push(this.add.text(tx + 20, ry, `${s.wins | 0}/${s.matches | 0} · ${s.kills | 0} фр.`, {
        fontSize: '12px', color: '#99aacc'
      }).setOrigin(0, 0.5).setDepth(202));
      elems.push(this.add.text(tx + 170, ry, fmtPct(wr), {
        fontSize: '13px', color: wr >= 0.55 ? '#88dd88' : wr >= 0.45 ? '#ffee88' : '#ff9999', fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(202));
      const bar = this.add.graphics().setDepth(202);
      bar.fillStyle(0x22223a, 1);
      bar.fillRoundedRect(tx - 130, ry + 13, 300, 8, 4);
      bar.fillStyle(wr >= 0.55 ? 0x44cc44 : wr >= 0.45 ? 0xccaa22 : 0xaa4444, 1);
      bar.fillRoundedRect(tx - 130, ry + 13, Math.max(8, 300 * Math.min(1, wr)), 8, 4);
      elems.push(bar);
      ry += 38;
    });

    // Полка боевых наград (только себе — у друзей мок-данные).
    // Те же рисованные медальки, что в итогах боя (п.7): круг + эмблема,
    // счётчик ×N, имя и условие — в тултипе по ховеру.
    if (prof.isSelf) {
      elems.push(this.add.text(tx + 10, ry + 6, 'НАГРАДЫ', {
        fontSize: '13px', color: '#8fb8ff', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(202));
      ry += 28;
      let counts = {};
      try { counts = getMedalCounts() || {}; } catch (e) {}
      const got = MEDALS.filter(m => (counts[m.id] | 0) > 0).map(m => m.id);
      if (!got.length) {
        elems.push(this.add.text(tx + 10, ry, 'Пока пусто — играй бои.', {
          fontSize: '12px', color: '#667788'
        }).setOrigin(0.5).setDepth(202));
        ry += 24;
      } else {
        // Один ряд на все 10 (48px на медаль) — влезает до кнопок низа.
        const mr = drawMedalIcons(this, tx + 10, ry, got, { counts, perRow: 10, cellW: 48, MR: 12, depth: 202 });
        (mr.objs || []).forEach(o => elems.push(o));
        ry += mr.h + 6;
      }
    }

    // Кнопки низа.
    const by = cy + H / 2 - 34;
    if (friendRef && gameState.clan && !(gameState.clan.members || []).includes(friendRef.name)) {
      const inv = this.add.text(cx - 200, by, 'В КЛАН', {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: 8
      }).setOrigin(0.5).setDepth(202);
      inv.setInteractive({ useHandCursor: true });
      inv.on('pointerdown', () => {
        gameState.clan.members = gameState.clan.members || [];
        gameState.clan.members.push(friendRef.name);
        saveGameState();
        this._closeProfile();
        this.scene.restart();
      });
      elems.push(inv);
    }
    if (friendRef) {
      const del = this.add.text(cx, by, 'УДАЛИТЬ', {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#553333', padding: 8
      }).setOrigin(0.5).setDepth(202);
      del.setInteractive({ useHandCursor: true });
      del.on('pointerdown', () => {
        const gi = gameState.friends.findIndex(v => v && v.name === friendRef.name);
        if (gi >= 0) gameState.friends.splice(gi, 1);
        if (gameState.clan) gameState.clan.members = (gameState.clan.members || []).filter(n => n !== friendRef.name);
        saveGameState();
        this._closeProfile();
        this.scene.restart();
      });
      elems.push(del);
    }
    const close = this.add.text(cx + 200, by, 'ЗАКРЫТЬ', {
      fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 8
    }).setOrigin(0.5).setDepth(202);
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this._closeProfile());
    elems.push(close);

    this._profileModal = { elems };
  }

  // Слои персонажа как в бою и редакторе: задняя рука (3.6) < ствол (4.2) <
  // передняя рука (4.6) < голова (5). Поднимаем всё на +200 поверх окна
  // (201), порядок сохраняем. Вызывать после каждого updateGun/updateBars:
  // они каждый кадр возвращают глубинам родные значения.
  _liftPreview(p) {
    if (!p) return;
    const LIFT = 200;
    const one = (o) => {
      try {
        if (o && o.setDepth && typeof o.depth === 'number' && o.depth < 100) {
          o.setDepth(o.depth + LIFT);
        }
      } catch (e) {}
    };
    try {
      one(p);
      (p._allParts || []).forEach(one);
      (p._geoFace || []).forEach(one);
      [
        p.head, p.neck, p.torso, p.capImg, p.gun, p.gunImg,
        p.armGun, p.armFront,
        p._thighL, p._thighR, p._shinL, p._shinR, p._footL, p._footR,
        p.healthBar, p.armorBar, p.nameText
      ].forEach(one);
    } catch (e) {}
  }

  _closeProfile() {
    const m = this._profileModal;
    const exitTo = this._exitOnClose;
    this._exitOnClose = null;
    this._profileModal = null;
    if (this._profilePreview) {
      try { this._profilePreview.destroy(); } catch (e) {}
      this._profilePreview = null;
    }
    if (m) m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    // Профиль открыли из другого места (главное меню) — возвращаемся туда.
    if (exitTo) this.scene.start(exitTo);
  }

  _fmtDate(t) {
    try {
      const d = new Date(t);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}.${mm}.${d.getFullYear()}`;
    } catch (e) { return 'давно'; }
  }

  // ---- Ввод текста внутри игры: чистый Phaser, без window.prompt и без DOM
  // (системные окна режутся модерацией в iframe, DOM не виден в скейле).
  // Печать — с клавиатуры, клик по полю — выбор поля, Enter — OK. ----
  _openInputModal(opts) {
    if (this._inputModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(300);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeInputModal());
    elems.push(overlay);
    const fields = opts.fields || [{ id: 'f0', label: '', max: 16, placeholder: '' }];
    fields.forEach(f => { f.value = ''; });
    const n = fields.length;
    const W = 520;
    const H = 150 + n * 78 + 70;
    const top = cy - H / 2;
    elems.push(this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(301)
      .setStrokeStyle(2, 0xffd24a, 1));
    elems.push(this.add.text(cx, top + 30, opts.title || '', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));
    let fy = top + 62;
    if (opts.sub) {
      elems.push(this.add.text(cx, fy, opts.sub, {
        fontSize: '13px', color: '#99aacc'
      }).setOrigin(0.5).setDepth(302));
      fy += 26;
    }
    fields.forEach((f, i) => {
      if (f.label) {
        elems.push(this.add.text(cx - W / 2 + 30, fy, f.label, {
          fontSize: '14px', color: '#99aacc'
        }).setOrigin(0, 0.5).setDepth(302));
        fy += 24;
      }
      const box = this.add.rectangle(cx, fy + 18, W - 60, 42, 0x0a0a2a, 1).setDepth(302)
        .setStrokeStyle(2, i === 0 ? 0xffd24a : 0x3a3a6a, 1);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        const m = this._inputModal;
        if (!m) return;
        m.active = i;
        m.fields.forEach((ff, j) => {
          try { ff.box.setStrokeStyle(2, j === i ? 0xffd24a : 0x3a3a6a, 1); } catch (e) {}
        });
        this._refreshInputTexts();
      });
      f.box = box;
      elems.push(box);
      f.textObj = this.add.text(cx - W / 2 + 46, fy + 18, '', {
        fontSize: '18px', color: '#ffffff'
      }).setOrigin(0, 0.5).setDepth(303);
      elems.push(f.textObj);
      fy += 62;
    });
    const by = top + H - 36;
    const okBtn = this.add.text(cx - 110, by, opts.okLabel || 'OK', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: 8
    }).setOrigin(0.5).setDepth(302);
    okBtn.setInteractive({ useHandCursor: true });
    okBtn.on('pointerdown', () => this._submitInputModal());
    elems.push(okBtn);
    const cancelBtn = this.add.text(cx + 110, by, 'Отмена', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(302);
    cancelBtn.setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => this._closeInputModal());
    elems.push(cancelBtn);

    const modal = { elems, fields, active: 0, opts, keyHandler: null };
    modal.keyHandler = (event) => {
      const m = this._inputModal;
      if (!m || !m.fields) return;
      try {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const f = m.fields[m.active];
        if (!f) return;
        if (event.keyCode === 8) {
          f.value = f.value.slice(0, -1);
          this._refreshInputTexts();
          if (event.preventDefault) event.preventDefault();
        } else if (event.key === 'Enter') {
          this._submitInputModal();
        } else if (typeof event.key === 'string' && event.key.length === 1) {
          if (f.value.length < (f.max || 16)) {
            f.value += event.key;
            this._refreshInputTexts();
          }
        }
      } catch (e) {}
    };
    this.input.keyboard.on('keydown', modal.keyHandler);
    this._inputModal = modal;
    this._refreshInputTexts();
  }

  _refreshInputTexts() {
    const m = this._inputModal;
    if (!m || !m.fields) return;
    m.fields.forEach((f, i) => {
      if (!f.textObj) return;
      try {
        if (!f.value && f.placeholder) {
          f.textObj.setText(f.placeholder);
          f.textObj.setColor('#556677');
        } else {
          f.textObj.setText(f.value + (i === m.active ? '|' : ''));
          f.textObj.setColor('#ffffff');
        }
      } catch (e) {}
    });
  }

  _submitInputModal() {
    const m = this._inputModal;
    if (!m) return;
    const vals = {};
    (m.fields || []).forEach(f => { vals[f.id] = (f.value || '').trim().slice(0, f.max || 16); });
    if (m.opts.onOk) {
      const keep = m.opts.onOk(vals);
      if (keep !== false) this._closeInputModal();
    } else {
      this._closeInputModal();
    }
  }

  _openConfirmModal(opts) {
    if (this._inputModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const elems = [];
    const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(300);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeInputModal());
    elems.push(overlay);
    const W = 520, H = 220;
    elems.push(this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(301)
      .setStrokeStyle(2, 0xffd24a, 1));
    elems.push(this.add.text(cx, cy - 60, opts.title || '', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));
    if (opts.text) {
      elems.push(this.add.text(cx, cy - 20, opts.text, {
        fontSize: '14px', color: '#cccccc'
      }).setOrigin(0.5).setDepth(302));
    }
    const okBtn = this.add.text(cx - 110, cy + 60, opts.okLabel || 'Да', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(302);
    okBtn.setInteractive({ useHandCursor: true });
    okBtn.on('pointerdown', () => {
      this._closeInputModal();
      if (opts.onOk) opts.onOk();
    });
    elems.push(okBtn);
    const cancelBtn = this.add.text(cx + 110, cy + 60, 'Отмена', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#252560', padding: 8
    }).setOrigin(0.5).setDepth(302);
    cancelBtn.setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => this._closeInputModal());
    elems.push(cancelBtn);
    this._inputModal = { elems, fields: [], active: 0, opts, keyHandler: null };
  }

  _closeInputModal() {
    const m = this._inputModal;
    if (!m) return;
    this._inputModal = null;
    try {
      if (m.keyHandler) this.input.keyboard.off('keydown', m.keyHandler);
    } catch (e) {}
    try { (m.elems || []).forEach(o => { try { o.destroy(); } catch (e) {} }); } catch (e) {}
  }

  _toast(msg) {
    try {
      const _cx = gameW(this) / 2;
      const t = this.add.text(_cx, 680, msg, {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 8
      }).setOrigin(0.5).setDepth(310);
      this.time.delayedCall(2200, () => { try { t.destroy(); } catch (e) {} });
    } catch (e) {}
  }

  _panel(cx, top, w, h, title) {
    const g = this.add.graphics();
    g.fillStyle(0x12122e, 0.92);
    g.fillRoundedRect(cx - w / 2, top, w, h, 12);
    g.lineStyle(2, 0x3a3a6a, 1);
    g.strokeRoundedRect(cx - w / 2, top, w, h, 12);
    this.add.text(cx, top + 20, title, {
      fontSize: '18px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  update() {
    const p = this._profilePreview;
    if (p && p.active && !p.dead) {
      try {
        p.updateBars();
        if (p.updateGun) p.updateGun();
        this._liftPreview(p);
        p.healthBar.setVisible(false);
        p.armorBar.setVisible(false);
        p.nameText.setVisible(false);
      } catch (e) {}
    }
  }
}
