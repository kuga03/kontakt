import { laneOf } from './dumpCore.js';
import { logSaw } from './sawStop.js';
export function logSteal(scene, f, p, now) {
    try {
      if (scene.mode !== 'CTF' || !f || !p) return;
      if (f._stealEv && !f._stealEv.out) {
        f._stealEv.out = 'сброшен';
        f._stealEv.tOut = Math.round((now || 0) / 1000);
      }
      scene._stealSeq = (scene._stealSeq || 0) + 1;
      const _mw = (scene.mapWidth || 3800) / 2;
      const _sx = (p && Number.isFinite(p.x)) ? (p.x >= _mw ? 1 : -1)
        : (p.team === 'blue' ? 1 : -1);
      const ev = {
        seq: scene._stealSeq,
        t: Math.round((now || 0) / 1000),
        flag: f.team || '?',
        thief: (p.playerName || '?'),
        team: p.team || '?',
        // k316: пометка проноса игрока — CARR пишет и ботов, и YOU
        // (раньше over/CARR сходился только по ботам, а 3 кражи АДМИНа
        // молча выпадали и выглядели как дыра учёта).
        you: (p && scene.player && p === scene.player) ? 1 : 0,
        lane: scene._laneOf(p) || '?',
        side0: _sx,
        mid: null,
        out: null,
        tOut: null
      };
      f._stealEv = ev;
      scene._stealLog = scene._stealLog || [];
      scene._stealLog.push(ev);
      if (scene._stealLog.length > 24) scene._stealLog.splice(0, scene._stealLog.length - 24);
      // k419: маршрут вора (только чтения — кто украл, каким коридором шёл:
      // 51с vs 230с первой кражи на том же k418 — раш low напрямую или гринд
      // mid-цепи у 1092,775). Краж ≤24/матч — отдельный ключ/бакет не нужен.
      try {
        const _ai419 = p && p.ai ? p.ai : null;
        if (_ai419 && typeof logSaw === 'function') {
          let _rt419 = '?';
          try { _rt419 = _ai419._ctfRoute || '?'; } catch (eR) {}
          let _lon419 = '?';
          try { _lon419 = _ai419._laneOn ? 1 : 0; } catch (eL) {}
          let _li419 = '?', _ll419 = '?', _gx419 = '?', _gy419 = '?';
          try {
            const _ch419 = _ai419._laneChain;
            if (_ch419 && _ch419.length) {
              _ll419 = _ch419.length;
              const _ix419 = _ai419._laneIdx || 0;
              _li419 = _ix419;
              const _nd419 = _ch419[Math.min(_ix419, _ch419.length - 1)];
              if (_nd419 && Number.isFinite(_nd419.x)) { _gx419 = Math.round(_nd419.x); _gy419 = Math.round(_nd419.y); }
            }
          } catch (eC) {}
          let _wp419 = '-';
          try {
            const _w419 = _ai419._ctfWp;
            if (_w419 && Number.isFinite(_w419.x)) _wp419 = Math.round(_w419.x) + ',' + Math.round(_w419.y);
          } catch (eW) {}
          logSaw(scene, _ai419, 'atkroute', { atk: 1 }, null,
            _rt419 + '/lane' + _lon419 + '/i' + _li419 + '/' + _ll419 +
            '/g' + _gx419 + ',' + _gy419 + '/wp' + _wp419);
        }
      } catch (e419) {}
    } catch (e) {}
}

export function closeSteal(scene, f, out, now) {
    try {
      if (f && f._stealEv && !f._stealEv.out) {
        f._stealEv.out = out;
        f._stealEv.tOut = Math.round((now || 0) / 1000);
      }
      if (f) f._stealEv = null;
    } catch (e) {}
}

// Разбор «видит ли бот МЕНЯ» теми же воротами, что бой (k210): дальность
// (с гистерезисом залоченной), FOV, buried, LOS B/H/L, дым/стена+блокер,
// патроны, кд, прайм, фокус, последний выстрел по мне, поза, задача.
// Считается только по нажатию C (и по моим попаданиям) — не каждый тик.
export function seeInfo(scene, p) {
    try {
      const me = scene.player, ai = p && p.ai;
      if (!me || !ai) return null;
      const now = (scene.time && scene.time.now) || 0;
      const mCr = !!me.crouching;
      const mBody = me.y - (mCr ? 15 : 28);
      const mHead = me.y - (mCr ? 30 : 62);
      const mLegs = me.y - 8;
      const d = Math.round(Math.hypot(p.x - me.x, p.y - me.y));
      const eng = Math.round(ai.engageRange || 0);
      const w = p.weapon || {};
      const wr = Math.round(w.range || 0);
      let maxD = Math.max(ai.engageRange || 0, (w.range || 0) * 0.9);
      if (me === ai._lastTarget || me === ai._modeTgt) maxD *= 1.2;
      const rng = d <= maxD ? 1 : 0;
      let fov = 0;
      try { fov = ai._inFov(me.x, mBody, me) ? 1 : 0; } catch (e) {}
      let buried = 0;
      try {
        // Точная проверка (k213): сетка хоронила сидящего под плитой.
        const _bur = scene._inSolidExact ? scene._inSolidExact.bind(scene) : null;
        if (_bur && _bur(me.x, mBody, 4) && _bur(me.x, mHead, 4)) buried = 1;
        else if (!_bur && scene._inSolid && scene._inSolid(me.x, mBody, 4) && scene._inSolid(me.x, mHead, 4)) buried = 1;
      } catch (e) {}
      const strict = Math.abs(me.y - p.y) > 80;
      let lB = 0, lH = 0, lL = 0;
      try {
        lB = scene.hasLineOfSight(p.x, p.y, me.x, mBody, strict) ? 1 : 0;
        lH = scene.hasLineOfSight(p.x, p.y, me.x, mHead, strict) ? 1 : 0;
        lL = scene.hasLineOfSight(p.x, p.y, me.x, mLegs, strict) ? 1 : 0;
      } catch (e) {}
      let smk = 0, blk = null;
      if (!lB && !lH && !lL) {
        try {
          if (scene.hasWallLos(p.x, p.y, me.x, mBody, strict)) smk = 1;
          else blk = scene._losBlocker(p.x, p.y, me.x, mBody);
        } catch (e) {}
      }
      const mag = (w.magazine != null ? w.magazine : '?');
      const res = (w.reserveAmmo != null ? w.reserveAmmo : '?');
      const rld = w.reloading ? 1 : 0;
      const cd = Math.max(0, Math.round((ai.nextShotAt || 0) - now));
      const prm = (ai._modeTgt === me) ? 1 : 0;
      const foc = (ai._lastTarget === me) ? 1 : 0;
      let fire = '-';
      try {
        if (ai._dbgLastShotTgt === me && ai._dbgLastShotAt) {
          const s = Math.round((now - ai._dbgLastShotAt) / 1000);
          fire = s <= 30 ? s + 's' : '-';
        }
      } catch (e) {}
      let post = 'S';
      try {
        if (p.crouching) post = 'C';
        else {
          const b = p.body;
          post = (b && (b.blocked?.down || b.touching?.down)) ? 'S' : 'A';
        }
      } catch (e) {}
      return {
        name: p.playerName || '?', d, eng, rng, fov, buried,
        los: (lB ? 'B' : '') + (lH ? 'H' : '') + (lL ? 'L' : '') || '-',
        blk: blk ? blk.x + ',' + blk.y : '-', smk,
        am: mag + '/' + res, rld, cd, prm, foc, fire, post,
        src: ai._dbgSrc || '?', lane: (ai._laneNow || '?')
      };
    } catch (e) { return null; }
}

// Журнал пил (k225): детектор в движке пишет сам — смена задач 8+/2с
// или прыжки 6+/2с. Слепок: где, цель, хп, детур, задача. Кулдаун 10с
// на бота, хранится 20. Ни одного C для поимки не надо.
// k226: mv= — смещение за окно пилы. mv<100 на месте = зацикл;
// большое mv = драка в движении (таскает задачи в бою — норма).
// k248: пятый параметр note обязателен в сигнатуре — без него тело
// читает необъявленную переменную, вызов падает и ВЕСЬ журнал молчит.
// Разложение скорости носильщика (k303): куда уходит время проноса —
// бег/стрейф/воздух/подъём/стойка. Сэмпл каждые 0.5с из тика GameScene.
// Только факты движения (скорость/земля/src), без причин.
export function decompTick(scene, time) {
  try {
    const flags = [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag];
    scene._carryDecomp = scene._carryDecomp || {};
    const seenKeys = {};
    const _jobs = [];
    for (const f of flags) {
      try {
        if (!f || !f.carrier || f.carrier.dead || f.carrier.active === false) continue;
        _jobs.push({ c: f.carrier, flag: f.team || (f === scene.ctfSuddenFlag ? 'gold' : '?') });
      } catch (e) {}
    }
    // k313: запасной путь — носильщик по флагу игрока (isCarrier),
    // если живые флаги сцены не те объекты, что в матче.
    try {
      (scene.players || []).forEach(p => {
        try {
          if (!p || !p.ai || p.dead || p.active === false) return;
          if (!p.isCarrier) return;
          if (_jobs.some(j => j.c === p)) return;
          let _fl = '?';
          try {
            const _all = [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag,
              scene.blueBomb, scene.redBomb];
            for (const _f of _all) {
              if (_f && _f.carrier === p) {
                _fl = _f.team || (_f === scene.ctfSuddenFlag ? 'gold' : '?');
                break;
              }
            }
          } catch (eF) {}
          _jobs.push({ c: p, flag: _fl });
        } catch (eP) {}
      });
    } catch (eS) {}
    for (const _job of _jobs) {
      const c = _job.c;
      try {
        // k316: носильщик-игрок (YOU) тоже пишется в CARR — без ai/srctrap,
        // только факты движения (run/air/climb/stall). Было `if (!c.ai)
        // continue` — 3 проноса АДМИНа (84+16+21с) выпадали, over/CARR
        // не сходился со STEAL и выглядел как баг учёта.
        const _isYou = !!(scene.player && c === scene.player);
        if ((!c.ai && !_isYou) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
        const key = (c.playerName || '?') + '|' + (_job.flag || '?');
        seenKeys[key] = true;
        let r = scene._carryDecomp[key];
        if (!r || r.ref !== c) {
          r = scene._carryDecomp[key] = {
            ref: c, nm: c.playerName || '?', team: c.team || '?',
            flag: _job.flag || '?',
            run: 0, strafe: 0, air: 0, climb: 0, stall: 0, dist: 0, n: 0,
            // k425: время по физическим ярусам (коридор проноса) + бег
            // по ярусам (где бегут, где прыгают). Только накопления.
            tH: 0, tM: 0, tL: 0, rH: 0, rM: 0, rL: 0, _ln: null,
            lx: c.x, ly: c.y, lt: time
          };
          continue;
        }
        const dt = Math.max(1, time - (r.lt || time));
        // k306: разрыв сэмплирования (дроп/пауза/лаг) — не лепим весь
        // разрыв одним куском в бакет (k305: Ермак over261 при 144с
        // проносов — сброс 763→подбор 881 лёг 118с куском в stall).
        // Ресинк без записи; maxGap печатаем для контроля.
        if (dt > 2000) {
          if (dt > (r.maxGap || 0)) r.maxGap = dt;
          r.lx = c.x; r.ly = c.y; r.lt = time;
          continue;
        }
        const d = Math.hypot(c.x - (r.lx ?? c.x), c.y - (r.ly ?? c.y));
        const v = d / dt * 1000;
        let vy = 0;
        try {
          const b = c.body;
          vy = (b && b.velocity && Number.isFinite(b.velocity.y)) ? b.velocity.y : 0;
        } catch (eV) {}
        let grounded = false;
        try {
          const b2 = c.body;
          grounded = !!((b2 && (b2.blocked?.down || b2.touching?.down)));
        } catch (eG) {}
        let src = '';
        try { src = (c.ai && c.ai._dbgSrc) || ''; } catch (eS) {}
        const bk = (src === 'strafe') ? 'strafe' : (v < 20 ? 'stall'
          : (vy < -50 ? 'climb' : (!grounded ? 'air' : 'run')));
        r[bk] += dt / 1000;
        // k425: ярус сэмпла (гистерезис laneOf — как в строках ботов).
        try {
          const _tr425 = laneOf(c, r._ln) || r._ln || 'M';
          r._ln = _tr425;
          r['t' + _tr425] = (r['t' + _tr425] || 0) + dt / 1000;
          if (bk === 'run') r['r' + _tr425] = (r['r' + _tr425] || 0) + dt / 1000;
        } catch (eT425) {}
        r.dist += d;
        r.n++;
        r.lx = c.x; r.ly = c.y; r.lt = time;
      } catch (e) {}
    }
    // Чистим ушедших (сдал/умер/флаг вернулся): запись остаётся для выдачи.
    void seenKeys;
  } catch (e) {}
}



