// Сетевой клиент: один сервер — много комнат (список через /rooms).
// Подключился с room — уже в ней (нет room = main для LAN-совместимости).
// Хост (первый в комнате) настраивает режим и места.
// Официальный сервер (Render): вписать хост сервиса, например
// 'kontakt-xxxx.onrender.com' — тогда игра из ВК/ОК сама найдёт комнаты и пинг.
// Пусто — автоопределение (LAN или same-origin).
export const OFFICIAL_NET_HOST = '';
// Именованные серверы для кнопки выбора в углу лобби («СЕРВЕР 1» и т.д.).
// Добавь свои строкой ниже: { name: 'СЕРВЕР 2', host: '192.168.0.50:8081' }.
export const NET_SERVERS = [
  { name: 'СЕРВЕР 1', host: 'kontakt-eijf.onrender.com' },
];
// Список комнат: null — тут нет игрового сервера (отказ / чужой ответ),
// [] — сервер наш, комнат пока нет. Путать их нельзя: иначе пинг и список
// рисуются по статике (http-server) без WebSocket.
export async function fetchRooms(host) {
  try {
    let base = String(host || OFFICIAL_NET_HOST || '').trim().replace(/\/+$/, '');
    if (!base) {
      try {
        const h = window.location.hostname;
        const secure = window.location.protocol === 'https:';
        base = (h && h !== '') ? ((secure || /\.onrender\.com$/i.test(h)) ? h : h + ':8081') : '127.0.0.1:8081';
      } catch (e) { base = '127.0.0.1:8081'; }
    }
    let url = base.replace(/^ws(s)?:\/\//i, (m, s) => 'http' + (s ? 's' : '') + '://');
    if (!/^https?:\/\//i.test(url)) {
      const securePage = (typeof location !== 'undefined' && location.protocol === 'https:');
      url = (securePage ? 'https://' : 'http://') + url;
    }
    url = url.replace(/\/+$/, '') + '/rooms';
    const r = await fetch(url, { cache: 'no-store' });
    if (!r || !r.ok) return null;
    const ct = (r.headers && r.headers.get('content-type')) || '';
    if (String(ct).toLowerCase().indexOf('application/json') < 0) return null;
    const j = await r.json().catch(() => null);
    if (!j || j.ok !== true || !Array.isArray(j.rooms)) return null;
    return j.rooms;
  } catch (e) { return null; }
}
export default class NetClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.myId = null;
    this.myName = null;
    this.myRoom = 'main';
    this.amHost = false;
    this.roomMode = 'TDM';
    this.roomMax = 8;
    this.roomTimeLimit = 5;
    this.roomDifficulty = 'experienced';
    this.roomBotsOn = true;
    this.roomStarted = false;
    this.players = [];
    this.ready = false;
    this.lastPingMs = null;
    this.onroominfo = null;
    this.onplayers = null;
    this.onstarted = null;
    this.onsnap = null;
    this.ondamage = null;
    this.ondead = null;
    this.onspawn = null;
    this.onscore = null;
    this.onover = null;
    this.onobj = null;
    this.onbanner = null;
    this.onkit = null;
    this.onkitok = null;
    this.onkitfix = null;
    this.onkicked = null;
    // Тебя выгнал хост (до разрыва): лобби покажет причину, а не «закрыто».
    this.wasKicked = false;
    this.onfire = null;
    this.onnaded = null;
    this.onboom = null;
    this.onsmoke = null;
    this.onrooms = null;
    this.onerror = null;
    this.onclose = null;
    this._pingTimer = null;
    this._pingT = 0;
    this._cls = 'Assault';
    this._lastHost = null;
    this._lastName = null;
    this._lastCls = null;
    this._lastGear = null;
    this._lastMaxHp = null;
    this._lastMaxArmor = null;
    this._lastRoom = null;
  }

  reconnect() {
    if (!this._lastHost || !this._lastName) {
      return Promise.reject(new Error('Нет данных для переподключения'));
    }
    return this.connect(this._lastHost, this._lastName, this._lastCls || this._cls, this._lastGear, this._lastMaxHp, this._lastMaxArmor, this._lastRoom);
  }

  connect(host, name, cls, gear, maxHp, maxArmor, room) {
    return new Promise((resolve, reject) => {
      try {
        this.close();
      } catch (e) {}
      this._cls = ['Assault', 'Tank', 'Medic', 'Sniper'].includes(cls) ? cls : 'Assault';
      this._gear = (gear && typeof gear === 'object') ? gear : null;
      // Свой билд для серверных формул (капы возрождения/китов):
      // сервер режет коридорами 50–250/0–150, чужое не подделать.
      this._maxHp = (maxHp != null && Number.isFinite(+maxHp)) ? Math.max(50, Math.min(250, Math.round(+maxHp))) : null;
      this._maxArmor = (maxArmor != null && Number.isFinite(+maxArmor)) ? Math.max(0, Math.min(150, Math.round(+maxArmor))) : null;
      let url = String(host || '').trim().replace(/\/+$/, '');
      if (!url) {
        reject(new Error('Пустой адрес'));
        return;
      }
      // http(s)-ссылку переводим в ws(s): https всегда в wss,
      // иначе браузер режет mixed content. Голый адрес на https-странице
      // тоже в wss (иначе Render и любой хостинг не откроются).
      url = url.replace(/^http(s)?:\/\//i, (m, s) => 'ws' + (s ? 's' : '') + '://');
      if (!/^wss?:\/\//i.test(url)) {
        const securePage = (typeof location !== 'undefined' && location.protocol === 'https:');
        url = (securePage ? 'wss://' : 'ws://') + url;
      }
      // Хостинги (Render) слушают только 443/80: прилипший :8081 из поля
      // адреса отрезаем, иначе сокет не откроется.
      url = url.replace(/(\.onrender\.com):\d+/i, '$1');
      if (!/\/net\/?$/.test(url)) url += '/net';
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(new Error('Не открылся сокет'));
        return;
      }
      this.ws = ws;
      let done = false;
      this._lastHost = String(host || '').trim();
      this._lastName = String(name || '').slice(0, 16);
      this._lastCls = this._cls;
      this._lastGear = this._gear;
      this._lastMaxHp = this._maxHp;
      this._lastMaxArmor = this._maxArmor;
      try {
        this._lastRoom = String(room || '').trim().slice(0, 24) || null;
      } catch (e) { this._lastRoom = null; }
      const fail = (msg) => {
        if (done) return;
        done = true;
        try { ws.close(); } catch (e) {}
        this.ws = null;
        reject(new Error(msg));
      };
      const to = setTimeout(() => fail('Сервер не отвечает (20с): спит или адрес неверный'), 20000);
      ws.onopen = () => {
        try {
          const hello = { t: 'hello', name: String(name || '').slice(0, 16), cls: this._cls, gear: this._gear || undefined };
          try {
            const rn = String(room || '').trim().slice(0, 24);
            if (rn) hello.room = rn;
          } catch (e) {}
          if (this._maxHp != null) hello.maxHp = this._maxHp;
          if (this._maxArmor != null) hello.maxArmor = this._maxArmor;
          ws.send(JSON.stringify(hello));
        } catch (e) {
          fail('Не отправилось приветствие');
        }
      };
      ws.onerror = () => fail('Нет соединения (хост выключен?)');
      ws.onclose = () => {
        try {
          if (this._pingTimer) clearInterval(this._pingTimer);
        } catch (e) {}
        this._pingTimer = null;
        this.connected = false;
        if (!done) {
          done = true;
          clearTimeout(to);
          reject(new Error('Соединение закрыто'));
          return;
        }
        if (this.onclose) {
          try { this.onclose(); } catch (e) {}
        }
      };
      ws.onmessage = (ev) => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch (e) {
          return;
        }
        this._route(m, { resolve, reject, done: () => done, markDone: () => { done = true; clearTimeout(to); } });
      };
    });
  }

  _route(m, first) {
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'welcome' && first && !first.done()) {
      this.connected = true;
      this.myId = m.id;
      this.myName = m.you;
      this.myRoom = m.room || 'main';
      this.amHost = !!m.host;
      this.ready = false;
      try {
        this._pingT = Date.now();
        this._pingTimer = setInterval(() => {
          try {
            this._pingT = Date.now();
            this.send({ t: 'ping', n: this._pingT });
          } catch (e) {}
        }, 15000);
      } catch (e) {}
      first.markDone();
      first.resolve({ id: m.id, name: m.you });
      return;
    }
    if (m.t === 'error' && first && !first.done()) {
      // Отказ входа (полная/идёт): сразу наружу, а не висеть.
      first.markDone();
      first.reject(new Error(m.msg || 'Ошибка сервера'));
      return;
    }
    if (m.t === 'roominfo') {
      if (m.mode) this.roomMode = m.mode;
      if (m.maxPlayers) this.roomMax = m.maxPlayers;
      if (m.timeLimit != null) this.roomTimeLimit = m.timeLimit | 0;
      if (m.difficulty) this.roomDifficulty = ['novice', 'experienced', 'veteran'].includes(m.difficulty) ? m.difficulty : 'experienced';
      if (m.botsOn != null) this.roomBotsOn = !!m.botsOn;
      this.roomStarted = !!m.started;
      if (this.onroominfo) {
        try { this.onroominfo(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'players') {
      this.players = Array.isArray(m.players) ? m.players : [];
      const me = this.players.find(p => p.id === this.myId);
      this.ready = !!(me && me.ready);
      this.amHost = !!(me && me.host);
      if (this.onplayers) {
        try { this.onplayers(this.players); } catch (e) {}
      }
      return;
    }
    if (m.t === 'started') {
      if (this.onstarted) {
        try { this.onstarted(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'snap') {
      if (this.onsnap) {
        try { this.onsnap(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'damage') {
      if (this.ondamage) {
        try { this.ondamage(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'dead') {
      if (this.ondead) {
        try { this.ondead(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'spawn') {
      if (this.onspawn) {
        try { this.onspawn(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'score') {
      if (this.onscore) {
        try { this.onscore(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'over') {
      if (this.onover) {
        try { this.onover(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'obj') {
      if (this.onobj) {
        try { this.onobj(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'banner') {
      if (this.onbanner) {
        try { this.onbanner(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'kit') {
      if (this.onkit) {
        try { this.onkit(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'kitok') {
      if (this.onkitok) {
        try { this.onkitok(m); } catch (e) {}
      }
      return;
    }
    // Сервер переписал id моего кита (коллизия): переименовать локальный.
    if (m.t === 'kitfix') {
      if (this.onkitfix) {
        try { this.onkitfix(m); } catch (e) {}
      }
      return;
    }
    // Хост выгнал из лобби: следом придёт разрыв — причину помним флагом.
    if (m.t === 'kicked') {
      this.wasKicked = true;
      if (this.onkicked) {
        try { this.onkicked(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'fire') {
      if (this.onfire) {
        try { this.onfire(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'naded') {
      if (this.onnaded) {
        try { this.onnaded(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'boom') {
      if (this.onboom) {
        try { this.onboom(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'smoke') {
      if (this.onsmoke) {
        try { this.onsmoke(m); } catch (e) {}
      }
      return;
    }
    if (m.t === 'rooms') {
      if (this.onrooms) {
        try { this.onrooms(Array.isArray(m.rooms) ? m.rooms : []); } catch (e) {}
      }
      return;
    }
    if (m.t === 'pong') {
      try {
        if (m.n) this.lastPingMs = Date.now() - m.n;
      } catch (e) {}
      return;
    }
    if (m.t === 'error') {
      if (this.onerror) {
        try { this.onerror(m.msg || 'Ошибка сервера'); } catch (e) {}
      }
      return;
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  setup(mode, maxPlayers, timeLimit, difficulty, botsOn) {
    const o = { t: 'setup', mode, maxPlayers };
    if (timeLimit != null) o.timeLimit = timeLimit | 0;
    if (difficulty != null && ['novice', 'experienced', 'veteran'].includes(difficulty)) o.difficulty = difficulty;
    if (botsOn != null) o.botsOn = !!botsOn;
    this.send(o);
  }
  setReady(ready) { this.send({ t: 'ready', ready: !!ready }); }
  sendTeam(team) {
    const t = team === 'blue' || team === 'red' ? team : 'auto';
    this.send({ t: 'team', team: t });
  }
  // Смена класса в лобби (Assault/Tank/Medic/Sniper) + скин нового класса.
  sendCls(cls, gear, maxHp, maxArmor) {
    const o = {
      t: 'cls',
      cls: ['Assault', 'Tank', 'Medic', 'Sniper'].includes(cls) ? cls : 'Assault'
    };
    if (gear && typeof gear === 'object') o.gear = gear;
    if (maxHp != null && Number.isFinite(+maxHp)) o.maxHp = Math.max(50, Math.min(250, Math.round(+maxHp)));
    else if (this._maxHp != null) o.maxHp = this._maxHp;
    if (maxArmor != null && Number.isFinite(+maxArmor)) o.maxArmor = Math.max(0, Math.min(150, Math.round(+maxArmor)));
    else if (this._maxArmor != null) o.maxArmor = this._maxArmor;
    this.send(o);
  }
  // Выгнать из лобби (только хост): сервер закроет сокет жертвы сам.
  sendKick(id) {
    this.send({ t: 'kick', id: Number(id) });
  }
  startGame(bots) {
    const n = Math.max(0, Math.min(4, parseInt(bots, 10) || 0));
    this.send({ t: 'start', bots: n });
  }
  sendSnap(s) {
    this.send({
      t: 'snap',
      x: Math.round(s.x || 0), y: Math.round(s.y || 0),
      vx: Math.round(s.vx || 0), vy: Math.round(s.vy || 0),
      hp: Math.round(s.hp || 0),
      armor: Math.round(s.armor || 0),
      aimX: Math.round(s.aimX || 0), aimY: Math.round(s.aimY || 0),
      weapon: String(s.weapon || '').slice(0, 24),
      crouch: !!s.crouch,
      // Живая высота головы из рига (присед/стойка/k): боты целят
      // по факту, а не в точку над макушкой. Коридор режет сервер.
      headY: (s.headY != null && Number.isFinite(+s.headY)) ? Math.round(+s.headY) : undefined,
      // Свой билд для серверных формул (капы/стойкость). Чужой не подделать:
      // каждый заявляет только себя; коридоры режет сервер.
      taken: (s.taken == null) ? undefined : Math.max(0.2, Math.min(1, +s.taken || 1)),
      maxHp: (s.maxHp == null) ? undefined : Math.max(50, Math.min(250, Math.round(s.maxHp))),
      maxArmor: (s.maxArmor == null) ? undefined : Math.max(0, Math.min(150, Math.round(s.maxArmor)))
    });
  }

  sendHit(target, dmg, weapon, zone, mult) {
    const o = {
      t: 'hit',
      target,
      dmg: Math.max(1, Math.floor(+dmg || 0)),
      weapon: String(weapon || '').slice(0, 24),
      zone: (zone === 'head' || zone === 'legs') ? zone : 'body'
    };
    // Хедшот-множитель владельца (гены/скиллы): сервер применит только
    // в голову и обрежет 1..2.
    if (mult != null && Number.isFinite(+mult) && +mult > 1) {
      o.mult = Math.min(2, +mult);
    }
    this.send(o);
  }

  // Ближний бой: отдельным сообщением (сервер проверяет дистанцию/стену).
  sendMelee(target, dmg, weapon) {
    this.send({
      t: 'melee',
      target,
      dmg: Math.max(1, Math.floor(+dmg || 0)),
      weapon: String(weapon || '').slice(0, 24)
    });
  }

  sendFire(weapon, x, y, angle, n) {
    this.send({
      t: 'fire',
      weapon: String(weapon || '').slice(0, 24),
      x: Math.round(x || 0), y: Math.round(y || 0), angle: +angle || 0,
      n: Math.max(1, Math.min(5, parseInt(n, 10) || 1))
    });
  }

  sendReload(weapon) {
    this.send({
      t: 'reload',
      weapon: String(weapon || '').slice(0, 24)
    });
  }

  sendNaded(type, x, y, angle) {
    this.send({
      t: 'naded',
      type: type === 'smoke' ? 'smoke' : 'frag',
      x: Math.round(x || 0), y: Math.round(y || 0), angle: +angle || 0
    });
  }

  sendBoom(x, y, type) {
    this.send({
      t: 'boom',
      type: type === 'smoke' ? 'smoke' : 'frag',
      x: Math.round(x || 0), y: Math.round(y || 0)
    });
  }

  sendSmoke(x, y) {
    this.send({
      t: 'smoke', x: Math.round(x || 0), y: Math.round(y || 0)
    });
  }

  sendKit(id, type, x, y) {
    this.send({
      t: 'kit', id: String(id || ''),
      type: String(type || ''), x: Math.round(x || 0), y: Math.round(y || 0)
    });
  }

  sendKitWant(id) {
    this.send({ t: 'kitwant', id: String(id || '') });
  }

  close() {
    // Ручной разрыв (выход/переподключение) — флаг кика гаснет.
    // Разрыв от сервера close() не зовёт, флаг доживает до onclose лобби.
    this.wasKicked = false;    try {
      if (this._pingTimer) clearInterval(this._pingTimer);
    } catch (e) {}
    this._pingTimer = null;
    try {
      if (this.ws) this.ws.close();
    } catch (e) {}
    this.ws = null;
    this.connected = false;
  }
}
