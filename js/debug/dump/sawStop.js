// k428: виды, которые сами инкрементят `_sawCounts` на месте вызова (честное
// «все события», а не только прошедшие 10с-бакет ленты). Авто-инкремент в
// logSaw их дублировал: runup/nade/ult/ultwait/healgive — ровно ×2 (ручной и
// лента на одном условии, без бакета); aimwall/wallshot/stair/kitskip — «все»
// + бакет-хвосты; hopf — «все» + подмножество grind+task; detdrop так считался
// ещё с k282/k373. Остальные виды по-прежнему считает лента.
const SELF_COUNTED428 = {
  detdrop: 1, stair: 1, hopf: 1, runup: 1, ultwait: 1, ult: 1,
  wallshot: 1, aimwall: 1, nade: 1, kitskip: 1, healgive: 1,
  jchain: 1, jnav: 1, jlob: 1,
};

export function logSaw(scene, ai, kind, cnt, moved, note) {
    try {
      if (!ai || !ai.player) return;
      const me = ai.player;
      const now = (scene.time && scene.time.now) || 0;
      const parts = [];
      try {
        Object.keys(cnt || {}).forEach(k => parts.push(k + (cnt[k] || 0)));
      } catch (e) {}
      scene._sawLog = scene._sawLog || [];
      // k282: счётчики видов за матч (не вытесняются срезом — доказательство
      // срабатывания: chasegap/atbase могут не дожить до хвоста ленты).
      // k373: detdrop считают места вызова (все срывы, а не только прошедшие
      // ключ) — здесь пропускаем, иначе двойной счёт.
      // k428: то же для всех SELF_COUNTED428 (ручной счёт на месте вызова) —
      // иначе runup/aimwall ×2, hopf/stair/kitskip «все»+бакеты.
      try {
        scene._sawCounts = scene._sawCounts || {};
        if (!SELF_COUNTED428[kind]) scene._sawCounts[kind] = (scene._sawCounts[kind] || 0) + 1;
      } catch (e) {}
      scene._sawLog.push({
        t: Math.round(now / 1000),
        nm: me.playerName || '?',
        kind: kind || '?',
        n: parts.join('/'),
        x: Math.round(me.x), y: Math.round(me.y),
        g: (Number.isFinite(ai._dbgGoalX) ? Math.round(ai._dbgGoalX) : '?'),
        hp: Math.round(me.hp) + '/' + Math.round(me.maxHp || 100),
        det: Math.max(0, Math.round(((ai._detourUntil || 0) - now) / 100)),
        src: ai._dbgSrc || '?',
        mv: (moved == null ? '?' : moved),
        via: [ai._dbgPatPrev, ai._dbgDropWhy].filter(Boolean).join('/') || '-',
        note: note || null,
        // Дуэль или зацикл (k235): держит ли цель + свежий ли выстрел.
        // foc=1/fire-свежий/hp падает = бой (норма), иначе — петля.
        foc: (ai._lastTarget && !ai._lastTarget.dead) ? 1 : 0,
        fire: (() => { try {
          if (ai._dbgLastShotAt) {
            const _s = Math.round((now - ai._dbgLastShotAt) / 1000);
            return _s <= 30 ? _s + 's' : '-';
          }
        } catch (e) {} return '-'; })(),
        // Состояние зацепа (k251): точка патруля/реверса, остаток отката,
        // стены L/R, лок курса. Покажет точный механизм петли.
        pt: (() => { try {
          return (ai.patrolTarget != null && Number.isFinite(ai.patrolTarget))
            ? Math.round(ai.patrolTarget) : '-';
        } catch (e) { return '-'; } })(),
        stk: (() => { try {
          return Math.max(0, Math.round(((ai._stuckReverse || 0) - now) / 100));
        } catch (e) { return 0; } })(),
        bl: (() => { try {
          const _b = me.body;
          return (_b ? ((_b.blocked?.left ? 1 : 0) + '' + (_b.blocked?.right ? 1 : 0)) : '--');
        } catch (e) { return '--'; } })(),
        lock: (() => { try {
          const _mc = ai._moveCommit;
          if (_mc && _mc.lockUntil && now < _mc.lockUntil && _mc.lockDir) {
            return (_mc.lockDir > 0 ? 'R' : 'L') + Math.max(0, Math.round((_mc.lockUntil - now) / 100));
          }
        } catch (e) {} return '-'; })()
      });
      if (scene._sawLog.length > 400) scene._sawLog.splice(0, scene._sawLog.length - 400);
      // k373: по видам — частые (spin/strafe/chskip) не вытесняют редкие
      // (detdrop/wedge/goldgive): последних 30 каждого вида + общий кап 400.
      try {
        let _nk373 = 0;
        for (let i = 0; i < scene._sawLog.length; i++) if (scene._sawLog[i] && scene._sawLog[i].kind === kind) _nk373++;
        if (_nk373 > 30) {
          for (let i = 0; i < scene._sawLog.length; i++) {
            if (scene._sawLog[i] && scene._sawLog[i].kind === kind) { scene._sawLog.splice(i, 1); break; }
          }
        }
      } catch (eCap) {}
    } catch (e) {}
}

// Журнал остановок (k234): стою дольше 2с — сколько и почему (набор
// гейтов за стоянку). Пишется сам. Пустое why = стоим без гейта.
export function logStop(scene, ai, secs, whys) {
    try {
      if (!ai || !ai.player) return;
      const me = ai.player;
      scene._stopLog = scene._stopLog || [];
      // k286: гол в строке (диагноз немых стоянок: куда хотел vs где встал).
      let _gg = '?';
      try {
        _gg = (Number.isFinite(ai._dbgGoalX) ? Math.round(ai._dbgGoalX) : '?') + ',' +
          (Number.isFinite(ai._dbgGoalY) ? Math.round(ai._dbgGoalY) : '?');
      } catch (e) {}
      scene._stopLog.push({
        t: Math.round(((scene.time && scene.time.now) || 0) / 1000),
        nm: me.playerName || '?',
        dur: secs,
        why: (whys && whys.length ? whys.join('+') : '?'),
        x: Math.round(me.x), y: Math.round(me.y),
        g: _gg,
        // k347: причина последнего дёргания анти-стака (пишется в момент
        // записи — одномоментно, в отличие от wdet/detX времени копии).
        wg: (() => { try { return ai._wedgeWhy || '-'; } catch (eW) { return '?'; } })(),
        // k287: снимок руля (src/гол/dir/упор на момент стоянки).
        // k294: ловушка arrive-стоянок у дома (k293: пачка arrive 3с на
        // 3230-3270 в ctfAttack — каждая жизнь 3с в дедбенде, потом k254
        // толкает к флагу). Пишем узел цепочки/точки: чем ждёт стоящий.
        snap: (() => { try {
          const _sn = ai._stopSnap;
          if (!_sn) return '?';
          let _s = `${_sn.src}/${_sn.gx != null ? _sn.gx : '?'}/${_sn.dir}/${_sn.blk}`;
          // k310: ловушки в НЕЗАВИСИМЫХ try — раньше общий catch(e2) мог
          // молча гасить ?-ловушку из-за чиха в arrive-ветке.
          try {
            if (whys && whys.indexOf('arrive') >= 0) {
              const _ch = ai._laneChain, _ci = ai._laneIdx, _cd = !!ai._laneDone;
              const _cn = (_ch && _ci != null) ? _ch[_ci] : null;
              let _feet = me.y + 28;
              try { _feet = ai._navFeetY(); } catch (eF) {}
              const _ndy = (_cn && Number.isFinite(_cn.y)) ? Math.round(_cn.y - _feet) : '?';
              const _wp = ai._ctfWp, _wi = ai._ctfWpIdx;
              const _wdy = (_wp && Number.isFinite(_wp.y)) ? Math.round(_wp.y - _feet) : '?';
              _s += ` ch${_ci != null ? _ci : '?'}/${_cd ? 1 : 0}/${_cn ? Math.round(_cn.x) : '?'},${_ndy}` +
                ` wp${_wi != null ? _wi : '?'}/${_wp ? Math.round(_wp.x) : '?'},${_wdy}` +
                ` rt${ai._ctfRoute || '?'}`;
              // k323: ловушка цепи v2 — k322 (увод 80→150) пачку не снял:
              // Молния 2x ch2/0/749,-170 на 767,722 всё ещё arrive+climb+det.
              // Проверяю испод Mog: потолок над головой, стена впереди, край.
              // Только чтения.
              try {
                let _bu = '?';
                try { const _bdA = me.body; _bu = (_bdA && _bdA.blocked && _bdA.blocked.up) ? 1 : 0; } catch (eBU) {}
                let _wlA = '-', _wrA = '-';
                try { _wlA = ai.wallAhead ? (ai.wallAhead(-1) ? 'W' : '-') : '-'; } catch (eWLA) {}
                try { _wrA = ai.wallAhead ? (ai.wallAhead(1) ? 'W' : '-') : '-'; } catch (eWRA) {}
                let _cbA = '-';
                try { _cbA = (ai._climbBest != null && Number.isFinite(ai._climbBest)) ? Math.round(ai._climbBest) : '-'; } catch (eCBA) {}
                _s += ` up${_bu}/w${_wlA}${_wrA}/cl${_cbA}`;
              } catch (eA2) {}
            }
          } catch (e2) {}
          try {
            // k299: ловушка НЕМЫХ стоянок (k298: шесть ? по 30-66с на
            // 2918,452 — руль пуст, гейтов нет). Кто паркует: остаток окон
            // det/hold/climb/back + хвост руля + цель детура.
            if (!whys || !whys.length || whys.join('+') === '?') {
              // k314: _nw — общий для обеих ловушек (был заперт в try
              // wdet-ветки: якорь его не видел, ReferenceError гасился
              // catch — отсюда немые seen?/give? при живых чтениях).
              const _nw = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
              try {
                const _rem = (v) => (v != null && v > _nw) ? Math.max(0, Math.round((v - _nw) / 100) / 10) + 'с' : '-';
                const _dh = (() => { try { return (ai._dbgDirHist || '').slice(-6) || '-'; } catch (eH) { return '?'; } })();
                const _dx = (ai._detourX != null && _nw < (ai._detourUntil || 0)) ? Math.round(ai._detourX) : '-';
                _s += ` wdet${_rem(ai._detourUntil)} whold${_rem(ai._holdMoveUntil)}` +
                  ` wclimb${_rem(ai._climbAt)} wback${_rem(ai._backUntil)} dh${_dh} detX${_dx}`;
                // k412: исход руля (штамп moveToward, сброс каждый тик —
                // '-' = moveToward не звали, стоянка из прямой ветки).
                try { _s += ` veto${ai._dbgVeto || '-'}`; } catch (eV) {}
              } catch (eW) {}
              // k312: ловушка ЯКОРЯ (Сармат ? 10-14с в пути к 2660,470 —
              // det пуст, руль жмёт). Для HoldHigh-ветки: дистанция до якоря,
              // свежесть врага (сбрасывает 60с-спасатель), остаток спасателя.
              // k314: финал — только простые чтения/сравнения, без Math.
              try {
                const _srcH = (ai._dbgSrc || '');
                if (_srcH === 'ctfHoldHigh' || _srcH === 'ctfHold') {
                  const _scH = ai.scene, _meH = ai.player;
                  const _MW = (_scH && _scH.mapWidth) || 3800, _MH = (_scH && _scH.mapHeight) || 900;
                  const _axH = (_meH.team === 'blue') ? _MW * 0.70 : _MW * 0.30;
                  const _ayH = _MH - 430;
                  const _adH = Math.round(Math.hypot(_axH - _meH.x, _ayH - _meH.y));
                  let _seenAge = '?';
                  try {
                    const _t1 = ai._lastTgtAt || 0, _t2 = ai._lastSeenAt || 0;
                    const _t = _t1 > _t2 ? _t1 : _t2;
                    if (_t > 0 && _nw && (_nw - _t) >= 0) _seenAge = (((_nw - _t) / 1000) | 0) + 'с';
                    else if (_t > 0) _seenAge = 'old';
                    else _seenAge = '-';
                  } catch (eSA) { _seenAge = '?'; }
                  let _give = '?';
                  try {
                    const _has = (ai._hhAnchorSince != null);
                    let _fresh = false;
                    try {
                      const _a = ai._lastTgtAt || 0, _b = ai._lastSeenAt || 0;
                      const _m = _a > _b ? _a : _b;
                      if (_nw && _m > 0 && (_nw - _m) >= 0 && (_nw - _m) < 5000) _fresh = true;
                    } catch (eF) {}
                    _give = !_has ? 'new' : (_fresh ? 'reset' : 'ticking');
                  } catch (eG) { _give = '?'; }
                  _s += ` anch${_adH} seen${_seenAge} give${_give}`;
                }
              } catch (eH2) {}
            }
          } catch (e2) {}
          try {
            // k317: ловушка губы плато (Сталь anch1792 стоит 133с в 868,452,
            // детур тянет на запад detX705). Только чтения: вёл ли граф или
            // лоб (navI/len/nd/goal), какой детур (side/fails/cont) и ноги
            // vs губа (feet/wall/climb). Независимый try (k310), стреляет и
            // на why=det, а не только на ? — иначе маятник не доказать.
            const _srcG = (ai._dbgSrc || '');
            if (_srcG === 'ctfHoldHigh' || _srcG === 'ctfHold') {
              const _ni = (ai._navI || 0);
              const _nl = ((ai._navPath && ai._navPath.length) || 0);
              let _nd = '-';
              try {
                // k318: чиню NaN (k317 читал узел как {x,y}, а _navPath —
                // индексы в _navGraph.nodes, как в EnemyAI nd выше).
                const _gg = ai.scene && ai.scene._navGraph;
                const _pp = ai._navPath, _ii = ai._navI || 0;
                if (_gg && _pp && _ii < _pp.length && _gg.nodes[_pp[_ii]]) {
                  _nd = Math.round(_gg.nodes[_pp[_ii]].x) + ',' + Math.round(_gg.nodes[_pp[_ii]].y);
                } else if (_pp && !_pp.length) _nd = 'empty';
              } catch (eND) {}
              let _ng = '-';
              try {
                if (ai._navGoal && Number.isFinite(ai._navGoal.x)) {
                  _ng = Math.round(ai._navGoal.x) + ',' + Math.round(ai._navGoal.y);
                }
              } catch (eNG) {}
              let _feetG = '?', _wl = '-', _wr = '-';
              try { _feetG = Math.round(ai._navFeetY()); } catch (eFG) {}
              try { _wl = ai.wallAhead ? (ai.wallAhead(-1) ? 'W' : '-') : '-'; } catch (eWL) {}
              try { _wr = ai.wallAhead ? (ai.wallAhead(1) ? 'W' : '-') : '-'; } catch (eWR) {}
              const _ds = (ai._detourSide != null ? ai._detourSide : '?');
              const _cf = (ai._coverFails != null ? ai._coverFails : '?');
              let _dc = '-';
              try {
                const _t0 = ai._detContSince || 0;
                const _tn = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                if (_t0 && _tn > _t0) _dc = Math.round((_tn - _t0) / 100) / 10 + 'с';
              } catch (eDC) {}
              let _cb = '-';
              try { _cb = (ai._climbBest != null && Number.isFinite(ai._climbBest)) ? Math.round(ai._climbBest) : '-'; } catch (eCB) {}
              // k321: ловушка губы v2 — k320 не закрыл (Клинок 3.4с nav1/6/1060,470
              // feet612 — тот же узел 1060,470, что у Кедра в k319; вертикаль 142
              // в пределе 210, но стоит why=?). Нужны dx/dy до узла, потолок над
              // разбегом, счётчик продлений верха и from — только чтения, без
              // climbTakeoff (он пишет _climbBlocked — ловушка обязана не влиять).
              let _dxN = '?', _dyN = '?', _blk = '?', _upN = '?', _fr = '?';
              try {
                const _gg2 = ai.scene && ai.scene._navGraph;
                const _pp2 = ai._navPath, _ii2 = ai._navI || 0;
                const _nn2 = (_gg2 && _pp2 && _ii2 < _pp2.length) ? _gg2.nodes[_pp2[_ii2]] : null;
                const _me2 = ai.player;
                let _feet2 = _me2 ? _me2.y + 28 : 0;
                try {
                  const _bd2 = _me2 && _me2.body;
                  if (_bd2 && Number.isFinite(_bd2.y) && Number.isFinite(_bd2.height)) _feet2 = _bd2.y + _bd2.height;
                } catch (eF2) {}
                if (_nn2 && _me2 && Number.isFinite(_nn2.x)) {
                  _dxN = Math.round(_nn2.x - _me2.x);
                  _dyN = Math.round(_nn2.y - _feet2);
                }
              } catch (eXY) {}
              try { _blk = ai._climbBlocked ? 1 : 0; } catch (eB) {}
              try { _upN = (ai._navUpN != null ? ai._navUpN : 0); } catch (eU) {}
              try { _fr = (ai._navFrom != null ? ai._navFrom : '-'); } catch (eFR) {}
              _s += ` nav${_ni}/${_nl}/${_nd}/g${_ng} detS${_ds}/f${_cf}/c${_dc} feet${_feetG}/w${_wl}${_wr}/cl${_cb} dx${_dxN}/dy${_dyN}/blk${_blk}/up${_upN}/fr${_fr}`;
            }
          } catch (eG) {}
          try {
            // k326: ловушка золотого коридора — носильщик sudden в одной точке
            // третий дамп подряд (Вихрь k321, Хан k322, Смерч k325: 2297-2298,332
            // g3580,332 detX~2150 запад при голе восток, dh++++++ восток).
            // detX уже есть в ?-ветке, но why=det (t494 75.3с) её не показывает.
            // Нужно: ноги/стены/детур + dx/dy до гола. Только чтения, стреляет
            // при любом why.
            const _srcC = (ai._dbgSrc || '');
            if (_srcC === 'ctfSuddenCarry') {
              const _meC = ai.player;
              let _feetC = '?';
              try { _feetC = Math.round(ai._navFeetY()); } catch (eFC) {}
              let _wlC = '-', _wrC = '-';
              try { _wlC = ai.wallAhead ? (ai.wallAhead(-1) ? 'W' : '-') : '-'; } catch (eWLC) {}
              try { _wrC = ai.wallAhead ? (ai.wallAhead(1) ? 'W' : '-') : '-'; } catch (eWRC) {}
              const _dsC = (ai._detourSide != null ? ai._detourSide : '?');
              const _cfC = (ai._coverFails != null ? ai._coverFails : '?');
              // k328: цикл не виден (k327 не снял: Казак 6x 2297 detS-1, руль
              // восток, wback0.5 почти везде). Нужны направление шага назад,
              // возраст непрерывного детура и счётчик зацикливания — только
              // чтения.
              let _bdC = '?', _dcC = '-', _snC = '?';
              try { _bdC = (ai._backDir != null ? ai._backDir : '?'); } catch (eBDC) {}
              try {
                const _t0C = ai._detContSince || 0;
                const _tnC = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                if (_t0C && _tnC > _t0C) _dcC = Math.round((_tnC - _t0C) / 100) / 10 + 'с';
              } catch (eDCC) {}
              try { _snC = (ai._detourStuck && ai._detourStuck.n != null) ? ai._detourStuck.n : '?'; } catch (eSNC) {}
              let _dxC = '?', _dyC = '?';
              try {
                if (_meC && Number.isFinite(ai._dbgGoalX)) {
                  _dxC = Math.round(ai._dbgGoalX - _meC.x);
                  let _fC = _meC.y + 28;
                  try {
                    const _bdC = _meC.body;
                    if (_bdC && Number.isFinite(_bdC.y) && Number.isFinite(_bdC.height)) _fC = _bdC.y + _bdC.height;
                  } catch (eFCC) {}
                  if (Number.isFinite(ai._dbgGoalY)) _dyC = Math.round(ai._dbgGoalY - _fC);
                }
              } catch (eXYC) {}
              _s += ` gold dx${_dxC}/dy${_dyC} feet${_feetC}/w${_wlC}${_wrC} detS${_dsC}/f${_cfC} back${_bdC}/cont${_dcC}/stuck${_snC}`;
              // k329: сторона -1 не переворачивается (k328: back-1=detS-1 —
              // осцилляции нет, руль восток). Нужны входы выбора стороны:
              // свободны ли посадки запад/восток, куда хочет задача, ключ
              // fails-бакета. Только чтения (free() — чистая проверка).
              try {
                const _meQ = ai.player;
                let _myQ = _meQ ? _meQ.y : 0;
                let _feetKQ = 0;
                try {
                  const _bdQ = _meQ && _meQ.body;
                  const _fQ = (_bdQ && Number.isFinite(_bdQ.y) && Number.isFinite(_bdQ.height))
                    ? _bdQ.y + _bdQ.height : _meQ.y + 28;
                  _feetKQ = Math.floor(_fQ / 250);
                } catch (eFKQ) {}
                // Посадки как в smartDetour (дист 180 — штатный для верха;
                // при эскалации посадки дальше, это видно по f>=3):
                // free = нет солида в 4 точках столба.
                const _freeQ = (x) => {
                  try {
                    if (typeof ai._pointInSolid !== 'function') return '?';
                    if (ai._pointInSolid(x, _myQ - 24)) return 0;
                    if (ai._pointInSolid(x, _myQ - 50)) return 0;
                    if (ai._pointInSolid(x, _myQ - 8)) return 0;
                    if (ai._pointInSolid(x, _myQ + 14)) return 0;
                    return 1;
                  } catch (eFQ) { return '?'; }
                };
                let _lQ = '?', _rQ = '?', _wQ = '?';
                try {
                  _lQ = _freeQ(_meQ.x - 180); _rQ = _freeQ(_meQ.x + 180);
                  const _gxQ = Number.isFinite(ai._dbgGoalX) ? ai._dbgGoalX : null;
                  _wQ = (_gxQ != null && Math.abs(_gxQ - _meQ.x) > 100)
                    ? (_gxQ > _meQ.x ? 1 : -1) : 0;
                } catch (eLRQ) {}
                _s += ` key${Math.round(_meQ.x / 50)}:${_feetKQ} l${_lQ}/r${_rQ}/want${_wQ}`;
              } catch (eKQ) {}
            }
          } catch (eGC) {}
          try {
            // k336: ловушка ФЕТЧА sudden (Рысь 11x 867,452 why=? dh++++++
            // detX- к голу 1900 восток; Гусар/Молот/Клинок 1520,722 why=det
            // snap dir0 — детур активен, но стоим). Существующие ловушки
            // мимо: ?-ветка даёт wdet/dh/detX, но не ноги/стены/нав/детур;
            // губа k317 стреляет только на HoldHigh/Hold, золото k326 —
            // только на ctfSuddenCarry. Только чтения, при любом why.
            // k338: расширена на ctfAttack/ctfCarry — k337 убрал detX-назад
            // (Страж 867 detX712→-, Ураган 2917 detX3054→-), но стоянки
            // остались (wback0.5+dh++++++, у Рыси blk1): чем стоит — не видно.
            const _srcF = (ai._dbgSrc || '');
            // k381: sudden-эскорт тоже в fetch-ловушку (Шторм k380: цемент
            // wide27-37 с nowipe сидит в ctfSuddenEscort — без сегмента
            // владелец руля не виден). Только журнал, поведения ноль.
            if (_srcF === 'ctfSuddenFetch' || _srcF === 'ctfAttack' || _srcF === 'ctfCarry' || _srcF === 'ctfSuddenEscort') {
              const _meF = ai.player;
              let _feetF = '?', _wlF = '-', _wrF = '-';
              try { _feetF = Math.round(ai._navFeetY()); } catch (eFF) {}
              try { _wlF = ai.wallAhead ? (ai.wallAhead(-1) ? 'W' : '-') : '-'; } catch (eWLF) {}
              try { _wrF = ai.wallAhead ? (ai.wallAhead(1) ? 'W' : '-') : '-'; } catch (eWRF) {}
              let _ndF = '-', _ngF = '-';
              try {
                const _ggF = ai.scene && ai.scene._navGraph;
                const _ppF = ai._navPath, _iiF = ai._navI || 0;
                if (_ggF && _ppF && _iiF < _ppF.length && _ggF.nodes[_ppF[_iiF]]) {
                  _ndF = Math.round(_ggF.nodes[_ppF[_iiF]].x) + ',' + Math.round(_ggF.nodes[_ppF[_iiF]].y);
                } else if (_ppF && !_ppF.length) _ndF = 'empty';
              } catch (eNDF) {}
              try {
                if (ai._navGoal && Number.isFinite(ai._navGoal.x)) {
                  _ngF = Math.round(ai._navGoal.x) + ',' + Math.round(ai._navGoal.y);
                }
              } catch (eNGF) {}
              const _niF = (ai._navI || 0);
              const _nlF = ((ai._navPath && ai._navPath.length) || 0);
              const _dsF = (ai._detourSide != null ? ai._detourSide : '?');
              const _cfF = (ai._coverFails != null ? ai._coverFails : '?');
              let _dcF = '-';
              try {
                const _t0F = ai._detContSince || 0;
                const _tnF = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                if (_t0F && _tnF > _t0F) _dcF = Math.round((_tnF - _t0F) / 100) / 10 + 'с';
              } catch (eDCF) {}
              let _dxF = '?', _dyF = '?', _blkF = '?', _bdF = '?';
              try {
                if (_meF && Number.isFinite(ai._dbgGoalX)) {
                  _dxF = Math.round(ai._dbgGoalX - _meF.x);
                  let _fF = _meF.y + 28;
                  try {
                    const _bbF = _meF.body;
                    if (_bbF && Number.isFinite(_bbF.y) && Number.isFinite(_bbF.height)) _fF = _bbF.y + _bbF.height;
                  } catch (eFF2) {}
                  if (Number.isFinite(ai._dbgGoalY)) _dyF = Math.round(ai._dbgGoalY - _fF);
                }
              } catch (eXYF) {}
              try { _blkF = ai._climbBlocked ? 1 : 0; } catch (eBF) {}
              try { _bdF = (ai._backDir != null ? ai._backDir : '?'); } catch (eBDF) {}
              // k356: форт-2917 рецидив (k355: 7 STOP why=? wg=flat nav0/0
              // detX- dh------ при голе в ~250 на том же ярусе, w-- blk0/1:
              // свеж ли гол, что с рулём сейчас, свободен ли путь к голу —
              // иначе вслепую не чинить, было k300/k301). Только чтения.
              let _gaF = '?', _drF = '?', _pF = '-';
              try {
                const _tnG = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                if (Number.isFinite(ai._dbgGoalAt) && _tnG > ai._dbgGoalAt) _gaF = Math.round((_tnG - ai._dbgGoalAt) / 100) / 10;
              } catch (eGAF) {}
              try { const _ddF = Number(ai._dbgDir); _drF = (_ddF > 0 ? '+' : (_ddF < 0 ? '-' : '0')); } catch (eDRF) {}
              try {
                if (_meF && Number.isFinite(ai._dbgGoalX) && typeof ai._pointInSolid === 'function') {
                  const _sD = Math.sign(ai._dbgGoalX - _meF.x);
                  if (_sD !== 0) {
                    const _adx = Math.abs(ai._dbgGoalX - _meF.x);
                    const _colF = (x) => {
                      try {
                        if (ai._pointInSolid(x, _meF.y - 24)) return 0;
                        if (ai._pointInSolid(x, _meF.y - 50)) return 0;
                        if (ai._pointInSolid(x, _meF.y - 8)) return 0;
                        if (ai._pointInSolid(x, _meF.y + 14)) return 0;
                        return 1;
                      } catch (eCF2) { return '?'; }
                    };
                      let _pp = '';
                      [60, 130, 250].forEach(_st => { _pp += (_st > _adx ? '.' : _colF(_meF.x + _sD * _st)); });
                      _pF = _pp;
                  } else _pF = 'here';
                }
              } catch (ePF) {}
              // k358: форт-v2 (k356 `p` не рассудил: 2917-`p00.`, 1487-`p111`
              // при том же почерке; плюс хвосты — конец стоянки, часто прыжок:
              // сэмпл едет по прыжковой геометрии). Побитовые высоты на ПЕРВОЙ
              // запертой ступени (порядок -50/-24/-8/+14: 1111 стена, 0001 губа,
              // 1000 потолок) + ab-полёт (ab1 — сэмпл suspect, взят в прыжке).
              // Только чтения.
              let _hF = '....', _abF = '?';
              try {
                const _bAB = _meF.body;
                _abF = (_bAB && (_bAB.blocked?.down || _bAB.touching?.down)) ? 0 : 1;
              } catch (eABF) {}
              try {
                if (_pF && _pF.indexOf('0') >= 0 && Number.isFinite(ai._dbgGoalX) && typeof ai._pointInSolid === 'function') {
                  const _sD2 = Math.sign(ai._dbgGoalX - _meF.x);
                  const _adx2 = Math.abs(ai._dbgGoalX - _meF.x);
                  const _steps2 = [60, 130, 250];
                  let _bx = null;
                  const _colH = (x) => {
                    try {
                      if (ai._pointInSolid(x, _meF.y - 24)) return 0;
                      if (ai._pointInSolid(x, _meF.y - 50)) return 0;
                      if (ai._pointInSolid(x, _meF.y - 8)) return 0;
                      if (ai._pointInSolid(x, _meF.y + 14)) return 0;
                      return 1;
                    } catch (eCH) { return '?'; }
                  };
                  for (let _si = 0; _si < _steps2.length; _si++) {
                    if (_steps2[_si] > _adx2) break;
                    const _xx = _meF.x + _sD2 * _steps2[_si];
                    let _hit = false;
                    try {
                      _hit = !!(_colH(_xx) === 0);
                    } catch (eHB) { _hit = false; }
                    if (_hit) { _bx = _xx; break; }
                  }
                  if (_bx != null) {
                    const _one = (y) => { try { return ai._pointInSolid(_bx, y) ? 1 : 0; } catch (eO) { return '?'; } };
                    _hF = '' + _one(_meF.y - 50) + _one(_meF.y - 24) + _one(_meF.y - 8) + _one(_meF.y + 14);
                  }
                }
              } catch (eHF) {}
              _s += ` fetch nav${_niF}/${_nlF}/${_ndF}/g${_ngF} detS${_dsF}/f${_cfF}/c${_dcF} feet${_feetF}/w${_wlF}${_wrF} dx${_dxF}/dy${_dyF}/blk${_blkF}/back${_bdF} ga${_gaF}/dir${_drF}/p${_pF}/h${_hF}/ab${_abF}`;
              // k365: нутро нав-плана на подъёме (Молот/Мороз/Атаман k361:
              // 15–29с под золотом dy-418, nav0/0–4, latch вторичен — есть ли
              // план, где виснет, жрёт ли продление _upNode). Тройка узлов от
              // I + счётчик продлений + возраст часов сталла. Только чтения.
              try {
                const _ppF = ai._navPath, _iiF2 = ai._navI || 0;
                const _ggF = ai.scene && ai.scene._navGraph;
                let _t0 = '-', _t1 = '-', _t2 = '-';
                try {
                  const _gN = (k) => {
                    if (!_ggF || !_ppF || k < 0 || k >= _ppF.length) return '-';
                    const _nd = _ggF.nodes[_ppF[k]];
                    return (_nd && Number.isFinite(_nd.x)) ? Math.round(_nd.x) + ',' + Math.round(_nd.y) : '-';
                  };
                  _t0 = _gN(_iiF2); _t1 = _gN(_iiF2 + 1); _t2 = _gN(_iiF2 + 2);
                } catch (eTN) {}
                let _upF = '?', _niF2 = '?';
                try { _upF = (ai._navUpN != null ? ai._navUpN : '?'); } catch (eUF) {}
                try {
                  const _tnN = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                  if (Number.isFinite(ai._navNiAt) && _tnN > ai._navNiAt) _niF2 = Math.round((_tnN - ai._navNiAt) / 100) / 10;
                } catch (eNF2) {}
                _s += ` np${_t0}/${_t1}/${_t2} up${_upF} ni${_niF2}`;
              } catch (eNP) {}
              // k366: состояние попыток подъёма (Молот/Мороз k361 + Гусар/Север
              // k365: beach под high-голом — golden сдаётся молча (k286), следов
              // climb нет: кто вёлся (take), рос ли (best/age), жив ли прямой
              // лаз (direct), что за край (best/key) и табу. Только чтения.
              try {
                const _nwU = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                let _gtU = '-', _gbU = '?', _gaU = '?';
                try {
                  const _gpU = ai._goldenProg;
                  if (_gpU) {
                    _gtU = (_gpU.take != null ? _gpU.take : '?');
                    _gbU = (Number.isFinite(_gpU.best) ? Math.round(_gpU.best) : '?');
                    if (Number.isFinite(_gpU.at) && _nwU > _gpU.at) _gaU = Math.round((_nwU - _gpU.at) / 100) / 10;
                  }
                } catch (eGU) {}
                let _dcU = '-';
                try {
                  const _du = ai._directClimbUntil;
                  _dcU = (_du != null && _du > _nwU) ? Math.round((_du - _nwU) / 100) / 10 + 'с' : '-';
                } catch (eDU) {}
                let _cbU = '-', _ckU = '-', _tbU = '-';
                try {
                  _cbU = (ai._climbBest != null && Number.isFinite(ai._climbBest)) ? Math.round(ai._climbBest) : '-';
                  _ckU = (ai._climbKey != null ? String(ai._climbKey).slice(-11) : '-');
                  const _tb = ai._climbTaboo;
                  if (_tb && _tb.until > _nwU) _tbU = Math.round((_tb.until - _nwU) / 100) / 10 + 'с';
                } catch (eCU) {}
                _s += ` lift gold${_gtU}/best${_gbU}/age${_gaU} direct${_dcU} cl${_cbU}/${_ckU}/taboo${_tbU}`;
              } catch (eUP) {}
              // k381: владелец руля (Шторм k380: тело стоит на 737, а план
              // идёт nav1→10 с nowipe — кто держит руль каждый тик и куда
              // давит). Последний moveToward-таргет (dx), контакт тела,
              // _navClimb, жив ли детур. Только чтения.
              try {
                let _mtV = '?';
                try { if (_meF && Number.isFinite(ai._dbgTar)) _mtV = Math.round(ai._dbgTar - _meF.x); } catch (eMV1) {}
                let _blV = '-';
                try {
                  const _bV = _meF.body;
                  if (_bV && _bV.blocked) _blV = ((_bV.blocked.left ? 'L' : '') + (_bV.blocked.right ? 'R' : '')) || '-';
                } catch (eMV2) {}
                let _ncV = '?';
                try { _ncV = ai._navClimb ? 1 : 0; } catch (eMV3) {}
                let _dtV = '-';
                try {
                  const _tnV = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
                  if (ai._detourUntil != null && ai._detourUntil > _tnV) _dtV = Math.round((ai._detourUntil - _tnV) / 100) / 10 + 'с';
                } catch (eMV4) {}
                _s += ` mv mt${_mtV}/bl${_blV}/nc${_ncV}/dt${_dtV}`;
              } catch (eMV) {}
              // k388: профиль ступени (Рысь/Старшина k387: вход доказан
              // t=0+STRAIL+зеркалом, выход только на запад — ступень с
              // востока выше прыжка? h даёт 4 бита без позиции). Полная
              // колонка 9 бит в первой запертой точке + dx до неё.
              // Только чтения.
              try {
                if (_meF && Number.isFinite(ai._dbgGoalX) && typeof ai._pointInSolid === 'function') {
                  const _sD3 = Math.sign(ai._dbgGoalX - _meF.x);
                  if (_sD3 !== 0) {
                    let _fE = _meF.y + 28;
                    try {
                      const _bbE = _meF.body;
                      if (_bbE && Number.isFinite(_bbE.y) && Number.isFinite(_bbE.height)) _fE = _bbE.y + _bbE.height;
                    } catch (eFE) {}
                    const _adxE = Math.abs(ai._dbgGoalX - _meF.x);
                    const _solE = (x, y) => { try { return !!ai._pointInSolid(x, y); } catch (eSE) { return false; } };
                    let _bxE = null;
                    for (const _stE of [60, 130, 250]) {
                      if (_stE > _adxE) break;
                      const _xxE = _meF.x + _sD3 * _stE;
                      if (_solE(_xxE, _fE - 24) || _solE(_xxE, _fE - 50) || _solE(_xxE, _fE - 8) || _solE(_xxE, _fE + 14)) { _bxE = _xxE; break; }
                    }
                    if (_bxE != null) {
                      let _bits = '';
                      for (const _oy of [-130, -110, -90, -70, -50, -30, -10, 10, 30]) {
                        try { _bits += ai._pointInSolid(_bxE, _fE + _oy) ? '1' : '0'; } catch (eEB) { _bits += '?'; }
                      }
                      _s += ` eh${Math.round(_bxE - _meF.x)}_${_bits}`;
                    }
                  }
                }
              } catch (eEH) {}
            }
          } catch (eGF) {}
          // k361: защёлка-heal (k360: 5-6 стендов latch 10-20с в heal-ветке
          // 707-794 + Гранит 26.9+9.7: heal не в _noLatch (move.js) — сидит
          // на точке; фантом (вдали от _nearX) или реальная (пак? узел?).
          // nearX/возраст/счётчик k282/dx до точки/hp/остаток скипа.
          // Только чтения.
          try {
            if (whys && whys.indexOf('latch') >= 0) {
              const _nwL = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
              let _nxL = '?', _ageL = '?', _nL = '?', _dxL = '?', _hpL = '?', _skL = '-';
              try { if (Number.isFinite(ai._nearX)) _nxL = Math.round(ai._nearX); } catch (eNXL) {}
              try {
                if (Number.isFinite(ai._nearAt) && _nwL > ai._nearAt) _ageL = Math.round((_nwL - ai._nearAt) / 100) / 10;
              } catch (eAGL) {}
              try {
                const _lhL = ai._latchHist;
                if (_lhL) {
                  _nL = (_lhL.n != null ? _lhL.n : '?');
                  if (Number.isFinite(_lhL.t) && _nwL > _lhL.t) _ageL = Math.round((_nwL - _lhL.t) / 100) / 10 + 'h';
                }
              } catch (eNHL) {}
              try { if (Number.isFinite(ai._nearX) && me) _dxL = Math.round(me.x - ai._nearX); } catch (eDXL) {}
              try { _hpL = (me && Number.isFinite(me.hp)) ? Math.round(me.hp) : '?'; } catch (eHPL) {}
              try {
                const _skV = ai._latchSkipUntil;
                _skL = (_skV != null && _skV > _nwL) ? Math.round((_skV - _nwL) / 100) / 10 + 'с' : '-';
              } catch (eSKL) {}
              _s += ` latch nx${_nxL}/age${_ageL}/n${_nL}/dx${_dxL}/hp${_hpL}/skip${_skL}`;
            }
          } catch (eLT) {}
          // k392: история прыжков пина (k391: hopf-хвост тонет в объёме —
          // 5к выстрелов/матч, классика вытесняется; а кольцо _qr уже хранит
          // 40 последних с t/w). Сколько прыжков за 10с до конца стоянки +
          // топ-причина (wall/up/apex/bonk). Ноль прыжков = гейт молчит,
          // пачка wall = не берёт высота. Только чтения.
          try {
            const _tnQ = (ai.scene && ai.scene.time) ? ai.scene.time.now : 0;
            let _qnQ = 0;
            const _qcQ = {};
            try {
              const _qrQ = ai._jumps || [];
              for (let i = _qrQ.length - 1; i >= 0; i--) {
                const _eQ = _qrQ[i];
                if (!_eQ || _tnQ - (_eQ.t || 0) > 10000) break;
                _qnQ++;
                _qcQ[_eQ.w || '?'] = (_qcQ[_eQ.w || '?'] || 0) + 1;
              }
            } catch (eQQ) {}
            let _qtQ = '-';
            try {
              let _bvQ = 0;
              for (const _kkQ in _qcQ) { if (_qcQ[_kkQ] > _bvQ) { _bvQ = _qcQ[_kkQ]; _qtQ = _kkQ + _bvQ; } }
            } catch (eQT) {}
            _s += ` hq${_qnQ}${_qtQ}`;
          } catch (eHQ) {}
          // k395: аптечки раненого (Ветеран/Сержант k394: минуты src=heal
          // при hp0-16 без подбора — есть ли киты вообще: нет китов =
          // вопрос спавнеру/экономике, не ИИ). Ближайший активный свой
          // кит (dx/dy) + число активных. Только чтения.
          try {
            let _hx = '-', _hy = '-', _hn = 0;
            try {
              const _grp = ai.scene && ai.scene.pickups;
              if (_grp && me && me.team) {
                let _bdH = 1e9, _bkH = null;
                _grp.getChildren().forEach(pk => {
                  try {
                    if (!pk || !pk.active || pk.pickupType !== 'medkit') return;
                    if (pk.team && pk.team !== me.team) return;
                    _hn++;
                    const _ddH = Math.hypot(pk.x - me.x, pk.y - me.y);
                    if (_ddH < _bdH) { _bdH = _ddH; _bkH = pk; }
                  } catch (ePK) {}
                });
                if (_bkH) { _hx = Math.round(_bkH.x - me.x); _hy = Math.round(_bkH.y - me.y); }
              }
            } catch (eHG) {}
            _s += ` hl${_hx}/${_hy}/${_hn}`;
          } catch (eHL) {}
          return _s;
        } catch (e) { return '?'; } })(),
        src: ai._dbgSrc || '?'
      });
      if (scene._stopLog.length > 40) scene._stopLog.splice(0, scene._stopLog.length - 40);
    } catch (e) {}
}

// Журнал убийств (k211): время, кто→кого, ярусы обоих, дистанция, чем.
// Пишется сам весь матч — C в любой момент отдаёт историю целиком.
// Журнал возрождений (k290): кто/где/когда встал — точки спавна и карманы
// на них (стартовые тоже пишутся). Только полный лог, последние 30.
// k383: сдвиг валидатора sh (на сколько подвинули точку: большой sh =
// валидатор спасал плохую точку, sh=0 в кармане = валидатор слеп) + кап 60
// (кап 30 съедал стартовые t=0 при ~30+ респаунах). Только журнал.

