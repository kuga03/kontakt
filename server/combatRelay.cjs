'use strict';
// combatRelay.cjs вЂ” РІР°Р»РёРґР°С†РёСЏ Р±РѕСЏ (Р±С‹Р»Рѕ РІ server.js).
const { lookupWeapon, maxHitDist, maxHitsPerSec } = require('./weapons.cjs');
const State = require('./state.cjs');
const { rooms } = State;
const { wallLos } = require('./geo.cjs');
const { fighterInfo, maxArmorOf, maxHpOf, roomOf, send } = require('./rooms.cjs');
const { ARMOR_KIT, BOOM_MAX_DMG, BOOM_RADIUS, MEDKIT_HEAL, dealDamage } = require('./combat.cjs');
const { srvReloadMs, srvMags, srvEnsureMag, srvRefillDone, srvInitMagFromMsg } = require('./mag.cjs');

const COMBAT_TYPES = new Set(['hit','melee','naded','boom','fire','reload','kit','kitwant','snap','smoke']);

function handleCombat(ws, m) {
  if (!m || !COMBAT_TYPES.has(m.t)) return false;
    if (m.t === 'hit') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      const mt = room.match;
      const targetId = Number(m.target);
      const dmg = Math.floor(+m.dmg);
      if (!Number.isFinite(targetId) || !Number.isFinite(dmg) || dmg < 1 || dmg > 150) return;
      // Зона с клиента (белый список): голова/ноги считает снайперская
      // детекция NetGameScene, сервер применяет множитель в dealDamage.
      const zone = (m.zone === 'head' || m.zone === 'legs') ? m.zone : 'body';
      const weaponRaw = String(m.weapon || '').slice(0, 24);
      const wspec = lookupWeapon(weaponRaw);
      // Б1: неизвестный ствол — не relay'им и не считаем (был любой строкой).
      // frag/smoke как w в hit не ходят (это boom) — тоже отклоняем.
      if (!wspec || wspec.kind === 'explosive') {
        try { console.log(`[net] hit reject: unknown weapon "${weaponRaw}" от ${ws._id}`); } catch (e) {}
        return;
      }
      // w в damage — как прислал клиент (алиас M16 латиницей не переименовываем,
      // иначе ломается контракт протокола и старые тесты/клиенты).
      const weapon = weaponRaw;
      if (!mt.alive[ws._id] || !mt.alive[targetId]) return;
      if (!(mt.hp[targetId] > 0)) return;
      // Темп: глобальный кап 40/с + стволовой по скорострельности.
      // (дробь шлёт батчем, 8 дробин в упор одним хитом).
      const now = Date.now();
      ws._hitTs = (ws._hitTs || []).filter(t => now - t < 1000);
      if (ws._hitTs.length >= 40) return;
      // Стволовое окно: темп очереди не выше скорострельности x1.5.
      try {
        const perSec = maxHitsPerSec(wspec);
        ws._hitWin = ws._hitWin || {};
        const key = wspec.name;
        const arr = (ws._hitWin[key] = (ws._hitWin[key] || []).filter(t => now - t < 1000));
        if (arr.length >= perSec) {
          try { console.log(`[net] hit reject: темп ${key} ${arr.length}/${perSec} от ${ws._id}`); } catch (e) {}
          return;
        }
        arr.push(now);
      } catch (e) {}
      ws._hitTs.push(now);
      // Дистанция: по дальности ствола + запас 600 на лаг/телепорт,
      // но не больше исторического капа 1300.
      // Стена между: как hasWallLos в одиночке (дальше 1600 — без проверки).
      // Без обеих позиций — отказ (иначе стрельба сквозь стены до первого снапа).
      // Позиция стрелка — только серверная room._pos (телепорт >600px/с
      // её не двигает, а _lastPos — двигает: вид идёт, сервер стоит).
      const a = (room._pos || {})[ws._id], b = (room._pos || {})[targetId];
      if (!a || !b) return;
      {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const lim = maxHitDist(wspec);
        if (d > lim) {
          try { console.log(`[net] hit reject: далеко ${Math.round(d)} > ${lim} (${weapon}) от ${ws._id}`); } catch (e) {}
          return;
        }
        if (!wallLos(a.x, a.y - 20, b.x, b.y - 28)) return;
      }
      // Множитель урона владельца (прокачка/гены): клиент считает свой,
      // сервер режет коридором 1..2 — свой бафф проходит, чужой нет.
      let hmult = 1;
      if (m.mult != null) {
        hmult = Math.max(1, Math.min(2, +m.mult || 1));
        if (!Number.isFinite(hmult)) hmult = 1;
      }
      // Б2: серверный потолок урона — база ствола x2.5 (покрывает скиллы/
      // гены/сеты: damageMult ~1.03^n, damagePct, округления), абсолютный
      // кап 150 — как раньше. Выше потолка — клампим (не реджектим, чтобы
      // легитимные баффы не давали десинк), ниже — как есть.
      let effDmg = dmg;
      try {
        const wcap = Math.min(150, Math.ceil((wspec.dmg || 10) * 2.5));
        if (effDmg > wcap) {
          try { console.log(`[net] hit clamp: ${effDmg} -> ${wcap} (${weapon}) от ${ws._id}`); } catch (e) {}
          effDmg = wcap;
        }
      } catch (e) {}
      dealDamage(room, roomName, targetId, effDmg, ws._id, { zone, weapon, mult: hmult });
      return;
    }

    // Ближний бой (нож/катана/мачете): как hit, но тело x1 и близко.
    // В одиночке: дуга 0.6π, range ствола, без зональности.
    // Б1: ствол обязан существовать в справочнике (приклад тоже шлёт имя
    // текущего ствола — годится любой известный, мусор отклоняем).
    if (m.t === 'melee') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      const mt = room.match;
      const targetId = Number(m.target);
      const dmg = Math.floor(+m.dmg);
      if (!Number.isFinite(targetId) || !Number.isFinite(dmg) || dmg < 1 || dmg > 150) return;
      const weaponRaw = String(m.weapon || '').slice(0, 24);
      const wspec = lookupWeapon(weaponRaw);
      if (!wspec || wspec.kind === 'explosive') {
        try { console.log(`[net] melee reject: unknown weapon "${weaponRaw}" от ${ws._id}`); } catch (e) {}
        return;
      }
      const weapon = weaponRaw;
      if (!mt.alive[ws._id] || !mt.alive[targetId]) return;
      if (!(mt.hp[targetId] > 0)) return;
      const now = Date.now();
      ws._meleeTs = (ws._meleeTs || []).filter(t => now - t < 1000);
      if (ws._meleeTs.length >= 4) return;
      ws._meleeTs.push(now);
      const a = (room._pos || {})[ws._id], b = (room._pos || {})[targetId];
      if (!a || !b) return;
      if (Math.hypot(a.x - b.x, a.y - b.y) > 140) return;
      if (!wallLos(a.x, a.y - 20, b.x, b.y - 28)) return;
      // Б2: тот же потолок, что в hit (приклад — любое известное имя).
      let effMelee = dmg;
      try {
        const wcap = Math.min(150, Math.ceil((wspec.dmg || 10) * 2.5));
        if (effMelee > wcap) {
          try { console.log(`[net] melee clamp: ${effMelee} -> ${wcap} (${weapon}) от ${ws._id}`); } catch (e) {}
          effMelee = wcap;
        }
      } catch (e) {}
      dealDamage(room, roomName, targetId, effMelee, ws._id, { zone: 'body', weapon });
      return;
    }

    // Граната брошена: всем на отрисовку полёта (взрыв — отдельно boom).
    // Б3: бросок из рук — точка обязана быть рядом с серверной позицией
    // кидавшего (150px), иначе бросок «из ниоткуда». Запоминаем бросок:
    // boom без своего naded и вне окна запала отклоняется.
    if (m.t === 'naded') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const now = Date.now();
      ws._nadeTs = (ws._nadeTs || []).filter(t => now - t < 1000);
      if (ws._nadeTs.length >= 5) return;
      ws._nadeTs.push(now);
      const x = +m.x, y = +m.y, angle = +m.angle;
      if (![x, y, angle].every(Number.isFinite)) return;
      if (x < -100 || x > 2600 || y < -100 || y > 1000) return;
      const type = m.type === 'smoke' ? 'smoke' : 'frag';
      try {
        const ap = (room._pos || {})[ws._id];
        if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y) && Math.hypot(ap.x - x, ap.y - y) > 150) {
          try { console.log(`[net] naded reject: далеко от тела (${Math.round(Math.hypot(ap.x - x, ap.y - y))}px) от ${ws._id}`); } catch (e) {}
          return;
        }
      } catch (e) {}
      try {
        ws._nades = (ws._nades || []).filter(n => n && now - n.t0 < 3000);
        ws._nades.push({ type, x: Math.round(x), y: Math.round(y), angle, t0: now });
        if (ws._nades.length > 3) ws._nades.splice(0, ws._nades.length - 3);
      } catch (e) {}
      const out = JSON.stringify({ t: 'naded', id: ws._id, type, x: Math.round(x), y: Math.round(y), angle });
      for (const c of room.members) {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          try { c.send(out); } catch (e) {}
        }
      }
      return;
    }

    // Взрыв: всем на вспышку/звук + урон по площади от сервера.
    if (m.t === 'boom') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const now = Date.now();
      ws._boomTs = (ws._boomTs || []).filter(t => now - t < 1000);
      if (ws._boomTs.length >= 2) return;
      ws._boomTs.push(now);
      const x = +m.x, y = +m.y;
      if (![x, y].every(Number.isFinite)) return;
      if (x < -100 || x > 2600 || y < -100 || y > 1000) return;
      // Взрыв рядом с кидавшим (400px от его позиции — дальше честная
      // граната не долетает: скорость 680, запал 1.1с): артиллерии
      // через карту нет — граната летит от тела, а не из ниоткуда.
      try {
        const ap = (room._pos || {})[ws._id] || ws._lastPos;
        if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y) && Math.hypot(ap.x - x, ap.y - y) > 400) return;
      } catch (e) {}
      // Б3: взрыв обязан продолжать свой бросок: тот же тип, окно запала
      // (frag 1100мс: 300..2000; smoke 850мс: 200..1600 — с запасом на лаг),
      // точка не дальше 800px от точки броска (maxTravel 720 + отскоки).
      // Чужой/протухший/без броска — отклоняем. Успешный бросок сгорает
      // (один boom на один naded).
      try {
        const WIN = { frag: [300, 2000], smoke: [200, 1600] };
        const type0 = m.type === 'smoke' ? 'smoke' : 'frag';
        const w = WIN[type0];
        const list = (ws._nades || []).filter(n => n && n.type === type0);
        let bi = -1;
        for (let i = list.length - 1; i >= 0; i--) {
          const age = now - list[i].t0;
          if (age >= w[0] && age <= w[1] &&
              Math.hypot(list[i].x - x, list[i].y - y) <= 800) { bi = i; break; }
        }
        if (bi < 0) {
          try { console.log(`[net] boom reject: нет броска ${type0} в окне запала от ${ws._id}`); } catch (e) {}
          return;
        }
        try {
          const full = ws._nades || [];
          const rec = list[bi];
          const gi = full.indexOf(rec);
          if (gi >= 0) full.splice(gi, 1);
        } catch (e) {}
      } catch (e) { return; }
      const type = m.type === 'smoke' ? 'smoke' : 'frag';
      if (type === 'smoke') {
        // Дым — только визуал соседям: кидавший уже видит свой локально
        // (emitSmoke), вспышка boom ему и остальным не нужна.
        const s = JSON.stringify({ t: 'smoke', id: ws._id, x: Math.round(x), y: Math.round(y) });
        for (const c of room.members) {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            try { c.send(s); } catch (e) {}
          }
        }
        return;
      }
      const out = JSON.stringify({ t: 'boom', id: ws._id, type, x: Math.round(x), y: Math.round(y) });
      for (const c of room.members) {
        if (c.readyState === WebSocket.OPEN) {
          try { c.send(out); } catch (e) {}
        }
      }
      if (type === 'frag') {
        // Формула как в одиночке (GameScene.explodeGrenade):
        // спад 1-(d/R)*0.55 (на краю ~54, а не 10).
        // Френдлифаер ЗАДУМАН: своих задевает, урон режет и штрафует
        // dealDamage (x0.5, тимкилл −1 килл/−1 очко, суицид нейтрален).
        // Боты тоже страдают: раньше цикл шёл только по members.
        const victimIds = [];
        for (const c of room.members) victimIds.push(c._id);
        if (Array.isArray(room.bots)) {
          for (const b of room.bots) victimIds.push(b.id);
        }
        for (const vid of victimIds) {
          const p = (room._pos || {})[vid];
          if (!p) continue;
          if (!room.match.alive[vid]) continue;
          const d = Math.hypot(p.x - x, p.y - y);
          if (d > BOOM_RADIUS) continue;
          // Стены/плиты режут взрыв как в одиночке (hasBlastLos по телу
          // и голове): за углом не дамажит.
          if (!wallLos(x, y, p.x, p.y - 28) && !wallLos(x, y, p.x, p.y - 62)) continue;
          const dmg = Math.round(BOOM_MAX_DMG * (1 - (d / BOOM_RADIUS) * 0.55));
          dealDamage(room, roomName, vid, dmg, ws._id, { weapon: 'frag' });
          if (!rooms.get(roomName) || !rooms.get(roomName).match) return;
        }
      }
      return;
    }

    // Выстрел (звук/вспышка у остальных). Пули летят локально у каждого.
    // Магазин серверный: каждый fire декрементит, пустой и окно
    // перезарядки — дроп. Ближний бой бесконечный — магазин не ведём.
    if (m.t === 'fire') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const now = Date.now();
      ws._fireTs = (ws._fireTs || []).filter(t => now - t < 1000);
      if (ws._fireTs.length >= 20) return;
      ws._fireTs.push(now);
      const x = +m.x, y = +m.y, angle = +m.angle;
      if (![x, y, angle].every(Number.isFinite)) return;
      if (x < -100 || x > 2600 || y < -100 || y > 1000) return;
      // Б1: ствол обязан существовать (BOT-* ок) — мусор не relay'им.
      const weaponRaw = String(m.weapon || '').slice(0, 24);
      const wspec = lookupWeapon(weaponRaw);
      if (!wspec) {
        try { console.log(`[net] fire reject: unknown weapon "${weaponRaw}" от ${ws._id}`); } catch (e) {}
        return;
      }
      // Очередь одной пачкой (SIG SG x3): число пуль едет соседям,
      // они дорисуют все с темпом 90мс. Лимит ивента прежний.
      // Relay — сырое имя клиента (валидация выше, контракт не меняем).
      const n = Math.max(1, Math.min(5, parseInt(m.n, 10) || 1));
      if (wspec.kind !== 'melee') {
        srvRefillDone(ws, now);
        // Fire во время своей перезарядки — дроп (чужой ствол разрешён:
        // смена ствола перезарядку отменяет, как cancelReload у клиента).
        if (ws._reloadUntil && now < ws._reloadUntil && ws._reloadGun === wspec.name) return;
        srvEnsureMag(ws, wspec);
        const _mm = srvMags(ws);
        if ((_mm[wspec.name] | 0) <= 0) {
          try { console.log(`[net] fire reject: пустой магазин (${wspec.name}) от ${ws._id}`); } catch (e) {}
          return;
        }
        _mm[wspec.name] = Math.max(0, (_mm[wspec.name] | 0) - n);
      }
      const out = JSON.stringify({
        t: 'fire', id: ws._id,
        weapon: weaponRaw,
        x: Math.round(x), y: Math.round(y), angle, n
      });
      for (const c of room.members) {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          try { c.send(out); } catch (e) {}
        }
      }
      return;
    }

    // Старт перезарядки от клиента: ставим окно, по истечении магазин полный.
    if (m.t === 'reload') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const weaponRaw = String(m.weapon || '').slice(0, 24);
      const wspec = lookupWeapon(weaponRaw);
      if (!wspec || wspec.kind === 'melee') return;
      const now = Date.now();
      srvRefillDone(ws, now);
      srvEnsureMag(ws, wspec);
      const ms = srvReloadMs(wspec);
      ws._reloadGun = wspec.name;
      ws._reloadUntil = now + (Number.isFinite(ms) && ms > 0 ? ms : 2000);
      return;
    }

    // Кит выкинут: всем на отрисовку (у автора уже есть).
    if (m.t === 'kit') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const now = Date.now();
      ws._kitTs = (ws._kitTs || []).filter(t => now - t < 2000);
      if (ws._kitTs.length >= 4) return;
      ws._kitTs.push(now);
      const type = String(m.type || '');
      if (!['medkit', 'ammo', 'armor', 'frag', 'smoke'].includes(type)) return;
      const x = +m.x, y = +m.y;
      if (![x, y].every(Number.isFinite)) return;
      if (x < -100 || x > 2600 || y < -100 || y > 1000) return;
      room._kits = room._kits || {};
      // ID от автора (мойId:счётчик) — чтобы локальный и сетевой совпали.
      // Чужой/занятый — выдаём свой.
      let kid = String(m.id || '');
      // Счётчик автора догоняем до его id: иначе повторная выдача того же
      // счётчика плодила коллизии, а генератор давал тот же занятый id.
      try {
        const mm = /^(\d+):(\d+)$/.exec(kid);
        if (mm && Number(mm[1]) === ws._id) {
          ws._kitN = Math.max(ws._kitN | 0, parseInt(mm[2], 10) || 0);
        }
      } catch (e) {}
      const reqId = kid;
      if (!/^\d+:\d+$/.test(kid) || room._kits[kid]) {
        do {
          kid = ws._id + ':' + ((ws._kitN = (ws._kitN | 0) + 1));
        } while (room._kits[kid]);
        // Автору — поправка id: иначе его kitok с новым id не сматчится
        // и кит вечно висит у кидавшего.
        send(ws, { t: 'kitfix', from: reqId, id: kid });
      }
      room._kits[kid] = { ts: now, gone: false, type, x: Math.round(x), y: Math.round(y) };
      const out = JSON.stringify({ t: 'kit', id: kid, type, x: Math.round(x), y: Math.round(y), team: ws._team || 'blue' });
      for (const c of room.members) {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          try { c.send(out); } catch (e) {}
        }
      }
      return;
    }

    // Просьба забрать кит: кто первый — того и тапки (авторитет сервера).
    if (m.t === 'kitwant') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const kid = String(m.id || '');
      const k = (room._kits || {})[kid];
      if (!k || k.gone) return;
      // Дистанция до кита (Б3: 250px): вакуум через полкарты режем.
      // Легитимный подбор — клиент шлёт kitwant только по перекрытию
      // (~40px), запас 250 покрывает протухшие снапы 15Гц и падение.
      // Было 800 — кит забирался с другого яруса/через полкарты.
      try {
        const pp = (room._pos || {})[ws._id];
        if (pp && Number.isFinite(pp.x) && Number.isFinite(pp.y) && k.x != null && k.y != null) {
          if (Math.hypot(pp.x - k.x, pp.y - k.y) > 250) {
            try { console.log(`[net] kitwant reject: далеко (${Math.round(Math.hypot(pp.x - k.x, pp.y - k.y))}px) от ${ws._id}`); } catch (e) {}
            return;
          }
        }
      } catch (e) {}
      if (Date.now() - (k.ts || 0) > 60000) {
        k.gone = true;
        return;
      }
      k.gone = true;
      // Эффект кита — в состояние матча (клиент покажет то же самое локально):
      // броня — полный бакет класса, аптечка — +40 к ХП (не выше максимума).
      try {
        const mt = room.match;
        const fi = fighterInfo(room, ws._id);
        const cls = (fi && fi.cls) || 'Assault';
        if (k.type === 'armor' && mt) {
          // +30 с капом maxArmor бойца — как restoreArmor в одиночке.
          mt.armor = mt.armor || {};
          mt.armor[ws._id] = Math.min(maxArmorOf(room, ws._id, cls), (mt.armor[ws._id] | 0) + ARMOR_KIT);
        } else if (k.type === 'medkit' && mt && mt.alive[ws._id]) {
          mt.hp[ws._id] = Math.min(maxHpOf(room, ws._id, cls), (mt.hp[ws._id] | 0) + MEDKIT_HEAL);
        }
      } catch (e) {}
      const out = JSON.stringify({ t: 'kitok', id: kid, by: ws._id });
      for (const c of room.members) {
        if (c.readyState === WebSocket.OPEN) {
          try { c.send(out); } catch (e) {}
        }
      }
      return;
    }

    // Снапшот бойца (фаза 3): ретранслируем соседям по комнате.
    // Лимит 20Гц с клиента, иначе дропаем молча. Валидация-лит в фазе 3б.
    if (m.t === 'snap') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started) return;
      const now = Date.now();
      if (ws._lastSnap && now - ws._lastSnap < 50) return;
      ws._lastSnap = now;
      // Позиции помним для проверки дистанции в hit.
      // Телепорты (>600px за <1с): позицию не двигаем (вид идёт дальше),
      // иначе захваты/флаги/дистанция ломаются. Льгота 1.5с после спавна.
      const cx = +m.x || 0, cy = +m.y || 0;
      ws._lastPos = { x: cx, y: cy };
      room._pos = room._pos || {};
      let posOk = true;
      try {
        if (!(ws._teleFree && now < ws._teleFree)) {
          const lp = ws._lastPosOk;
          if (lp && now - lp.t < 1000 && Math.hypot(cx - lp.x, cy - lp.y) > 600) {
            posOk = false;
          }
        }
      } catch (e) { posOk = true; }
      if (posOk) {
        room._pos[ws._id] = ws._lastPos;
        ws._lastPosOk = { x: cx, y: cy, t: now };
      }
      // Присед — из снапов: боты целят в голову по факту (вприсядку ниже),
      // иначе очередь летит над макушкой, а урон всё равно идёт.
      // Живая высота головы из рига (headY): коридор ±120 от тела,
      // чужое не подделать в разрыв с моделью.
      try {
        room._crouch = room._crouch || {};
        room._crouch[ws._id] = !!m.crouch;
        room._headY = room._headY || {};
        if (m.headY != null && Number.isFinite(+m.headY)) {
          const hy = Math.round(+m.headY);
          if (Math.abs(hy - cy) <= 120) room._headY[ws._id] = hy;
        }
        // Скорость из снапа — ботам для упреждения (lead как в одиночке).
        room._vx = room._vx || {};
        room._vx[ws._id] = Number.isFinite(+m.vx) ? Math.round(+m.vx) : 0;
      } catch (e) {}
      // Стойкость (damageTakenMult жертвы) и капы maxHp/maxArmor —
      // из её же снапов: свой билд заявляет сам, чужой не подделать.
      try {
        room._taken = room._taken || {};
        let tm = 1;
        if (m.taken != null) tm = Math.max(0.2, Math.min(1, +m.taken || 1));
        if (!Number.isFinite(tm)) tm = 1;
        room._taken[ws._id] = tm;
        room._maxHp = room._maxHp || {};
        room._maxArmor = room._maxArmor || {};
        // Пишем только присланное: пустое не затирает hello/прошлое (иначе
        // кап схлопнется в 0 — был баг: +undefined давал NaN в проверку).
        if (m.maxHp != null && m.maxHp !== '') {
          const vh = Math.round(+m.maxHp);
          if (Number.isFinite(vh) && vh > 0) room._maxHp[ws._id] = Math.max(50, Math.min(250, vh));
        }
        if (m.maxArmor != null && m.maxArmor !== '') {
          const va = Math.round(+m.maxArmor);
          if (Number.isFinite(va) && va >= 0) room._maxArmor[ws._id] = Math.max(0, Math.min(150, va));
        }
      } catch (e) {}
      // Текущий ствол из снапа (магазин — если клиент его шлёт, иначе фолбэк
      // полным при смене ствола). Срок перезарядки проверяем лениво.
      srvInitMagFromMsg(ws, m);
      try { srvRefillDone(ws, Date.now()); } catch (e) {}
      const out = {
        t: 'snap', id: ws._id,
        x: +m.x || 0, y: +m.y || 0,
        vx: +m.vx || 0, vy: +m.vy || 0,
        hp: Math.max(0, Math.min(999, +m.hp || 0)),
        armor: Math.max(0, Math.min(999, +m.armor || 0)),
        aimX: +m.aimX || 0, aimY: +m.aimY || 0,
        weapon: String(m.weapon || '').slice(0, 24),
        crouch: !!m.crouch, cls: ws._cls || 'Assault'
      };
      // Б4: не relay'им сразу, а кладём в буфер тика — уйдёт ближайшим
      // флешем (≤100мс). Последний снап затирает предыдущие: соседям едет
      // свежее, а не очередь. Отправителю не возвращаем (как раньше).
      try {
        room._snapBuf = room._snapBuf || new Map();
        room._snapBuf.set(ws._id, { msg: out, from: ws });
      } catch (e) {}
      return;
    }

    // Дым от клиента (emitSmoke автора): всем на визуал.
    // Без этого чужие дымы видел только кидавший + сыпались
    // 'unknown message: smoke'.
    if (m.t === 'smoke') {
      const roomName = roomOf(ws);
      const room = rooms.get(roomName);
      if (!room || room.lobby || !room.started || !room.match) return;
      if (!room.match.alive[ws._id]) return;
      const now = Date.now();
      ws._smokeTs = (ws._smokeTs || []).filter(t => now - t < 1000);
      if (ws._smokeTs.length >= 2) return;
      ws._smokeTs.push(now);
      const x = +m.x, y = +m.y;
      if (![x, y].every(Number.isFinite)) return;
      if (x < -100 || x > 2600 || y < -100 || y > 1000) return;
      const out = JSON.stringify({ t: 'smoke', id: ws._id, x: Math.round(x), y: Math.round(y) });
      for (const c of room.members) {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          try { c.send(out); } catch (e) {}
        }
      }
      return;
    }

    if (!COMBAT_TYPES.has(m.t)) send(ws, { t: 'error', msg: 'unknown message: ' + m.t });

  return true;
}

module.exports = { COMBAT_TYPES, handleCombat };

