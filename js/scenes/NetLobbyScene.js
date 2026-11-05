import { gameState, getEquippedHead, getEquippedShoes, getEquippedTorso, getEquippedPants, getCharacterColors } from '../data/gameState.js';
import NetClient, { fetchRooms, OFFICIAL_NET_HOST, NET_SERVERS } from '../net/client.js';
import { NET_BUILD } from '../net/arena.js';
import { gameW, UX } from '../ui/layout.js';

const NET_MODES = [
  { id: 'TDM', label: 'Командный бой' },
  { id: 'FFA', label: 'Каждый за себя' },
  { id: 'CTF', label: 'Захват флага' },
  { id: 'BOMB', label: 'Бомба' },
  { id: 'KOTH', label: 'Захват точек' },
  { id: 'DUEL', label: 'Дуэль 1 на 1' }
];
const NET_MAXES = [2, 4, 6, 8];
// Классы бойцов для выбора в лобби (ХП как в игре; short — в строку ростера).
const NET_CLASSES = [
  { id: 'Assault', label: 'Штурмовик', short: 'Штурм' },
  { id: 'Tank', label: 'Танк', short: 'Танк' },
  { id: 'Medic', label: 'Медик', short: 'Медик' },
  { id: 'Sniper', label: 'Снайпер', short: 'Снайп' }
];
const HOST_KEY = 'kontakt_host';
const NET_CLASS_BASE = {
  Assault: { hp: 100, armor: 40 },
  Tank: { hp: 150, armor: 100 },
  Medic: { hp: 90, armor: 30 },
  Sniper: { hp: 80, armor: 20 }
};
// Свой билд для серверных формул (капы возрождения/китов) — как
// Player.applyPassives, только maxHp/maxArmor часть: база класса +
// скиллы/гены/сет. Сервер режет коридорами 50–250/0–150.
function netBuildMaxes(cls) {
  try {
    const base = NET_CLASS_BASE[cls] || NET_CLASS_BASE.Assault;
    let mh = base.hp, ma = base.armor;
    // Динамический импорт через require-стиль невозможен в ESM-лобби
    // без циклов, поэтому читаем сейв напрямую (ключи skills/genes),
    // а формулы повторяем по skills.js/genes.js/gearSets.js.
    return { maxHp: Math.round(mh), maxArmor: Math.round(ma), _cls: cls };
  } catch (e) {
    return { maxHp: 100, maxArmor: 40 };
  }
}
async function netBuildMaxesFull(cls) {
  try {
    const base = NET_CLASS_BASE[cls] || NET_CLASS_BASE.Assault;
    let mh = base.hp, ma = base.armor;
    const [{ totalSkillMods }, { mergeGeneMods }, { gearSetBonus }] = await Promise.all([
      import('../data/skills.js'),
      import('../data/genes.js'),
      import('../data/gearSets.js')
    ]);
    let m = {};
    try { m = totalSkillMods() || {}; } catch (e) { m = {}; }
    try { m = mergeGeneMods(m) || m; } catch (e) {}
    if (m.maxHp) mh += m.maxHp;
    if (m.maxArmor) ma += m.maxArmor;
    try {
      const gb = (typeof gearSetBonus === 'function') ? gearSetBonus() : {};
      if (gb && gb.maxHpPct) mh = Math.round(mh * (1 + gb.maxHpPct / 100));
      if (gb && gb.maxArmor) ma += gb.maxArmor;
    } catch (e) {}
    return { maxHp: Math.round(mh), maxArmor: Math.round(ma) };
  } catch (e) {
    const base = NET_CLASS_BASE[cls] || NET_CLASS_BASE.Assault;
    return { maxHp: base.hp, maxArmor: base.armor };
  }
}

// Сетевое лобби: один сервер — одна комната, всё на одном экране.
// Слева игроки, справа настройки матча (режим и места меняет хост).
// Вход — из «ВЫБРАТЬ МАТЧ» в меню.
export default class NetLobbyScene extends Phaser.Scene {
  constructor() {
    super('NetLobbyScene');
  }

  create(data) {
    this.cameras.main.setBackgroundColor('#0a0a2a');
    // В лобби — менюшная музыка (из боя вернулись без неё: матч её глушил).
    // Не дёргаем трек, если уже играет.
    try {
      const musPlaying = () => {
        try {
          return this.sound.sounds.some(s => s.key === 'mus_menu' && s.isPlaying);
        } catch (e) { return false; }
      };
      if (this.sound && !musPlaying()) {
        try { this.sound.stopAll(); } catch (e) {}
        if (this.cache.audio.exists('mus_menu') && !this.sound.locked) {
          this.sound.play('mus_menu', { loop: true, volume: 0.32 });
        }
      }
    } catch (e) { /* без звука игра не встанет */ }
    // Возврат из матча: клиент уже есть и подключён — не рвём его.
    this._ownsNet = !(data && data.net && data.net.connected);
    this.net = this._ownsNet ? new NetClient() : data.net;
    this.status = '';
    this._box = this.add.container(0, 0);
    this._toastObj = null;
    this._rooms = null;
    this._roomsLoading = false;
    this._roomsStamp = 0;
    this._roomsError = null;
    this._serverPing = null;
    this._serverPingHost = null;
    this._serverModal = null;
    // Раскрыт ли блок «подключиться по IP» под списком (переживает rebuild).
    this._showIpBlock = !!this._showIpBlock;
    // Блок создания открыт по умолчанию (раньше всегда был виден).
    if (this._showCreateBlock == null) this._showCreateBlock = true;
    // Автообновление списка и пинга каждые 5 с (пока не в комнате).
    // Пауза, пока печатаешь в поле — иначе rebuild уронит фокус ввода.
    try { if (this._roomsTimer) this._roomsTimer.remove(); } catch (e) {}
    this._roomsTimer = this.time.addEvent({
      delay: 5000, loop: true, callback: () => {
        try {
          if (!this.scene.isActive()) return;
          if (this.net && this.net.connected) return;
          if (this._activeField) return;
          if (this._serverWaitModal) return;
          this._refreshRooms({ background: true });
        } catch (e) {}
      }
    });
    // Текстовые поля без DOM: значения живут в _netVals и переживают rebuild.
    this._netVals = {};
    this._netFields = [];
    this._activeField = null;
    this._netKey = (event) => {
      const f = (this._netFields || []).find(x => x.id === this._activeField);
      if (!f) return;
      try {
        const mod = event.ctrlKey || event.metaKey;
        const key = typeof event.key === 'string' ? event.key : '';
        // Вставка из буфера (Ctrl+V): адрес хоста неудобно набирать руками.
        if (mod && (key === 'v' || key === 'V' || event.keyCode === 86)) {
          if (event.preventDefault) event.preventDefault();
          this._pasteIntoField(f);
          return;
        }
        // Вырезать (Ctrl+X) и очистка поля (Ctrl+Backspace).
        if (mod && (key === 'x' || key === 'X' || event.keyCode === 88)) {
          if (event.preventDefault) event.preventDefault();
          try {
            if (f.value && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(f.value).catch(() => {});
            }
          } catch (e) {}
          f.value = '';
          this._syncNetField(f);
          return;
        }
        if (mod && event.keyCode === 8) {
          if (event.preventDefault) event.preventDefault();
          f.value = '';
          this._syncNetField(f);
          return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.keyCode === 8) {
          f.value = f.value.slice(0, -1);
          this._syncNetField(f);
          if (event.preventDefault) event.preventDefault();
        } else if (event.key === 'Enter') {
          this._fieldEnter(f.id);
        } else if (typeof event.key === 'string' && event.key.length === 1) {
          if (f.value.length < f.maxLen) {
            f.value += event.key;
            this._syncNetField(f);
          }
        }
      } catch (e) {}
    };
    this.input.keyboard.on('keydown', this._netKey);

    this.net.onroominfo = () => this.rebuild();
    this.net.onplayers = () => this.rebuild();
    this.net.onstarted = (m) => {
      try {
        // Клиент уезжает в матч вместе со сценой — shutdown лобби
        // его закрывать не должен (иначе оба вылетают на старте).
        this._ownsNet = false;
        this.scene.start('NetGameScene', {
          net: this.net,
          room: (m && m.room) || 'main',
          mode: (m && m.mode) || this.net.roomMode,
          players: (m && m.players) || this.net.players,
          myId: this.net.myId,
          youTeam: (m && m.youTeam) || null,
          endsAt: (m && m.endsAt) || 0,
          obj: (m && m.obj) || null
        });
      } catch (e) {
        this._toast('Не стартовал матч');
      }
    };
    this.net.onerror = (msg) => {
      // Старый сервер (без перезапуска start-host.cmd) не знает cls/kick
      // и отвечает unknown message — переводим человеческим языком.
      try {
        if (typeof msg === 'string' && msg.indexOf('unknown message:') === 0) {
          this._toast('Сервер старый: закрой его окно и запусти start-host.cmd заново');
          return;
        }
      } catch (e) {}
      this._toast(msg);
    };
    this.net.onkicked = () => {
      if (this.scene.isActive()) {
        this.status = 'Хост выгнал тебя из комнаты';
        this.rebuild();
      }
    };
    this.net.onclose = () => {
      if (this.scene.isActive()) {
        this.status = this.net.wasKicked ? 'Хост выгнал тебя из комнаты' : 'Соединение закрыто';
        this.rebuild();
      }
    };

    this.input.keyboard.on('keydown-ESC', () => {
      try { this.net.close(); } catch (e) {}
      this.scene.start('MenuScene');
    });
    this.events.once('shutdown', () => {
      try { if (this._wakeGear) this.events.off('wake', this._wakeGear); } catch (e) {}
      this._wakeGear = null;
      try {
        if (this._pageHide && typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('pagehide', this._pageHide);
        }
      } catch (e) {}
      this._pageHide = null;
      // Клиент, переданный в матч, не закрываем — он чужой.
      if (this._ownsNet) {
        try { this.net.close(); } catch (e) {}
      }
      try {
        if (this._netKey) this.input.keyboard.off('keydown', this._netKey);
      } catch (e) {}
      this._netKey = null;
      try {
        if (this._roomsTimer) this._roomsTimer.remove();
      } catch (e) {}
      this._roomsTimer = null;
      this._closeServerModal();
      this._closeServerWaitModal();
    });

    // Вернулись из инвентаря/магазина (сцена спит, а не умирает) —
    // гардероб мог смениться: досылаем свежую внешность.
    try {
      if (this._wakeGear) this.events.off('wake', this._wakeGear);
    } catch (e) {}
    this._wakeGear = () => { try { this._sendFreshGear(); } catch (e) {} };
    try { this.events.on('wake', this._wakeGear); } catch (e) {}
    // Уход со страницы (крестик/обновление) — честно рвём сокет, чтобы
    // на сервере не висел призрак с нашим ником до heartbeat.
    try {
      if (this._pageHide && typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('pagehide', this._pageHide);
      }
    } catch (e) {}
    this._pageHide = () => { try { if (this.net) this.net.close(); } catch (e) {} };
    try {
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', this._pageHide);
      }
    } catch (e) {}
    // Возврат из матча с живым клиентом: hello ушёл давно,
    // шмот с тех пор мог смениться — освежить один раз.
    try {
      if (this.net && this.net.connected) this._sendFreshGear();
    } catch (e) {}

    this.rebuild();
  }

  _clearBox() {
    try { this._box.removeAll(true); } catch (e) {}
    this._netFields = [];
  }

  rebuild() {
    this._clearBox();
    const cx = gameW(this) / 2;
    this._box.add(this.add.text(cx, 30, 'СЕТЕВАЯ ИГРА (LAN)', {
      fontSize: '32px', color: '#ffffff'
    }).setOrigin(0.5));
    // Метка сборки онлайна — по ней видно, свежая ли загрузилась.
    try {
      this._box.add(this.add.text(cx, 58, 'сборка NET v' + NET_BUILD, {
        fontSize: '12px', color: '#667788'
      }).setOrigin(0.5));
    } catch (e) {}
    const back = this.add.text(UX(this, 70), 28, '← Назад', {
      fontSize: '18px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      try { this.net.close(); } catch (e) {}
      this.scene.start('MenuScene');
    });
    this._box.add(back);
    // Угол — кнопка текущего сервера (имя + стрелка): открывает список
    // серверов с живым пингом каждого. Пинг/адрес текстом убраны — они внутри.
    try {
      const cur = this._currentServer();
      const nm = String((cur && cur.name) || 'СЕРВЕР').slice(0, 18);
      const sb = this.add.text(UX(this, 1190), 28, `${nm} ▾`, {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 8
      }).setOrigin(0.5);
      this._box.add(sb);
      sb.setInteractive({ useHandCursor: true });
      sb.on('pointerdown', () => this._openServerModal());
      sb.on('pointerover', () => sb.setStyle({ color: '#ffff55' }));
      sb.on('pointerout', () => sb.setStyle({ color: '#ffffff' }));
    } catch (e) {}
    if (this.net.connected) this._drawRoom();
    else this._drawRoomList(cx);
  }

  // Хост для списка комнат: поле IP > официальный сервер (Render,
  // когда игра в ВК/ОК, а сервер отдельно) > авто-адрес (LAN/Render same-origin).
  _listHost() {
    try {
      const v = (this._netVals && this._netVals.netHost) || '';
      if (v && v.trim()) return v.trim();
    } catch (e) {}
    try {
      if (OFFICIAL_NET_HOST && String(OFFICIAL_NET_HOST).trim()) return String(OFFICIAL_NET_HOST).trim();
    } catch (e) {}
    try {
      const h = window.location.hostname;
      const secure = window.location.protocol === 'https:';
      if (h && h !== '') return ((secure || /\.onrender\.com$/i.test(h)) ? h : h + ':8081');
    } catch (e) {}
    return '127.0.0.1:8081';
  }

  _closeServerWaitModal() {
    try {
      if (this._waitPromptTimer) { this._waitPromptTimer.remove(); this._waitPromptTimer = null; }
    } catch (e) {}
    if (this._serverWaitModal) {
      try {
        if (this._serverWaitModal.timerEvent) this._serverWaitModal.timerEvent.remove();
        if (this._serverWaitModal.probeEvent) this._serverWaitModal.probeEvent.remove();
        (this._serverWaitModal.elems || []).forEach(e => { try { e.destroy(); } catch (err) {} });
      } catch (e) {}
      this._serverWaitModal = null;
    }
  }

  _showServerWaitModal(host) {
    if (this._serverWaitModal) return;
    const cx = gameW(this) / 2, cy = 360;
    const W = 560, H = 360;
    const elems = [];
    const put = (o) => { elems.push(o); return o; };

    const overlay = put(this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.85).setDepth(500).setInteractive());
    const bg = put(this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(501).setStrokeStyle(2, 0xffd24a, 1));

    put(this.add.text(cx, cy - 130, 'ПОДКЛЮЧЕНИЕ К СЕРВЕРУ...', {
      fontSize: '22px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(502));

    const statusT = put(this.add.text(cx, cy - 90, `Сервер: ${String(host).slice(0, 36)}`, {
      fontSize: '15px', color: '#99aacc'
    }).setOrigin(0.5).setDepth(502));

    let countdown = 60;
    const timerT = put(this.add.text(cx, cy - 25, '60', {
      fontSize: '52px', color: '#ffd700', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(502));

    const subT = put(this.add.text(cx, cy + 40, 'Бесплатный сервер на Render просыпается (обычно 20–50 сек).\nПожалуйста, подождите или вернитесь назад.', {
      fontSize: '13px', color: '#ccd6ee', align: 'center', lineSpacing: 4
    }).setOrigin(0.5).setDepth(502));

    const backBtn = put(this.add.text(cx, cy + 120, '← НАЗАД В ГЛАВНОЕ МЕНЮ', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#6a2a2a', padding: { left: 26, right: 26, top: 10, bottom: 10 }, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(503).setInteractive({ useHandCursor: true }));

    backBtn.on('pointerover', () => backBtn.setStyle({ color: '#ffaaaa', backgroundColor: '#8a3333' }));
    backBtn.on('pointerout', () => backBtn.setStyle({ color: '#ffffff', backgroundColor: '#6a2a2a' }));
    backBtn.on('pointerdown', () => {
      this._closeServerWaitModal();
      try { if (this.net) this.net.close(); } catch (e) {}
      this.scene.start('MenuScene');
    });

    const timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: 60,
      callback: () => {
        countdown--;
        if (!timerT.active) return;
        timerT.setText(String(Math.max(0, countdown)));
        if (countdown <= 0) {
          if (this._serverWaitModal && this._serverWaitModal.probeEvent) {
            this._serverWaitModal.probeEvent.remove();
          }
          statusT.setText('Сервер не ответил');
          timerT.setText('ТАЙМАУТ');
          timerT.setFontSize(30);
          timerT.setColor('#ff6666');
          subT.setText('Сервер сейчас недоступен или ещё не проснулся.\nВы можете повторить попытку или вернуться в меню.');

          const retryBtn = put(this.add.text(cx - 130, cy + 120, 'ПОВТОРИТЬ', {
            fontSize: '15px', color: '#ffffff', backgroundColor: '#2a5a2a', padding: { left: 20, right: 20, top: 10, bottom: 10 }, fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(503).setInteractive({ useHandCursor: true }));

          retryBtn.on('pointerdown', () => {
            this._closeServerWaitModal();
            this._refreshRooms();
          });

          backBtn.setPosition(cx + 120, cy + 120);
          backBtn.setText('← В МЕНЮ');
        }
      }
    });

    // Живой опрос сервера в фоне во время бодрствования модалки:
    const probeEvent = this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => {
        if (!this._serverWaitModal || !this.scene.isActive()) return;
        fetchRooms(host).then((arr) => {
          if (Array.isArray(arr) && this._serverWaitModal) {
            this._closeServerWaitModal();
            this._rooms = arr;
            this._roomsLoading = false;
            this._roomsStamp = Date.now();
            this._roomsError = null;
            this._serverPing = 120;
            this._serverPingHost = host;
            if (!this.net.connected && this.scene.isActive()) this.rebuild();
          }
        }).catch(() => {});
      }
    });

    this._serverWaitModal = { elems, timerEvent, probeEvent };
  }

  _refreshRooms(opts = {}) {
    if (this.net && this.net.connected) return;
    if (this._roomsLoading) return;
    const isBg = !!(opts && opts.background);
    this._roomsLoading = true;
    const host = this._listHost();
    const t0 = Date.now();

    try { if (this._waitPromptTimer) this._waitPromptTimer.remove(); } catch (e) {}
    if (!isBg && !this._serverWaitModal) {
      this._waitPromptTimer = this.time.delayedCall(700, () => {
        if (this._roomsLoading && this.scene.isActive() && !this._serverWaitModal) {
          this._showServerWaitModal(host);
        }
      });
    }

    fetchRooms(host).then((arr) => {
      if (Array.isArray(arr)) {
        this._closeServerWaitModal();
        if (!this.scene.isActive()) return;
        this._rooms = arr;
        this._roomsLoading = false;
        this._roomsStamp = Date.now();
        this._roomsError = null;
        this._serverPing = Date.now() - t0;
        this._serverPingHost = host;
        if (!this.net.connected && this.scene.isActive()) this.rebuild();
        else this._roomsLoading = false;
        return;
      }
      // Не комната или ответ пустой: если модалка висит, НЕ закрываем её — опрос продолжается таймером.
      if (!this._serverWaitModal) {
        this._rooms = [];
        this._roomsLoading = false;
        this._roomsStamp = Date.now();
        this._roomsError = host;
        this._serverPing = -1;
        this._serverPingHost = host;
        if (!this.net.connected && this.scene.isActive()) this.rebuild();
      }
    }).catch(() => {
      // Ошибка подключения: если модалка висит, она не должна захлопываться.
      if (!this._serverWaitModal) {
        if (!this.scene.isActive()) return;
        this._rooms = [];
        this._roomsLoading = false;
        this._roomsStamp = Date.now();
        this._roomsError = host;
        this._serverPing = -1;
        this._serverPingHost = host;
        if (!this.net.connected && this.scene.isActive()) this.rebuild();
      }
    });
  }

  // Пресеты серверов (имя → адрес): NET_SERVERS + официальный.
  // «СВОЙ» сюда не входит — он собирается из поля IP при открытии списка.
  _serverPresets() {
    const out = [];
    try {
      (NET_SERVERS || []).forEach((s) => {
        const host = String((s && s.host) || '').trim();
        if (!host || out.some(x => x.host === host)) return;
        const name = String((s && s.name) || '').trim() || `СЕРВЕР ${out.length + 1}`;
        out.push({ name, host });
      });
    } catch (e) {}
    try {
      const off = String(OFFICIAL_NET_HOST || '').trim();
      if (off && !out.some(x => x.host === off)) out.push({ name: 'Официальный', host: off });
    } catch (e) {}
    return out;
  }

  // Текущий сервер: что реально используется (поле IP → пресет/СВОЙ,
  // пусто → авто как в _listHost, с именем пресета если совпал).
  _currentServer() {
    let cur = '';
    try { cur = String((this._netVals && this._netVals.netHost) || '').trim(); } catch (e) {}
    const presets = this._serverPresets();
    if (!cur) {
      const auto = this._listHost();
      const hit = presets.find(p => p.host === auto);
      if (hit) return hit;
      return { name: 'АВТО', host: auto, auto: true };
    }
    const hit = presets.find(p => p.host === cur);
    if (hit) return hit;
    return { name: 'СВОЙ', host: cur };
  }

  _closeServerModal() {
    (this._serverModal || []).forEach(o => { try { o.destroy(); } catch (e) {} });
    this._serverModal = null;
  }

  // Выбор сервера из списка: адрес в поле IP, список комнат — с него.
  _selectServer(host) {
    try {
      this._netVals = this._netVals || {};
      this._netVals.netHost = String(host || '').trim();
      try { localStorage.setItem(HOST_KEY, this._netVals.netHost); } catch (e) {}
    } catch (e) {}
    this._rooms = null;
    this._roomsStamp = 0;
    this._roomsError = null;
    this.status = '';
    this._closeServerModal();
    this.rebuild();
  }

  // Выпадающий список серверов: имя + адрес + живой пинг каждого.
  // Живёт вне _box (перестройки списка его не убивают), повторный клик закрывает.
  _openServerModal() {
    if (this._serverModal) { this._closeServerModal(); return; }
    const presets = this._serverPresets();
    let custom = null;
    try {
      const cur = String((this._netVals && this._netVals.netHost) || '').trim();
      if (cur && !presets.some(p => p.host === cur)) custom = { name: 'СВОЙ (из поля IP)', host: cur };
    } catch (e) {}
    const list = custom ? [...presets, custom] : presets.slice();
    if (!list.length) list.push({ name: 'АВТО', host: this._listHost(), auto: true });
    const cx = gameW(this) / 2, cy = 360;
    const rowH = 52;
    const H = Math.min(560, 116 + list.length * rowH + 56);
    const W = 620;
    const elems = [];
    const put = (o) => { elems.push(o); return o; };
    const overlay = put(this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(300));
    overlay.setInteractive();
    overlay.on('pointerdown', () => this._closeServerModal());
    const bg = put(this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(301));
    bg.setStrokeStyle(2, 0xffd24a, 1);
    put(this.add.text(cx, cy - H / 2 + 26, 'СЕРВЕР', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(302));
    let curHost = '';
    try { curHost = this._currentServer().host; } catch (e) {}
    let ry = cy - H / 2 + 62;
    const maxRows = Math.max(0, Math.floor((cy + H / 2 - 60 - ry) / rowH));
    list.slice(0, Math.max(1, maxRows)).forEach((s) => {
      const sel = s.host === curHost;
      const bgR = put(this.add.rectangle(cx, ry + rowH / 2 - 4, W - 40, rowH - 10, sel ? 0x2a2a55 : 0x1a1a34, 1).setDepth(301));
      put(this.add.text(cx - W / 2 + 30, ry + 12, String(s.name).slice(0, 20), {
        fontSize: '15px', color: sel ? '#ffff55' : '#ffffff', fontStyle: 'bold'
      }).setOrigin(0, 0.5).setDepth(302));
      put(this.add.text(cx - W / 2 + 30, ry + 32, String(s.host).slice(0, 38), {
        fontSize: '12px', color: '#667788'
      }).setOrigin(0, 0.5).setDepth(302));
      const pingT = put(this.add.text(cx + W / 2 - 30, ry + rowH / 2 - 4, '...', {
        fontSize: '13px', color: '#667788'
      }).setOrigin(1, 0.5).setDepth(302));
      bgR.setInteractive({ useHandCursor: true });
      bgR.on('pointerover', () => bgR.setFillStyle(0x2e2e5a, 1));
      bgR.on('pointerout', () => bgR.setFillStyle(sel ? 0x2a2a55 : 0x1a1a34, 1));
      bgR.on('pointerdown', () => this._selectServer(s.host));
      // Пинг каждого — замером /rooms, ответ приходит асинхронно в свою строку.
      try {
        const t0 = Date.now();
        fetchRooms(s.host).then((arr) => {
          try {
            if (!this._serverModal || !pingT.active) return;
            if (Array.isArray(arr)) {
              pingT.setText(`${Date.now() - t0} мс`);
              pingT.setColor('#88dd88');
            } else {
              pingT.setText('нет связи');
              pingT.setColor('#ff8888');
            }
          } catch (e) {}
        }).catch(() => {
          try {
            if (this._serverModal && pingT.active) {
              pingT.setText('нет связи');
              pingT.setColor('#ff8888');
            }
          } catch (e) {}
        });
      } catch (e) {}
      ry += rowH;
    });
    const closeBtn = put(this.add.text(cx, cy + H / 2 - 28, 'ЗАКРЫТЬ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setDepth(302));
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeServerModal());
    this._serverModal = elems;
  }

  // Экран «ВЫБРАТЬ МАТЧ»: список комнат сервера + создать + IP внизу.
  // Строгая сетка: все подписи правым краем на x=460, все поля центром
  // на x=660 — ничего не гуляет. Список компактный (1 строка/комната).
  _drawRoomList(cx) {
    const LABEL_X = UX(this, 460);   // правый край подписей (origin 1,0.5)
    const FIELD_X = UX(this, 660);   // центр полей ввода
    if (!Array.isArray(this._rooms) && !this._roomsLoading) this._refreshRooms();
    else if (!this._roomsLoading && (this._roomsStamp || 0) + 5000 < Date.now()) this._refreshRooms({ background: true });
    this._box.add(this.add.text(cx, 84, 'ВЫБРАТЬ МАТЧ — комнаты сервера', {
      fontSize: '17px', color: '#99aacc'
    }).setOrigin(0.5));
    // Имя берётся из настроек игры (gameState.playerName) — поля тут нет.
    // Список комнат: панель + компактные строки (всё в одну линию).
    // Служебная main в списке не показывается (вход туда — только по IP,
    // серверу и протоколу это не мешает: main живёт как раньше).
    const rooms = (Array.isArray(this._rooms) ? this._rooms : [])
      .filter(r => r && r.name !== 'main');
    // Три кнопки над панелью: обновить / создать / по IP.
    // Каждая средняя/правая — раскрывашка своего блока под списком.
    this._btn(cx - 270, 116, 'ОБНОВИТЬ', () => {
      this._roomsStamp = 0;
      this._rooms = null;
      this.status = '';
      this.rebuild();
    }, { fontSize: 14 });
    this._btn(cx, 116, `СОЗДАТЬ КОМНАТУ ${this._showCreateBlock ? '▾' : '▸'}`, () => {
      this._showCreateBlock = !this._showCreateBlock;
      this.rebuild();
    }, { fontSize: 14, bg: '#2a5a2a' });
    this._btn(cx + 270, 116, `ПОДКЛЮЧИТЬСЯ ПО IP ${this._showIpBlock ? '▾' : '▸'}`, () => {
      this._showIpBlock = !this._showIpBlock;
      this.rebuild();
    }, { fontSize: 14, bg: '#5a4a1a' });
    // Панель фиксированная и высокая (6 строк), чуть опущена.
    const LIST_Y = 150, ROW_H = 44, MAX_ROWS = 6;
    const listH = 34 + MAX_ROWS * ROW_H + 10;
    this._panel(cx, LIST_Y, 780, listH, '');
    let ry = LIST_Y + 34;
    const rows = rooms.slice(0, MAX_ROWS);
    if (this._roomsLoading && !rooms.length) {
      this._box.add(this.add.text(cx, ry + ROW_H / 2 - 8, 'Ищу комнаты...', {
        fontSize: '15px', color: '#556677'
      }).setOrigin(0.5));
      ry += ROW_H;
    } else if (!rooms.length && this._roomsError) {
      this._box.add(this.add.text(cx, ry + 12, `Нет связи с сервером: ${String(this._roomsError).slice(0, 32)}`, {
        fontSize: '15px', color: '#ff8888', fontStyle: 'bold'
      }).setOrigin(0.5));
      this._box.add(this.add.text(cx, ry + 32, 'Запусти сервер, нажми «ПОДКЛЮЧИТЬСЯ ПО IP» и проверь адрес.', {
        fontSize: '13px', color: '#99aacc'
      }).setOrigin(0.5));
      ry += ROW_H;
    } else if (!rooms.length) {
      this._box.add(this.add.text(cx, ry + ROW_H / 2 - 8, 'Комнат нет — жми «СОЗДАТЬ КОМНАТУ» и создай первую.', {
        fontSize: '15px', color: '#556677'
      }).setOrigin(0.5));
      ry += ROW_H;
    }
    rows.forEach((r) => {
      const nm = String((r && r.name) || '?').slice(0, 24);
      const mode = this._modeLabel(r && r.mode);
      const st = (r && r.started) ? 'ИДЁТ' : 'лобби';
      const stCol = (r && r.started) ? '#ffd24a' : '#88dd88';
      const host = r && r.host ? ` · ${String(r.host).slice(0, 14)}` : '';
      // Фон строки — ПЕРВЫМ, затем текст и кнопка (иначе перекрытия).
      this._box.add(this.add.rectangle(cx, ry + ROW_H / 2 - 4, 740, ROW_H - 8, 0x14142b, 0.85));
      this._box.add(this.add.text(cx - 350, ry + ROW_H / 2 - 4, `${nm} · ${mode} · ${(r && r.count) | 0}/${(r && (r.max || r.maxPlayers)) | 0 || 8}`, {
        fontSize: '15px', color: '#ffffff'
      }).setOrigin(0, 0.5));
      this._box.add(this.add.text(cx - 350, ry + ROW_H - 12, `${st}${host}`, {
        fontSize: '12px', color: stCol
      }).setOrigin(0, 0.5));
      const jb = this.add.text(cx + 300, ry + ROW_H / 2 - 4, (r && r.started) ? 'ИДЁТ' : 'ВОЙТИ', {
        fontSize: '14px', color: (r && r.started) ? '#667788' : '#ffffff',
        backgroundColor: (r && r.started) ? '#22223a' : '#2a5a2a', padding: 7
      }).setOrigin(0.5);
      this._box.add(jb);
      if (!(r && r.started)) {
        jb.setInteractive({ useHandCursor: true });
        jb.on('pointerdown', () => this._joinRoom(nm));
        jb.on('pointerover', () => jb.setStyle({ color: '#ffff55' }));
        jb.on('pointerout', () => jb.setStyle({ color: '#ffffff' }));
      }
      ry += ROW_H;
    });
    if (rooms.length > MAX_ROWS) {
      this._box.add(this.add.text(cx, ry + 8, `…и ещё ${rooms.length - MAX_ROWS}`, {
        fontSize: '13px', color: '#667788'
      }).setOrigin(0.5));
      ry += 24;
    }
    ry += 28;
    // Блок создания (кнопка «СОЗДАТЬ КОМНАТУ» над панелью).
    if (this._showCreateBlock) {
      // Создать свою комнату: подпись + поле + кнопка на одной линии.
      this._box.add(this.add.text(LABEL_X, ry, 'Комната:', {
        fontSize: '16px', color: '#ffffff'
      }).setOrigin(1, 0.5));
      this._netField(620, ry, 'roomName', '', 24, 240, 'Название комнаты');
      this._btn(880, ry, 'СОЗДАТЬ', () => this._createRoom(), { fontSize: 15, bg: '#2a5a2a' });
      ry += 48;
    }
    // Блок прямого адреса (кнопка «ПОДКЛЮЧИТЬСЯ ПО IP» над панелью).
    if (this._showIpBlock) {
      this._box.add(this.add.text(LABEL_X, ry, 'Адрес хоста:', {
        fontSize: '16px', color: '#ffffff'
      }).setOrigin(1, 0.5));
      let defHost = '';
      try { defHost = localStorage.getItem(HOST_KEY) || ''; } catch (e) {}
      if (!defHost) defHost = this._listHost();
      this._netField(FIELD_X, ry, 'netHost', defHost, 64, 320, '192.168.1.5:8081');
      ry += 50;
      this._btn(cx, ry, 'ПОДКЛЮЧИТЬСЯ', () => this._doConnect(), { fontSize: 18, bg: '#2a5a2a' });
      ry += 42;
    }
    if (this.status) {
      this._box.add(this.add.text(cx, ry, this.status, {
        fontSize: '15px', color: '#ff8888'
      }).setOrigin(0.5));
      ry += 26;
    }
    this._box.add(this.add.text(cx, 700, 'Комнату создал — ты хост 👑: режим и старт ставишь внутри.', {
      fontSize: '13px', color: '#556677', align: 'center'
    }).setOrigin(0.5));
  }

  _joinRoom(roomName) {
    const rn = String(roomName || '').trim().slice(0, 24);
    if (!rn) {
      this.status = 'Нет имени комнаты';
      this.rebuild();
      return;
    }
    // Ник — из настроек игры, адрес — из поля IP (LAN) или авто.
    this._doConnect(rn);
  }

  _createRoom() {
    let rn = '';
    try { rn = String((this._netVals && this._netVals.roomName) || '').trim().slice(0, 24); } catch (e) {}
    rn = rn.replace(/[^A-Za-zА-Яа-яЁё0-9 _\-]/g, '').trim().slice(0, 24);
    if (!rn) {
      this.status = 'Введи название комнаты';
      this.rebuild();
      return;
    }
    this._doConnect(rn);
  }

  _btn(x, y, label, cb, opts = {}) {
    const b = this.add.text(x, y, label, {
      fontSize: (opts.fontSize || 16) + 'px',
      color: opts.disabled ? '#667788' : (opts.color || '#ffffff'),
      backgroundColor: opts.disabled ? '#22223a' : (opts.bg || '#252560'),
      padding: 8
    }).setOrigin(0.5);
    this._box.add(b);
    if (!opts.disabled) {
      b.setInteractive({ useHandCursor: true });
      b.on('pointerdown', cb);
      b.on('pointerover', () => b.setStyle({ color: '#ffff55' }));
      b.on('pointerout', () => b.setStyle({ color: opts.disabled ? '#667788' : (opts.color || '#ffffff') }));
    }
    return b;
  }

  // Текстовое поле без DOM: клик — фокус, печать — с клавиатуры,
  // Enter — подтвердить. Значение живёт в _netVals и переживает rebuild.
  _netField(x, y, id, defVal, maxLen, width, placeholder) {
    let initial = defVal;
    try {
      if (this._netVals && this._netVals[id] != null) initial = this._netVals[id];
    } catch (e) {}
    const W = width || 320;
    const box = this.add.rectangle(x, y, W, 44, 0x0a0a2a, 1).setStrokeStyle(2, 0x3a3a6a, 1);
    this._box.add(box);
    const t = this.add.text(x - W / 2 + 12, y, '', {
      fontSize: '18px', color: '#ffffff'
    }).setOrigin(0, 0.5);
    this._box.add(t);
    const f = {
      id, value: String(initial || ''), maxLen: maxLen || 24,
      textObj: t, box, placeholder: placeholder || ''
    };
    (this._netFields = this._netFields || []).push(f);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => {
      this._activeField = id;
      (this._netFields || []).forEach(x => this._syncNetField(x));
    });
    this._syncNetField(f);
    return f;
  }

  _syncNetField(f) {
    try {
      this._netVals[f.id] = f.value;
      const active = this._activeField === f.id;
      if (f.value) {
        f.textObj.setText(f.value + (active ? '|' : ''));
        f.textObj.setColor('#ffffff');
      } else {
        f.textObj.setText(f.placeholder || '');
        f.textObj.setColor('#556677');
      }
      f.box.setStrokeStyle(2, active ? 0xffd24a : 0x3a3a6a, 1);
    } catch (e) {}
  }

  _fieldEnter(id) {
    if (id === 'netHost') this._doConnect();
    else if (id === 'roomName') this._createRoom();
  }

  // Вставка из буфера обмена в активное поле (Ctrl+V).
  // Управляющие символы режем, пробелы по краям тоже, длина — по полю.
  _pasteIntoField(f) {
    try {
      if (!f) return;
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        this._toast('Вставка недоступна — введи вручную');
        return;
      }
      navigator.clipboard.readText().then((text) => {
        try {
          const clean = String(text || '').replace(/[\r\n\t]+/g, ' ').trim();
          if (!clean) return;
          f.value = (f.value + clean).slice(0, f.maxLen);
          this._syncNetField(f);
        } catch (e) {}
      }).catch(() => {
        try { this._toast('Буфер закрыт браузером — введи вручную'); } catch (e) {}
      });
    } catch (e) {}
  }

  _panel(cx, top, w, h, title) {
    const g = this.add.graphics();
    g.fillStyle(0x12122e, 0.92);
    g.fillRoundedRect(cx - w / 2, top, w, h, 12);
    g.lineStyle(2, 0x3a3a6a, 1);
    g.strokeRoundedRect(cx - w / 2, top, w, h, 12);
    this._box.add(g);
    this._box.add(this.add.text(cx, top + 20, title, {
      fontSize: '18px', color: '#8fb8ff', fontStyle: 'bold'
    }).setOrigin(0.5));
  }

  // Создание комнаты: имя из поля — сервер создаёт её, ты заходишь хостом 👑.
  // Отдельного экрана «я хост» больше нет (был дублем этой кнопки).

  _doConnect(roomName) {
    let name = '', host = '';
    try {
      const vals = this._netVals || {};
      name = (vals.netName || gameState.playerName || 'Игрок').trim().slice(0, 16) || 'Игрок';
      host = (vals.netHost || '').trim();
      // Пустое поле IP на экране списка — считаем авто-адресом (список оттуда же).
      if (!host) host = this._listHost();
    } catch (e) {}
    const rn = String(roomName || '').trim().slice(0, 24);
    if (!host) {
      this.status = 'Введи адрес хоста';
      this.rebuild();
      return;
    }
    try {
      localStorage.setItem(HOST_KEY, host);
    } catch (e) {}
    this.status = 'Подключаемся...';
    this.rebuild();
    let cls = 'Assault';
    try {
      const lc = gameState.lastClass;
      if (lc === 'Assault' || lc === 'Tank' || lc === 'Medic' || lc === 'Sniper') cls = lc;
    } catch (e) {}
    // Внешность для чужих экранов: надетое сейчас (убор/обувь/торс/штаны/кожа).
    let gear = null;
    try {
      const cc = getCharacterColors() || {};
      gear = {
        cap: getEquippedHead(cls), shoe: getEquippedShoes(cls),
        torso: getEquippedTorso(cls), pants: getEquippedPants(cls),
        body: cc.head
      };
    } catch (e) { gear = null; }
    this.net.connect(host, name, cls, gear, (netBuildMaxes(cls) || {}).maxHp, (netBuildMaxes(cls) || {}).maxArmor, rn || undefined).then(() => {
      this.status = '';
      this.rebuild();
      // Точные капы билда (скиллы/гены/сет) — досылаем классом следом:
      // hello уже ушёл с базой, cls обновит _helloMax* до старта.
      try {
        netBuildMaxesFull(cls).then(bm => {
          try { this.net.sendCls(cls, gear, bm.maxHp, bm.maxArmor); } catch (e) {}
        });
      } catch (e) {}
    }).catch((e) => {
      const msg = (e && e.message) || 'Не подключилось';
      // Ник занят живым соседом (два «Коляна» зашли одновременно) —
      // автоподбор суффикса: Колян → Колян-2 → … → Колян-5. Вручную
      // переименовываться больше не надо, поле обновляем сами.
      if (/Имя занято/.test(msg)) {
        try {
          const vals = this._netVals || {};
          const cur = String(vals.netName || gameState.playerName || 'Игрок');
          const m = cur.match(/^(.*?)-(\d+)$/);
          const n = m ? (parseInt(m[2], 10) + 1) : 2;
          if (n <= 5) {
            const next = `${(m ? m[1] : cur).slice(0, 13)}-${n}`.slice(0, 16);
            vals.netName = next;
            this.status = `"${cur}" занято — пробую «${next}»…`;
            this.rebuild();
            setTimeout(() => {
              try {
                if (this.scene.isActive('NetLobbyScene')) this._doConnect();
              } catch (e2) {}
            }, 400);
            return;
          }
        } catch (e2) {}
      }
      this.status = msg;
      this.rebuild();
    });
  }

  _drawRoom() {
    const me = this.net;
    const _cx = gameW(this) / 2;
    const isHost = !!me.amHost;
    const started = !!me.roomStarted;
    // Слева — игроки, справа — настройки матча.
    this._panel(330, 100, 440, 440, 'ИГРОКИ');
    const pls = me.players || [];
    let py = 160;
    if (!pls.length) {
      this._box.add(this.add.text(UX(this, 330), 220, 'Ждём игроков...', {
        fontSize: '15px', color: '#556677'
      }).setOrigin(0.5));
    }
    // Подложка строки (зебра): два чередующихся цвета — читается и в толпе.
    // Рисуем до текста (текст поверх). Строка: x 130..530, высота 30.
    let _rowZebra = 0;
    const rowBg = (y) => {
      try {
        const c = (_rowZebra % 2 === 0) ? 0x14142b : 0x1c1c34;
        this._box.add(this.add.rectangle(UX(this, 330), y, 400, 30, c, 1));
        _rowZebra++;
      } catch (e) {}
    };
    pls.slice(0, 10).forEach(p => {
      const want = p.wantTeam === 'blue' ? ' [синие]' : p.wantTeam === 'red' ? ' [красные]' : '';
      const tag = `${p.name}${p.id === me.myId ? ' (ты)' : ''}${p.host ? ' 👑' : ''}${p.ready ? ' ✓' : ''}${p.bot ? ' [бот]' : ''}${want} · ${this._classShort(p.cls)}`;
      rowBg(py);
      this._box.add(this.add.text(UX(this, 140), py, tag, {
        fontSize: '16px',
        color: p.wantTeam === 'blue' ? '#6db4ff' : p.wantTeam === 'red' ? '#ff8888' : (p.ready ? '#88dd88' : '#ffffff')
      }).setOrigin(0, 0.5));
      // Хост выгоняет крестиком (себя и ботов — нельзя, в матче — поздно).
      if (isHost && !started && p.id !== me.myId && !p.bot) {
        const kx = this.add.text(UX(this, 520), py, '✕', {
          fontSize: '16px', color: '#ff8888', backgroundColor: '#4a1a1a', padding: 6
        }).setOrigin(0.5);
        kx.setInteractive({ useHandCursor: true });
        kx.on('pointerover', () => kx.setStyle({ color: '#ff5555' }));
        kx.on('pointerout', () => kx.setStyle({ color: '#ff8888' }));
        const kickId = p.id;
        kx.on('pointerdown', () => me.sendKick(kickId));
        this._box.add(kx);
      }
      py += 34;
    });
    // Превью ботов (до старта, не дуэль): какие боты добьются
    // на старте по галочке «Боты: ВКЛ» (та же формула, что уйдёт в startGame).
    // Флаг общий — хост переключает, всем прилетает в roominfo,
    // поэтому превью видят и гости (раньше было только у хоста).
    // Сервер ботов заранее не заводит — показываем слоты-призраки.
    // Сервер ботов заранее не заводит — показываем слоты-призраки.
    // Команды — как раздаст сервер: желающим — своё, авто — по очереди,
    // ботам — в меньшую (поровну — синим). Пишем сразу, чтоб видно состав.
    let botsGhost = 0;
    // Хост — свой тумблер (по умолчанию как на сервере), гость — флаг из roominfo.
    const botsOn = (isHost ? (this._botsOn != null ? this._botsOn : me.roomBotsOn) : me.roomBotsOn) !== false;
    try {
      const shownN = Math.min(pls.length, 10);
      if (!started && me.roomMode !== 'DUEL' && botsOn) {
        const wantBots = Math.max(0, Math.min(4, (me.roomMax | 0) - pls.length));
        botsGhost = Math.max(0, Math.min(wantBots, 10 - shownN));
        // Состав команд как на старте: желания людей, авто — через одного.
        let nB = 0, nR = 0, autoFlip = false;
        try {
          (pls || []).forEach(p => {
            if (p.wantTeam === 'blue') nB++;
            else if (p.wantTeam === 'red') nR++;
            else { if (!autoFlip) nB++; else nR++; autoFlip = !autoFlip; }
          });
        } catch (e) {}
        const CLS4 = ['Assault', 'Tank', 'Medic', 'Sniper'];
        for (let i = 0; i < botsGhost; i++) {
          const bt = nB <= nR ? 'blue' : 'red';
          if (bt === 'blue') nB++; else nR++;
          const bWant = bt === 'blue' ? ' [синие]' : ' [красные]';
          const tag = `Бот · ${this._classShort(CLS4[i % CLS4.length])} (БОТ)${bWant}`;
          rowBg(py);
          this._box.add(this.add.text(UX(this, 140), py, tag, {
            fontSize: '16px',
            color: bt === 'blue' ? '#6db4ff' : '#ff8888'
          }).setOrigin(0, 0.5));
          py += 34;
        }
      }
    } catch (e) { botsGhost = 0; }
    {
      const extraHumans = Math.max(0, pls.length - Math.min(pls.length, 10));
      const extraBots = (() => {
        try {
          if (!(!started && me.roomMode !== 'DUEL' && botsOn)) return 0;
          const wantBots = Math.max(0, Math.min(4, (me.roomMax | 0) - pls.length));
          return Math.max(0, wantBots - botsGhost);
        } catch (e) { return 0; }
      })();
      const extra = extraHumans + extraBots;
      if (extra > 0) {
        this._box.add(this.add.text(UX(this, 140), py, `…и ещё ${extra}`, {
          fontSize: '13px', color: '#667788'
        }).setOrigin(0, 0.5));
      }
    }

    this._panel(910, 100, 440, 440, 'МАТЧ');
    const isDuel = me.roomMode === 'DUEL';
    if (isHost && !started) {
      // Режим — два ряда кнопок.
      const modes1 = NET_MODES.slice(0, 3), modes2 = NET_MODES.slice(3);
      let mx = UX(this, 720);
      const pickMode = (md) => {
        if (md.id === 'DUEL') me.setup('DUEL', 2, me.roomTimeLimit);
        else me.setup(md.id, me.roomMax, me.roomTimeLimit);
      };
      modes1.forEach(md => {
        const sel = me.roomMode === md.id;
        const b = this.add.text(mx, 170, md.label, {
          fontSize: '13px', color: sel ? '#ffff55' : '#ffffff',
          backgroundColor: sel ? '#334466' : '#222244', padding: 6
        }).setOrigin(0, 0.5);
        b.setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => pickMode(md));
        this._box.add(b);
        mx += b.displayWidth + 12;
      });
      mx = 720;
      modes2.forEach(md => {
        const sel = me.roomMode === md.id;
        const b = this.add.text(mx, 205, md.label, {
          fontSize: '13px', color: sel ? '#ffff55' : '#ffffff',
          backgroundColor: sel ? '#334466' : '#222244', padding: 6
        }).setOrigin(0, 0.5);
        b.setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => pickMode(md));
        this._box.add(b);
        mx += b.displayWidth + 12;
      });
      if (isDuel) {
        this._box.add(this.add.text(UX(this, 720), 250, 'Дуэль — строго двое, без ботов.', {
          fontSize: '13px', color: '#ffd24a'
        }).setOrigin(0, 0.5));
      } else {
        this._box.add(this.add.text(UX(this, 720), 250, 'Игроков в команде:', {
          fontSize: '14px', color: '#99aacc'
        }).setOrigin(0, 0.5));
        let nx = UX(this, 905);
        NET_MAXES.forEach(n => {
          const sel = me.roomMax === n;
          const b = this.add.text(nx, 250, `${n}`, {
            fontSize: '14px', color: sel ? '#ffff55' : '#ffffff',
            backgroundColor: sel ? '#334466' : '#222244', padding: 6
          }).setOrigin(0, 0.5);
          b.setInteractive({ useHandCursor: true });
          b.on('pointerdown', () => me.setup(me.roomMode, n, me.roomTimeLimit));
          this._box.add(b);
          nx += 44;
        });
        // Длительность матча от хоста: время боя в минутах, ∞ — без лимита.
        this._box.add(this.add.text(UX(this, 720), 285, 'Время:', {
          fontSize: '14px', color: '#99aacc'
        }).setOrigin(0, 0.5));
        let tmX = UX(this, 810);
        this._timeChoices().forEach(([mins, label]) => {
          const sel = (me.roomTimeLimit | 0) === mins;
          const b = this.add.text(tmX, 285, label, {
            fontSize: '14px', color: sel ? '#ffff55' : '#ffffff',
            backgroundColor: sel ? '#334466' : '#222244', padding: 6
          }).setOrigin(0, 0.5);
          b.setInteractive({ useHandCursor: true });
          b.on('pointerdown', () => me.setup(me.roomMode, me.roomMax, mins));
          this._box.add(b);
          tmX += b.displayWidth + 35;
        });
      }
    } else {
      this._box.add(this.add.text(UX(this, 910), 200, `${this._modeLabel(me.roomMode)} · мест: ${me.roomMax} · ${this._timeLabel(me.roomTimeLimit)}`, {
        fontSize: '17px', color: '#ffffff'
      }).setOrigin(0.5));
      if (!isHost && !started) {
        this._box.add(this.add.text(UX(this, 910), 240, 'Режим, места и время ставит хост 👑', {
          fontSize: '13px', color: '#667788'
        }).setOrigin(0.5));
      }
    }
    // Боты-галочка (только хост, до старта): ВКЛ — добить состав ботами
    // до мест (максимум 4): мест 4, людей 2 = 2 бота. ВЫКЛ — только люди.
    // В дуэли ботов нет.
    if (isHost && !started && !isDuel) {
      if (this._botsOn == null) this._botsOn = me.roomBotsOn !== false;
      this._box.add(this.add.text(UX(this, 720), 320, 'Боты:', {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0, 0.5));
      const on = !!this._botsOn;
      const b = this.add.text(UX(this, 800), 320, on ? 'ВКЛ' : 'ВЫКЛ', {
        fontSize: '14px', color: on ? '#ffff55' : '#ffffff',
        backgroundColor: on ? '#334466' : '#222244', padding: 6
      }).setOrigin(0, 0.5);
      b.setInteractive({ useHandCursor: true });
      // Тумблер едет на сервер (setup botsOn) — гости увидят превью/строку.
      b.on('pointerdown', () => {
        this._botsOn = !this._botsOn;
        try { me.setup(me.roomMode, me.roomMax, me.roomTimeLimit, this._botDiff || me.roomDifficulty, this._botsOn); } catch (e) {}
        this.rebuild();
      });
      this._box.add(b);
      this._box.add(this.add.text(UX(this, 880), 320, '(добьют до мест)', {
        fontSize: '12px', color: '#556677'
      }).setOrigin(0, 0.5));
    }
    // Сложность ботов (только хост, до старта): меткость/урон/темп как
    // в одиночке (Новичок/Бывалый/Ветеран). Одна строка, без подсказок.
    // Видно всем в roominfo (гостям — строкой ниже).
    const DIFFS = [
      { id: 'novice', label: 'Новичок' },
      { id: 'experienced', label: 'Бывалый' },
      { id: 'veteran', label: 'Ветеран' }
    ];
    const diffName = (id) => (DIFFS.find(d => d.id === id) || DIFFS[1]).label;
    if (isHost && !started) {
      if (this._botDiff == null) this._botDiff = 'experienced';
      this._box.add(this.add.text(UX(this, 720), 352, 'Сложность:', {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0, 0.5));
      let dx = UX(this, 830);
      DIFFS.forEach(df => {
        const sel = (this._botDiff || me.roomDifficulty || 'experienced') === df.id;
        const b = this.add.text(dx, 352, df.label, {
          fontSize: '12px',
          color: sel ? '#ffff55' : '#ffffff',
          backgroundColor: sel ? '#334466' : '#222244', padding: 6
        }).setOrigin(0, 0.5);
        b.setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => {
          this._botDiff = df.id;
          me.setup(me.roomMode, me.roomMax, me.roomTimeLimit, df.id);
          this.rebuild();
        });
        this._box.add(b);
        dx += b.displayWidth + 12;
      });
    } else if (!started) {
      const gBotsOn = me.roomBotsOn !== false;
      this._box.add(this.add.text(UX(this, 910), 262, `Боты: ${gBotsOn ? 'ВКЛ (добьют до мест)' : 'ВЫКЛ'}`, {
        fontSize: '13px', color: gBotsOn ? '#88dd88' : '#667788'
      }).setOrigin(0.5));
      this._box.add(this.add.text(UX(this, 910), 284, `Сложность: ${diffName(me.roomDifficulty)}`, {
        fontSize: '13px', color: '#99aacc'
      }).setOrigin(0.5));
    }
    // Выбор команды перед игрой (все, кроме FFA; в дуэли — обязательно разные).
    if (!started && me.roomMode !== 'FFA') {
      const self = (me.players || []).find(p => p.id === me.myId);
      const cur = (self && self.wantTeam) || 'auto';
      this._box.add(this.add.text(UX(this, 720), 378, 'Команда:', {
        fontSize: '14px', color: '#99aacc'
      }).setOrigin(0, 0.5));
      let tx = UX(this, 810);
      [['blue', 'СИНИЕ'], ['auto', 'АВТО'], ['red', 'КРАСНЫЕ']].forEach(([id, label]) => {
        const sel = cur === id || (id === 'auto' && !cur);
        const b = this.add.text(tx, 378, label, {
          fontSize: '13px',
          color: sel ? '#ffff55' : (id === 'blue' ? '#6db4ff' : id === 'red' ? '#ff8888' : '#ffffff'),
          backgroundColor: sel ? '#334466' : '#222244', padding: 6
        }).setOrigin(0, 0.5);
        b.setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => me.sendTeam(id));
        this._box.add(b);
        tx += b.displayWidth + 35;
      });
    }
    if (started) {
      this._box.add(this.add.text(UX(this, 910), 410, 'МАТЧ ИДЁТ...', {
        fontSize: '18px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0.5));
    } else {
      this._box.add(this.add.text(UX(this, 910), 410, `${pls.filter(p => p.ready).length}/${pls.length} готовы`, {
        fontSize: '15px', color: '#99aacc'
      }).setOrigin(0.5));
    }

    // Класс бойца: каждый выбирает, за кого играть (видно всем в списке).
    if (!started) {
      const self = (me.players || []).find(p => p.id === me.myId);
      const curCls = (self && self.cls) || 'Assault';
      this._box.add(this.add.text(UX(this, 360), 561, 'Класс:', {
        fontSize: '15px', color: '#99aacc'
      }).setOrigin(0, 0.5));
      let cx2 = UX(this, 450);
      NET_CLASSES.forEach(c => {
        const sel = curCls === c.id;
        const b = this.add.text(cx2, 561, c.label, {
          fontSize: '14px', color: sel ? '#ffff55' : '#ffffff',
          backgroundColor: sel ? '#334466' : '#222244', padding: 6
        }).setOrigin(0, 0.5);
        b.setInteractive({ useHandCursor: true });
        b.on('pointerdown', () => this._pickNetClass(c.id));
        this._box.add(b);
        cx2 += b.displayWidth + 12;
      });
    }

    // Низ: готовность, старт, разрыв.
    this._btn(420, 604, me.ready ? 'НЕ ГОТОВ' : 'ГОТОВ', () => {
      // Готовность = финальный вид: досылаем свежую одежду, чтобы
      // в матч не уехал шмот с момента входа в лобби.
      try { this._sendFreshGear(); } catch (e) {}
      me.setReady(!me.ready);
    }, { bg: me.ready ? '#553333' : '#2a5a2a' });
    const readyN = pls.filter(p => p.ready).length;
    const allReady = pls.length > 0 && readyN === pls.length;
    const canStart = isHost && !started && allReady && (isDuel ? pls.length === 2 : pls.length >= 1);
    this._btn(_cx, 604, 'СТАРТ', () => {
      if (!isHost) { this._toast('Стартует хост 👑'); return; }
      if (started) return;
      if (!me.ready) { this._toast('Сначала жми «ГОТОВ»'); return; }
      if (!allReady) {
        const waiting = pls.filter(p => !p.ready).map(p => p.name).slice(0, 3).join(', ');
        this._toast(waiting ? `Ждём: ${waiting}` : 'Жди готовности всех');
        return;
      }
      if (isDuel) {
        if (pls.length === 2) me.startGame(0);
        else this._toast('Дуэль — строго двое');
      } else if (pls.length >= 1) {
        // Галочка ботов: добить людьми+ботами до мест (максимум 4 бота).
        const wantBots = this._botsOn === false
          ? 0
          : Math.max(0, Math.min(4, me.roomMax - pls.length));
        me.startGame(wantBots);
      } else {
        this._toast('Нужно хотя бы двое (или включи ботов)');
      }
    }, { bg: canStart ? '#5a4a1a' : '#22223a', disabled: !canStart });
    this._btn(860, 604, 'ОТКЛЮЧИТЬСЯ', () => {
      try { me.close(); } catch (e) {}
      this.rebuild();
    }, { bg: '#553333', fontSize: 14 });
    if (this.status) {
      this._box.add(this.add.text(_cx, 650, this.status, {
        fontSize: '14px', color: '#ff8888'
      }).setOrigin(0.5));
    }
  }

  _modeLabel(id) {
    const f = NET_MODES.find(m => m.id === id);
    return f ? f.label : (id || '?');
  }

  _classShort(id) {
    const f = NET_CLASSES.find(m => m.id === id);
    return f ? f.short : (id || '?');
  }

  // Досыл свежей внешности: игрок мог переодеться в инвентаре уже после
  // входа в лобби (hello ушёл со старым шмотом) — сервер хранит протухший
  // скин и все видят чужую одежду. Шлём актуальный гардероб текущего класса.
  _sendFreshGear() {
    try {
      if (!this.net || !this.net.connected) return;
      let cls = 'Assault';
      try {
        const self = (this.net.players || []).find(p => p.id === this.net.myId);
        if (self && (self.cls === 'Assault' || self.cls === 'Tank' || self.cls === 'Medic' || self.cls === 'Sniper')) cls = self.cls;
        else if (gameState.lastClass) cls = gameState.lastClass;
      } catch (e) {}
      const cc = getCharacterColors() || {};
      const gear = {
        cap: getEquippedHead(cls), shoe: getEquippedShoes(cls),
        torso: getEquippedTorso(cls), pants: getEquippedPants(cls),
        body: cc.head
      };
      try { console.info('[NET] gear out:', cls, JSON.stringify(gear)); } catch (e) {}
      try {
        netBuildMaxesFull(cls).then(bm => {
          try { this.net.sendCls(cls, gear, bm.maxHp, bm.maxArmor); } catch (e) {}
        });
      } catch (e) {
        try { this.net.sendCls(cls, gear); } catch (e2) {}
      }
    } catch (e) {}
  }

  // Выбор класса в лобби: запоминаем (переподключение/одиночка подхватят),
  // серверу шлём класс + скин этого класса (гардероб у каждого свой).
  _pickNetClass(id) {
    try {
      if (!NET_CLASSES.some(c => c.id === id)) return;
      try { gameState.lastClass = id; } catch (e) {}
      let gear = null;
      try {
        const cc = getCharacterColors() || {};
        gear = {
          cap: getEquippedHead(id), shoe: getEquippedShoes(id),
          torso: getEquippedTorso(id), pants: getEquippedPants(id),
          body: cc.head
        };
      } catch (e) { gear = null; }
      try {
        netBuildMaxesFull(id).then(bm => {
          try { this.net.sendCls(id, gear, bm.maxHp, bm.maxArmor); } catch (e) {}
        });
      } catch (e) {
        try { this.net.sendCls(id, gear); } catch (e2) {}
      }
    } catch (e) {}
  }

  // Длительность матча: минуты хоста, 0 = без лимита.
  _timeChoices() {
    return [[3, '3 мин'], [5, '5 мин'], [10, '10 мин'], [0, '∞']];
  }

  _timeLabel(mins) {
    const m = mins | 0;
    if (m <= 0) return 'без лимита';
    const f = this._timeChoices().find(x => x[0] === m);
    return f ? f[1] : `${m} мин`;
  }

  _toast(msg) {
    const _cx = gameW(this) / 2;
    try {
      if (this._toastObj) this._toastObj.destroy();
      this._toastObj = this.add.text(_cx, 680, msg, {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#252560', padding: 8
      }).setOrigin(0.5).setDepth(300);
      this.time.delayedCall(2200, () => {
        try { if (this._toastObj) this._toastObj.destroy(); } catch (e) {}
        this._toastObj = null;
      });
    } catch (e) {}
  }

  update() {}
}
