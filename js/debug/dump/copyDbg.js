
export function copyDbg(scene, full) {
  const _dumpBuild = (globalThis.DUMP_BUILD !== undefined) ? globalThis.DUMP_BUILD : 0;
    let text = scene._dbgLatest;
    // k378: явные фазы CTF (§9 ТЗ кодера + наш SUDDEN): состояние флагов
    // своими предикатами движка (дома = hypot<=60 как в ctf.js; унесён =
    // carrier). STABLE/STOLEN/DROPPED/FETCH/FOE_DROPPED. Только чтение,
    // один раз на дамп — в строки ботов (ph) и в [AUTO] (phB/phR).
    let _phB378 = '-', _phR378 = '-';
    try {
      if (scene.mode === 'CTF') {
        const _phFor378 = (own, foe, team) => {
          try {
            if (scene._ctfOvertime) return 'SUDDEN';
            const _fc = foe && foe.carrier;
            if (_fc && _fc.team === team) return 'FETCH';
            const _oc = own && own.carrier;
            if (_oc && _oc.team && _oc.team !== team) return 'STOLEN';
            if (own && !_oc && Number.isFinite(own.x) && Number.isFinite(own.baseX) &&
              Math.hypot(own.x - own.baseX, own.y - own.baseY) > 60) return 'DROPPED';
            if (foe && !_fc && Number.isFinite(foe.x) && Number.isFinite(foe.baseX) &&
              Math.hypot(foe.x - foe.baseX, foe.y - foe.baseY) > 60) return 'FOE_DROPPED';
            return 'STABLE';
          } catch (eP) { return '?'; }
        };
        _phB378 = _phFor378(scene.blueFlag, scene.redFlag, 'blue');
        _phR378 = _phFor378(scene.redFlag, scene.blueFlag, 'red');
      }
    } catch (ePH) {}
    // Страховка пустого итога (k220): C в бою ни разу не жали — строк ботов
    // нет (dbg-цикл не крутился), но журналы (STAT/STEAL/KILL/HIT) копились
    // всегда. Без seed вся сборка ниже пропускалась и копировалось пусто.
    if (!text) text = '(строк ботов нет — C в бою не жали; ниже журналы матча)';
    if (text) {
      const rows = [];
      // k378: фазы посчитаны в начале функции (_phB378/_phR378) — см. выше.
      // Мои координаты — для расчёта pd (дистанция бота до игрока).
      const _mx = scene.player ? scene.player.x : null;
      const _my = scene.player ? scene.player.y : null;
      for (const p of scene.players) {
        if (!p || !p.ai || !p.ai.dbg) continue;
        // Трупы не показываем: update мёртвого возвращается до блока dbg,
        // строка замирает (sdx0/vx0/cl0) и выглядит как фриз живого
        // (k187/k188: «Добрыня стоит»). Живых считает lanes ниже.
        if (p.dead) continue;
        const d = p.ai.dbg;
        // pd — дистанция до меня по прямой; dy — вертикаль со знаком
        // (me.y - bot.y): минус — бот НИЖЕ меня (ему лезть вверх, долго),
        // плюс — бот выше (спустится быстро). Прямая без dy врёт: 500px
        // по прямой при 320 вверх — это ~800+ пути по лесенкам.
        // Короткая строка (C по умолчанию): только для чтения давления.
        // Токены дёргаем из полной строки бота (d.dc) — рантайм не трогаем.
        // Утечка в дуэль видна токеном LEAK (strafe/approach/patrol/noise).
        let _pd = '?', _dy = '?';
        try {
          if (_mx != null && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            _pd = Math.round(Math.hypot(p.x - _mx, p.y - _my));
            _dy = Math.round(_my - p.y);
            if (_dy > 0) _dy = '+' + _dy;
          }
        } catch (e) {}
        const _tok = (re) => {
          try {
            const m = d.dc && d.dc.match(re);
            return m ? m[1] : '-';
          } catch (e2) { return '-'; }
        };
        let _leak = '';
        try {
          const _s = d.dc || '';
          if (_s.indexOf('src+strafe') >= 0 || _s.indexOf('src+approach') >= 0 ||
              _s.indexOf('src+patrol') >= 0 || _s.indexOf('src+noise') >= 0) _leak = ' LEAK';
        } catch (e3) {}
        rows.push(`[${d.name}] ${_tok(/src=(\S+)/)} x=${Math.round(p.x)},${Math.round(p.y)} pd=${_pd} ` +
          `${_tok(/cm=(\S+)/)} rt${_tok(/route=(\S+)/)} L${_tok(/lane=(\S+)/)} g${_tok(/goal=(\S+)/)} nv${_tok(/nav=(\S+)/)} ` +
          `nd${_tok(/nd=(\S+)/)} cl${_tok(/cl=(-?\d+)/)} sdx${_tok(/sdx=(-?\d+)/)} vx${_tok(/vxflip=(\S+)/)} ` +
          `tf${_tok(/txfl=(\d+)/)} rf${_tok(/rf=(\d+)/)} jmp${_tok(/jmp=(\S+)/)} jlp${_tok(/jlp=(\d+)/)} bk${_tok(/bk=(\S+)/)} jl${_tok(/jl=(\S+)/)} jsrc${_tok(/jsrc=(\S+)/)} stp${_tok(/stp=(\S+)/)}` +
          (scene.mode === 'CTF' ? ` ph${(p && p.team === 'red') ? _phR378 : _phB378}` : '') + `${_leak}`);
      }
      if (rows.length) text = rows.join('\n');
      // k373: самопроверка whitelist короткой строки (урок k370): токены живой
      // строки, не попавшие ни в ряд, ни в известный список, — в дамп строкой
      // [ROWCUT], а не молча. Новую ловушку без места в ряду видно сразу.
      try {
        const _rk373 = { src: 1, cm: 1, route: 1, lane: 1, goal: 1, nav: 1, nd: 1, cl: 1, sdx: 1, vxflip: 1, txfl: 1, rf: 1, jmp: 1, jlp: 1, bk: 1, jl: 1, jsrc: 1, stp: 1 };
        const _out373 = { ema: 1, wf: 1, fm: 1, gr: 1, vy: 1, bu: 1, fj: 1, aj: 1, adx: 1, bx: 1, by: 1, tx: 1, bxr: 1, bxfl: 1, dir: 1, tarmin: 1, tarmax: 1, dh: 1, dc: 1, losfl: 1, leash: 1, lvx: 1, vp: 1, vn: 1, bl: 1, br: 1, stk: 1, mt: 1, mvc: 1, enS: 1, visS: 1, pidl: 1, pgen: 1, alr: 1, hlp: 1, role: 1, wp: 1, det: 1, detX: 1, hold: 1, latch: 1, lock: 1, mate: 1, wa: 1, clb: 1, esc: 1, drop: 1, myF: 1, foeF: 1 };
        const _cut373 = {};
        for (const p of scene.players) {
          try {
            const _dc373 = (p && p.ai && p.ai.dbg && p.ai.dbg.dc) || '';
            const _re373 = /(?:^| )([A-Za-z][A-Za-z0-9]*)=/g;
            let _m373;
            while ((_m373 = _re373.exec(_dc373)) !== null) {
              const _kk373 = _m373[1];
              if (!_rk373[_kk373] && !_out373[_kk373]) _cut373[_kk373] = 1;
            }
          } catch (eOne) {}
        }
        const _ck373 = Object.keys(_cut373).sort();
        text += '\n[ROWCUT] ' + (_ck373.length ? 'cut=' + _ck373.join(',') : 'ok');
      } catch (eRC) {}
      // k377: судьба снимка классики — видно в каждом дампе.
      // k394: плюс mid-снапшоты (heldN — копятся, минуты матча).
      try {
        text += '\n[SNAP] classic=' + (scene._classicSnapInfo || 'none');
        try {
          const _mdS = scene._midSnaps || [];
          if (_mdS.length) {
            const _mm = _mdS.map(m => Math.round((m && m.ms || 0) / 1000) + 'с').join(',');
            text += ' mids=held' + _mdS.length + ':' + _mm;
          }
        } catch (eMS) {}
      } catch (eSN) {}
      // АВТОРАЗБОР прямо в дампе: сводка человечьим языком, чтобы не читать
      // длинные строки. pd — до меня, top — бот на моём ярусе (|dx|<150,|dy|<150).
      try {
        const auto = [];
        try {
          const _fps = scene.game && scene.game.loop ? Math.round(scene.game.loop.actualFps) : '?';
          auto.push(`[AUTO] fps=${_fps} t=${Math.round((scene.time ? scene.time.now : 0) / 1000)}s` +
            // k258: ta= — активное время без пауз (сверять с таймером матча),
            // t= — шкала лога (сквозная, включает паузы).
            (() => { try {
              if (scene._modeT0loop && scene.time) return ` ta=${Math.max(0, Math.round((scene.time.now - scene._modeT0loop) / 1000))}s`;
            } catch (e) {} return ''; })() +
            // k378: фазы команд (см. выше).
            (() => { try {
              if (scene.mode === 'CTF') return ` phB=${_phB378} phR=${_phR378}`;
            } catch (e) {} return ''; })() +
            // k550: маркер сборки и срабатываний антиповтора — чтобы по логу
            // было видно, какой код реально играл (кэш ?v= — грабля §1.8).
            (() => { try {
              const _ar = (scene._sawCounts && scene._sawCounts.antirep) || 0;
              const _bt = (scene && scene._codeTag) || 'k621';
              return ` anti=${_ar} build=${_bt}`;
            } catch (e) {} return ''; })());
        } catch (e1) {}
        // Я: hp сейчас и урон за интервал с прошлого C (обнуляется копированием).
        // still — сколько стою на месте (сдвиг <50px).
        // steal — сколько вражеский флаг у меня (реакция погони).
        try {
          const _mp2 = scene.player;
          if (_mp2 && Number.isFinite(_mp2.hp)) {
            let _still = '?';
            try {
              if (scene._youStillSince != null && scene.time) {
                _still = Math.max(0, Math.round((scene.time.now - scene._youStillSince) / 1000)) + 's';
              }
          } catch (eS) {}
            let _steal = '-';
            try {
              const _rf = scene.redFlag;
              const _stolen = !!(_rf && _rf.carrier && !_rf.carrier.dead && _rf.carrier === _mp2);
              if (_stolen) {
                if (scene._stealAt == null) scene._stealAt = scene.time ? scene.time.now : 0;
                _steal = Math.max(0, Math.round(((scene.time ? scene.time.now : 0) - scene._stealAt) / 1000)) + 's';
              } else {
                scene._stealAt = null; scene._arrAt = null; scene._firstHAt = null;
              }
            } catch (eSt) {}
            // Реакция: возраст кражи → первый ДОШЁЛ → первый урон H.
            try {
              if (scene._stealAt != null && scene.time) {
                const _age = (n) => (n != null ? Math.max(0, Math.round((scene.time.now - n) / 1000)) + 's' : '-');
                auto.push(`[AUTO] react=steal${_age(scene._stealAt)} arr${_age(scene._arrAt)} H${_age(scene._firstHAt)}`);
              }
            } catch (eR2) {}
            // Перепись флангов: сколько живых на каждом ярусе числом.
            // Всегда, а не только при краже (иначе в открытом бою не видно).
            try {
              const _cen = (tm) => {
                let L = 0, M = 0, H = 0;
                (scene.players || []).forEach(p => {
                  if (!p || !p.ai || p.team !== tm || p.dead || p.active === false) return;
                  const _ln = p.ai._laneNow;
                  if (_ln === 'high') H++;
                  else if (_ln === 'mid') M++;
                  else L++;
                });
                return `${L}L/${M}M/${H}H`;
              };
              auto.push(`[AUTO] lanes=R${_cen('red')} B${_cen('blue')}`);
            } catch (eC) {}
            auto.push(`[AUTO] YOU hp=${Math.round(_mp2.hp)}/${Math.round(_mp2.maxHp || 100)} ` +
              `hurt+${Math.round(scene._dmgInterval || 0)}/tot${Math.round(scene._dmgTotal || 0)} still=${_still} steal=${_steal}` +
              (() => {
                try {
                  const _il = scene._dmgIntLn || {}, _tl = scene._dmgTotLn || {};
                  return ` [H${Math.round(_il.H || 0)}/M${Math.round(_il.M || 0)}/L${Math.round(_il.L || 0)}]` +
                    `{H${Math.round(_tl.H || 0)}/M${Math.round(_tl.M || 0)}/L${Math.round(_tl.L || 0)}}`;
                } catch (eL2) { return ''; }
              })());
          }
        } catch (eY) {}
        const _me = scene.player;
        const _pdTo = (p) => {
          try {
            if (!_me || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
            return Math.round(Math.hypot(p.x - _me.x, p.y - _me.y));
          } catch (e2) { return null; }
        };
        const _flips = (ai) => {
          try {
            if ((ai._dbgVXFlips || 0) >= 10) return 10;
            const h = (ai._dbgDirHist || '').replace(/0/g, '');
            let f = 0;
            for (let i = 1; i < h.length; i++) if (h[i] !== h[i - 1]) f++;
            return f;
          } catch (e3) { return 0; }
        };
        ['red', 'blue'].forEach(tm => {
          const chasers = [];
          let top = 0;
          (scene.players || []).forEach(p => {
            if (!p || !p.ai || p.team !== tm || p.dead) return;
            const ai = p.ai;
            const cm = (ai._chaseMode || '') + (ai._chaseLane || '');
            const isCh = (cm === 'tail' || (typeof ai._dbgSrc === 'string' && ai._dbgSrc.indexOf('Chase') >= 0));
            if (!isCh && tm === 'red') {
              // Красные без cm, но в погоне (cutoff/base) — тоже давление.
              const s = ai._dbgSrc || '';
              if (s !== 'ctfCutoff' && s !== 'ctfBase') return;
            }
            if (!isCh && tm === 'blue') return;
            const pd = _pdTo(p);
            let dy = null;
            try { dy = (_me && Number.isFinite(p.y)) ? Math.round(_me.y - p.y) : null; } catch (e4) {}
            const arrived = (pd != null && dy != null && pd < 220 && Math.abs(dy) < 150);
            if (arrived) top++;
            const hist = (ai._dbgDirHist || '').slice(-12);
            const stands = hist.length >= 8 && /^0+$/.test(hist);
            chasers.push(`${p.playerName || '?'}[${cm || ai._dbgSrc || '?'}]` +
              ` pd${pd != null ? pd : '?'} dy${dy != null && dy > 0 ? '+' : ''}${dy != null ? dy : '?'}` +
              ` L${ai._laneNow || '?'}` +
              ` nv${ai._navI || 0}/${(ai._navPath && ai._navPath.length) || 0}` +
              ` cl${((ai._clLast || 0) > 0 ? '+' : '')}${ai._clLast || 0}` +
              // Прямое лазание: D + остаток секунд; лучший подъём якоря.
              (() => {
                try {
                  const t = (scene.time ? scene.time.now : 0);
                  const d = Math.max(0, Math.ceil(((ai._directClimbUntil || 0) - t) / 1000));
                  const b = ai._climbAnchor && Number.isFinite(ai._climbAnchor.best)
                    ? Math.round(ai._climbAnchor.best) : null;
                  return (d > 0 ? ` D${d}` : '') + (b != null ? ` mx${b}` : '');
                } catch (e5) { return ''; }
              })() +
              (arrived ? ' ДОШЁЛ' : '') + (stands ? ' СТОИТ' : '') +
              (_flips(ai) >= 5 ? ' ПИЛА' : ''));
          });
          auto.push(`[AUTO] ${tm}=${chasers.length ? chasers.join(' | ') : 'нет давления'}${top ? ` ДОШЛИ:${top}` : ''}`);
        });
        if (auto.length) text += '\n' + auto.join('\n');
        // Авто-диагностика проблемных (k216): симптомы зацикленных сразу
        // в дампе — ловить руками не надо. Окно (jmp/vx) — из строки (2с),
        // ступоры — трекинг между нажатиями C (позиция/узел/фланг).
        // W1 jmp-пила на месте; W2 пила разворотов; W3 узел стоит;
        // W4 топчется на задаче; W5 утечка из погони; W6 носильщик стоит;
        // W7 фланг сполз (rtHigh/rtMid внизу 30с+).
        try {
          const _nowW = (scene.time && scene.time.now) || 0;
          scene._warnWatch = scene._warnWatch || {};
          const _ww = scene._warnWatch;
          const _seenW = {};
          const _wl = [];
          // Живой угон прямо сейчас (k224): W5 — только по нему, иначе ор
          // на протухшую роль (cm=tail без угона — см. чистку в _ctfAct).
          let _theftLive = false;
          try {
            const _bf = scene.blueFlag, _rf = scene.redFlag;
            _theftLive = !!((_bf && _bf.carrier && !_bf.carrier.dead && _bf.carrier.team !== 'blue') ||
              (_rf && _rf.carrier && !_rf.carrier.dead && _rf.carrier.team !== 'red'));
          } catch (e) {}
          for (const p of scene.players) {
            if (!p || !p.ai || !p.ai.dbg) continue;
            // k276: трупы не разбираем — токены замирают на моменте смерти
            // (W2 по флипам последних 2с жизни в финале вводит в заблуждение).
            if (p.dead || p.active === false) continue;
            const d = p.ai.dbg, ai = p.ai;
            const nm = (d.name || '?') + '';
            _seenW[nm] = 1;
            const _dc = d.dc || '';
            const _tk = (re) => { try { const m = _dc.match(re); return m ? m[1] : null; } catch (e) { return null; } };
            const _src = ai._dbgSrc || '?';
            const _sdx = parseFloat(_tk(/sdx=(-?\d+)/) || '0') || 0;
            const _jmT = parseInt(_tk(/jmp=(\d+)/) || '0', 10) || 0;
            const _jmW = _tk(/jmp=\d+(\([^)]*\))/) || '';
            const _vxT = parseInt(_tk(/vxflip=(\d+)/) || '0', 10) || 0;
            const _vxW = _tk(/vxflip=\d+(\([^)]*\))/) || '';
            const _ni = (ai._navI || 0) + ':' + ((ai._navPath && ai._navPath.length) || 0);
            const _nil = parseInt(_ni.split(':')[1] || '0', 10) || 0;
            // k280: ярус — коротким _laneOf (H/M/L), тем же что _flankWatch
            // в тике. Было _laneNow (high/low) против _laneOf — W7 глохла
            // так же, как chasegap (сравнение разных регистров).
            const _fw0 = (scene._flankWatch || {})[nm];
            const _lane = (() => { try {
              return scene._laneOf(p, (_fw0 && _fw0.lane) || null) || ai._laneNow || '?';
            } catch (e) { return '?'; } })();
            const _route = ai._ctfRoute || '?';
            const _warns = [];
            if (_jmT >= 4 && Math.abs(_sdx) < 150) _warns.push(`W1 jmp-пила ${_jmT}${_jmW}`);
            // k261: W2 только на месте — бег зигзагом/уворот с продвижением
            // (Коршун vx6 при sdx-308) не пила. Симметрия с гардом W1 выше.
            if (_vxT >= 5 && Math.abs(_sdx) < 150) _warns.push(`W2 пила-развороты ${_vxT}${_vxW}`);
            // k271: W9 круговые прыгуны (jlp из строки бота) — в финале видны,
            // хотя бот уже ушёл с точки (SAW-история обрезана 10 записями).
            try {
              const _jlpN = parseInt(_tk(/jlp=(\d+)/) || '0', 10) || 0;
              if (_jlpN >= 5) _warns.push(`W9 круг-прыгун jlp${_jlpN}`);
            } catch (eW9) {}
            try {
              const _cf = [scene.blueFlag, scene.redFlag, scene.ctfSuddenFlag].some(f => f && f.carrier === p);
              if (_cf) {
                const _h = (ai._dbgDirHist || '').slice(-8);
                if (_h.length >= 8 && /^0+$/.test(_h)) _warns.push('W6 НОСИЛЬЩИК СТОИТ');
              }
            } catch (e) {}
            // W8 носильщик у дома (k228): донёс чужой флаг домой, а свой угнан —
            // сдать не может и ждёт. Ждёт дольше 90с почти на месте — пат
            // (по k218 эскорт в это время давит вора; вор мёртв — тишина).
            try {
              [scene.blueFlag, scene.redFlag].forEach(f => {
                const c = f && f.carrier;
                if (!c || c.dead || !Number.isFinite(c.x)) { if (f) f._carryWatch = null; return; }
                const home = (c.team === 'blue') ? scene.blueFlag : scene.redFlag;
                if (!home || !Number.isFinite(home.baseX)) return;
                if (Math.hypot(c.x - home.baseX, c.y - home.baseY) > 400) { f._carryWatch = null; return; }
                let _cw = f._carryWatch;
                if (!_cw || _cw.c !== (c.playerName || '?')) {
                  f._carryWatch = { c: c.playerName || '?', since: _nowW, x: c.x, y: c.y };
                  return;
                }
                if (_nowW - (_cw.since || _nowW) >= 90000 &&
                    Math.hypot(c.x - (_cw.x || c.x), c.y - (_cw.y || c.y)) < 200) {
                  _wl.push(`[WARN] ${c.playerName || '?'} W8 носильщик у дома ${Math.round((_nowW - _cw.since) / 1000)}с (флаг не сдан)`);
                }
              });
            } catch (e) {}
            try {
              if (_theftLive && (ai._chaseMode || ai._chaseTag) &&
                  (_dc.indexOf('src+strafe') >= 0 || _dc.indexOf('src+approach') >= 0 ||
                   _dc.indexOf('src+patrol') >= 0 || _dc.indexOf('src+noise') >= 0)) {
                _warns.push('W5 утечка из погони в бой');
              }
            } catch (e) {}
            let _rec = _ww[nm];
            if (!_rec || (_nowW - (_rec.at || 0)) > 120000) {
              _ww[nm] = { at: _nowW, x: p.x, y: p.y, stillSince: _nowW, nav: _ni, nodeSince: _nowW, nx: p.x, ny: p.y, fl: _route + _lane, flSince: _nowW };
            } else {
              const _moved = (Number.isFinite(p.x) && Number.isFinite(_rec.x)) ? Math.hypot(p.x - _rec.x, p.y - _rec.y) : 999;
              // k259: учёт _rec оставлен, а W4/W3 — из стойкого тика ниже
              // (в финале _rec свежий и оба слепли: I=0 30с, fetch 25с).
              if (_moved >= 50) { _rec.stillSince = _nowW; }
              if (_rec.nav !== _ni) { _rec.nav = _ni; _rec.nodeSince = _nowW; _rec.nx = p.x; _rec.ny = p.y; }
              try {
                const _stW = (scene._stillWatch || {})[nm];
                // k280: караул победы в sudden (эскорт у дома при носильщике
                // рядом с домом) — не ступор, W4 молчит. Полевой кемпинг — как было.
                let _sudGuard = false;
                try {
                  if ((ai._dbgSrc || '') === 'ctfSuddenEscort') {
                    const _m2 = ai._dbgMate;
                    if (_m2 && !_m2.dead) {
                      const _hf2 = _m2.team === 'blue' ? scene.blueFlag : scene.redFlag;
                      if (_hf2 && Number.isFinite(_hf2.baseX) &&
                          Math.hypot(_m2.x - _hf2.baseX, _m2.y - (_hf2.baseY ?? _m2.y)) < 400) _sudGuard = true;
                    }
                  }
                } catch (e) {}
                if (_stW && !_sudGuard && (_src === 'ctfAttack' || _src === 'ctfCarry' || _src === 'ctfEscort' || _src === 'ctfReturn' || _src === 'dropDown' ||
                    _src === 'ctfChase' || _src === 'ctfCutoff' || _src === 'ctfSuddenChase' || _src === 'ctfSuddenFetch' || _src === 'ctfSuddenEscort') &&
                    _nowW - (_stW.since || _nowW) >= 15000) {
                  _warns.push(`W4 топчется ${Math.round((_nowW - _stW.since) / 1000)}с`);
                }
              } catch (eW4) {}
              try {
                const _nvW = (scene._navWatch || {})[nm];
                if (_nvW && _nvW.nav === _ni && _nil > 0 && _nowW - (_nvW.since || _nowW) >= 10000 &&
                    Math.hypot(p.x - (_nvW.x ?? p.x), p.y - (_nvW.y ?? p.y)) < 80) {
                  _warns.push(`W3 узел ${_ni} стоит ${Math.round((_nowW - _nvW.since) / 1000)}с`);
                }
              } catch (eW3) {}
            const _fl = _route + _lane;
            // W7 — только атаке (k236): у хвоста/заслона/эскорта ярус
            // назначается ролью, а не маршрутом (бегут за вором/матом
            // низом — так задумано). Им mismatch не вменяем.
            // k254: возраст — из стойкого _flankWatch тика 0.5с, а не из
            // _warnWatch по C (без промежуточных C он создавался на финале
            // с нуля и слеп). Смена цели/тасовка DROP не сбрасывает.
            const _roleSrc = ai._dbgSrc || '';
            const _roleDriven = _roleSrc === 'ctfChase' || _roleSrc === 'ctfCutoff' ||
              _roleSrc === 'ctfEscort' || _roleSrc === 'ctfBase';
            try {
              const _fwR = (scene._flankWatch || {})[nm];
              const _since = (_fwR && _fwR.fl === _fl) ? _fwR.since : _nowW;
              // k280: регистр яруса — короткий (L), как в _flankWatch тика.
              if (!_roleDriven && (_route === 'mid' || _route === 'high') && _lane === 'L') {
                if (_nowW - (_since || _nowW) >= 30000) {
                  _warns.push(`W7 фланг rt${_route} внизу ${Math.round((_nowW - _since) / 1000)}с`);
                }
              }
            } catch (eW7) {}
            _rec.fl = _fl; _rec.flSince = _rec.flSince || _nowW;
              _rec.at = _nowW; _rec.x = p.x; _rec.y = p.y;
            }
            if (_warns.length) _wl.push(`[WARN] ${nm} ${_warns.join(' + ')}`);
          }
          Object.keys(_ww).forEach(k => {
            try {
              if (!_seenW[k] && _nowW - ((_ww[k] || {}).at || 0) > 120000) delete _ww[k];
            } catch (e) {}
          });
          if (_wl.length) text += '\n' + _wl.join('\n');
          else text += '\n[WARN] чисто';
        } catch (eW) {}
        // Походы (k221): открытые цели с возрастом и автодиагнозом «почему»,
        // плюс история GO/ARR/DROP. Правила why по живым полям (без dbg):
        // стоит (скорость ~0 вдали от цели + уточнение hold/детур/бой),
        // узел стоит (нав-ключ 20с+), не лезет (цель 200+ выше, ноги стоят),
        // топчется (30с+ почти на месте). Иначе — идёт (остаток метров).
        try {
          const _nowY = (scene.time && scene.time.now) || 0;
          const _wy = [];
          const _byName = {};
          (scene.players || []).forEach(pl => {
            if (pl && pl.playerName) _byName[pl.playerName] = pl;
          });
          Object.keys(scene._journey || {}).forEach(nm => {
            try {
              const _r = scene._journey[nm];
              const pl = _byName[nm];
              if (!_r || _r.done || !pl || pl.dead || pl.active === false || !pl.ai) return;
              const _age = Math.round((_nowY - (_r.t0 || _nowY)) / 1000);
              if (_age < 5) return;
              let _ft = pl.y + 28;
              try {
                if (pl.body && Number.isFinite(pl.body.y) && Number.isFinite(pl.body.height)) {
                  _ft = pl.body.y + pl.body.height;
                }
              } catch (e) {}
              const _gyN = (_r.gy != null) ? _r.gy : _ft;
              const _rem = Math.round(Math.hypot(_r.gx - pl.x, _gyN - _ft));
              if (_rem < 100) return;
              const _ai = pl.ai;
              const _why = [];
              let _spd = 999;
              try {
                const _vv = pl.body && pl.body.velocity;
                _spd = _vv ? Math.round(Math.hypot(_vv.x || 0, _vv.y || 0)) : 999;
              } catch (e) {}
              const _duel = /strafe|approach|dodge|heal|ammo/.test(_ai._dbgSrc || '');
              if (_spd < 15 && _rem > 200) {
                if (_nowY < (_ai._holdMoveUntil || 0)) _why.push('hold-спавн');
                else if (_nowY < (_ai._detourUntil || 0)) _why.push('детур');
                else if (_duel) _why.push('дерётся');
                else _why.push('стоит');
              }
              try {
                const _nl = ((_ai._navPath && _ai._navPath.length) || 0);
                if (_nl > 0 && (_r.navK || '').split(':')[1] !== '0' &&
                    _nowY - (_r.navAt || _nowY) >= 20000) _why.push('узел стоит');
              } catch (e) {}
              try {
                // Ноги не растут к высокой цели (подъём = f0 - ft_now).
                if (_gyN < (_r.f0 || _ft) - 200 && ((_r.f0 || _ft) - _ft) < 20 && _age >= 20) {
                  _why.push('не лезет');
                }
              } catch (e) {}
              try {
                if (Number.isFinite(_r.x0) && Math.hypot(pl.x - _r.x0, _ft - (_r.f0 || _ft)) < 60 && _age >= 30) {
                  _why.push('топчется');
                }
              } catch (e) {}
              if (!_why.length) _why.push('идёт');
              _wy.push(`[WAY] ${nm}→${Math.round(_r.gx)},${Math.round(_gyN)} ${Math.round(_age)}с ост${_rem} src=${_ai._dbgSrc || '?'} ${_why.join('+')}`);
            } catch (e) {}
          });
          (scene._journeyLog || []).slice(-12).forEach(e2 => {
            if (!e2) return;
            if (e2.k === 'GO') _wy.push(`[GO] t=${e2.t}с ${e2.nm}→${e2.gx},${e2.gy} (${e2.src})`);
            else if (e2.k === 'ARR') _wy.push(`[ARR] t=${e2.t}с ${e2.nm} +${e2.dt}с (${e2.src})`);
            else if (e2.k === 'DROP') _wy.push(`[DROP] t=${e2.t}с ${e2.nm} через ${e2.dt}с (${e2.from}→${e2.to})`);
          });
          if (_wy.length) text += '\n' + _wy.join('\n');
        } catch (eY) {}
        // Учёт флангов + журнал краж (k194): кто сколько был H/M/L (время и
        // заходы — семплинг 0.5с) и каким флангом украли (исход: доставлен /
        // возвращён / таймаут / сброшен(перехват с потерей) / открыто).
        try {
          const _sl = [];
          const _tt = { blue: { H: 0, M: 0, L: 0, nH: 0, nM: 0, nL: 0 }, red: { H: 0, M: 0, L: 0, nH: 0, nM: 0, nL: 0 } };
          Object.keys(scene._laneStat || {}).forEach(nm => {
            const e = scene._laneStat[nm];
            if (!e) return;
            _sl.push(`[STAT] ${e.team === 'blue' ? '+' : '-'}${nm} H:${Math.round(e.H)}с M:${Math.round(e.M)}с L:${Math.round(e.L)}с заходы H:${e.nH} M:${e.nM} L:${e.nL}`);
            const _t = _tt[e.team];
            if (_t) {
              _t.H += e.H; _t.M += e.M; _t.L += e.L;
              _t.nH += e.nH; _t.nM += e.nM; _t.nL += e.nL;
            }
          });
          // Итог по командам (k197): сумма времени и заходов — проценты
          // считаются от суммы H+M+L команды.
          ['blue', 'red'].forEach(tm => {
            const _t = _tt[tm];
            _sl.push(`[TEAM] ${tm === 'blue' ? '+' : '-'}${tm} H:${Math.round(_t.H)}с M:${Math.round(_t.M)}с L:${Math.round(_t.L)}с заходы H:${_t.nH} M:${_t.nM} L:${_t.nL}`);
          });
          // Время по зонам карты (k369): % живого времени по зонам youPlace
          // (семплинг 0.5с, только зоны от 1%, по убыванию).
          try {
            Object.keys(scene._zoneStat || {}).forEach(nm => {
              const e = scene._zoneStat[nm];
              if (!e || !(e.n > 0)) return;
              const _ks = Object.keys(e).filter(k => k !== 'team' && k !== 'n' && (e[k] || 0) / e.n >= 0.01);
              _ks.sort((a, b) => (e[b] || 0) - (e[a] || 0));
              if (!_ks.length) return;
              _sl.push(`[ZONE] ${e.team === 'blue' ? '+' : '-'}${nm} tot=${Math.round(e.n)}с ` +
                _ks.map(k => `${k}:${Math.round(100 * (e[k] || 0) / e.n)}%`).join(' '));
            });
          } catch (eZN) {}
          // Время по ролям (k275): топ-ветки бота (от 2с). Только полный лог.
          if (full) {
            try {
              Object.keys(scene._srcStat || {}).forEach(nm => {
                const e = scene._srcStat[nm];
                if (!e) return;
                const _ks = Object.keys(e).filter(k => k !== 'team' && (e[k] || 0) >= 2);
                _ks.sort((a, b) => (e[b] || 0) - (e[a] || 0));
                if (!_ks.length) return;
                _sl.push(`[SRC] ${e.team === 'blue' ? '+' : '-'}${nm} ` +
                  _ks.slice(0, 6).map(k => `${k}:${Math.round(e[k])}с`).join(' '));
              });
            } catch (eSR) {}
          }
          // k548: прыжки и маршрут каждого (включая человека) — для разбора
          // «я vs боты по флангам». Пишется только в полный лог.
          if (full) {
            try {
              const _js = scene._jumpStat || {};
              Object.keys(_js).forEach(nm => {
                const e = _js[nm];
                if (!e) return;
                _sl.push(`[JMP] ${e.team === 'blue' ? '+' : '-'}${nm} n=${e.n | 0}`);
              });
            } catch (eJM) {}
            try {
              const _trA = scene._trailAll || {};
              Object.keys(_trA).forEach(nm => {
                const tr = _trA[nm] || [];
                if (tr.length < 2) return;
                const _e = (scene._jumpStat || {})[nm];
                const _tm = _e && _e.team === 'red' ? '-' : '+';
                // Компактно: t:x,y через пробел, шаг 1с, до 400 точек.
                _sl.push(`[TR] ${_tm}${nm} ` + tr.map(p => `${p[0]}:${p[1]},${p[2]}`).join(' '));
              });
            } catch (eTRJ) {}
            try {
              const _js = scene._jumpStat || {};
              Object.keys(_js).forEach(nm => {
                const e = _js[nm];
                if (!e || !e.ev || !e.ev.length) return;
                _sl.push(`[JMPE] ${e.team === 'blue' ? '+' : '-'}${nm} ` +
                  e.ev.slice(-200).map(p => `${p[0]}:${p[1]},${p[2]}`).join(' '));
              });
            } catch (eJME) {}
          }
          (full ? (scene._stealLog || []) : (scene._stealLog || []).slice(-8)).forEach(ev => {
            // k316: пометка YOU — проносы игрока не требуют эскорта/давления
            // ботов и не идут в зачёт доставки ботов.
            _sl.push(`[STEAL] #${ev.seq} t=${ev.t}с ${ev.thief}(${ev.team})${ev.you ? '=YOU' : ''} взял ${ev.flag}-флаг pick=${ev.lane} mid=${ev.mid || '-'}` +
              (ev.out ? ` -> ${ev.out}${ev.tOut != null ? ' t=' + ev.tOut + 'с' : ''}` : ' -> открыто'));
          });
          if (_sl.length) text += '\n' + _sl.join('\n');
        } catch (eSt) {}
        // Боевой лог зрения (k210): я + про каждого живого врага + мои попадания.
        // d=дистанция/eng=прицел бота, rng/fov/ buried, los=какие точки чистые
        // (B/H/L), blk=первая стена x,y, smk=дым, am=магазин/запас, rld, cd=мс
        // до выстрела, prm=прайм реакции, foc=держит меня, fire=выстрел по мне
        // Nс назад, post=S/C/A (стоит/сидит/воздух), src=что делает.
        try {
          const _se = [];
          const _mp = scene.player;
          if (_mp && Number.isFinite(_mp.x)) {
            const _mw = (_mp.weapon || {});
            const _post = _mp.crouching ? 'C' :
              ((_mp.body && (_mp.body.blocked?.down || _mp.body.touching?.down)) ? 'S' : 'A');
            _se.push(`[ME] x=${Math.round(_mp.x)},${Math.round(_mp.y)} post=${_post} ` +
              `wpn=${_mw.magazine != null ? _mw.magazine + '/' + (_mw.reserveAmmo != null ? _mw.reserveAmmo : '?') : '?'}`);
          }
          (scene.players || []).forEach(p => {
            if (!p || !p.ai || p.dead || p.active === false || !scene.player) return;
            if (p.team === scene.player.team) return;
            const si = scene._seeInfo(p);
            if (!si) return;
            _se.push(`[SEE] ${si.name} d=${si.d}/${si.eng} rng=${si.rng} fov=${si.fov} bur=${si.buried} ` +
              `los=${si.los} blk=${si.blk} smk=${si.smk} am=${si.am} rld=${si.rld} cd=${si.cd} ` +
              `prm=${si.prm} foc=${si.foc} fire=${si.fire} post=${si.post} src=${si.src}`);
          });
          (full ? (scene._hitLog || []) : (scene._hitLog || []).slice(-10)).forEach(h => {
            _se.push(`[HIT] t=${h.t}с я→${h.vic} d=${h.d} hp=${h.hp} src=${h.src} lane=${h.lane} ` +
              `see=${h.see} foc=${h.foc} los=${h.los} am=${h.am}`);
          });
          // Убийства (k211): вся история матча (до 30) — кто/кого/ярусы/дистанция.
          (full ? (scene._killLog || []) : (scene._killLog || []).slice(-15)).forEach(k => {
            _se.push(`[KILL] t=${k.t}с ${k.k}(${k.kt},${k.kl})→${k.v}(${k.vt},${k.vl}) d=${k.d} ${k.wpn}`);
          });
          // Возрождения (k290): точки спавна. Только полный лог.
          // k384: стартовые (t<=5) — всегда отдельным блоком (кап журнала
          // съедал t=0 при 60+ записях), дальше последние 40. Только журнал.
          if (full) {
            try {
              const _spL = (scene._spawnLog || []);
              // k385: чинка фильтра (k384: (s.t||99) при t=0 давал 99 —
              // стартовые записи резались тем же фильтром). Только журнал.
              const _spE = _spL.filter(s => (s.t != null ? s.t : 99) <= 5).slice(0, 16);
              const _spT = _spL.slice(-40);
              const _shown = [];
              _spE.concat(_spT).forEach(s => {
                if (_shown.indexOf(s) >= 0) return;
                _shown.push(s);
                _se.push(`[SPAWN] t=${s.t}с ${s.nm}(${s.team}) x=${s.x},${s.y} sh=${(s.sh != null ? s.sh : '-')}`);
              });
            } catch (eSp) {}
            // k387: снапшоты входа (позиции на 5/15/30/60с матча — см.
            // GameScene.update). Только полный лог. Только журнал.
            try {
              const _tr = scene._spawnTrail || {};
              Object.keys(_tr).forEach(_nm => {
                const _e = _tr[_nm] || {};
                _se.push(`[STRAIL] ${_nm} 5:${(_e[5000] || '-')} 15:${(_e[15000] || '-')} 30:${(_e[30000] || '-')} 60:${(_e[60000] || '-')}`);
              });
            } catch (eSTr) {}
          }
          // Пилы (k225): инциденты детектора.
          // k373: полный — последние 30 КАЖДОГО вида (порядок видов по первому
          // появлению; редкие detdrop/wedge/goldgive не тонут в spin/strafe).
          // Короткий — последние 10 общих, как было (что происходит сейчас).
          const _sawLine373 = (s) => `[SAW] t=${s.t}с ${s.nm} ${s.kind}=${s.n} mv=${s.mv} x=${s.x},${s.y} g=${s.g} hp=${s.hp} det=${s.det} src=${s.src} via=${s.via || '-'}${s.note ? ' note=' + s.note : ''} foc=${s.foc != null ? s.foc : '?'} fire=${s.fire || '?'} pt=${s.pt != null ? s.pt : '?'} stk=${s.stk != null ? s.stk : '?'} bl=${s.bl || '--'} lock=${s.lock || '-'}`;
          if (full) {
            try {
              const _byK373 = {}, _ord373 = [];
              (scene._sawLog || []).forEach(s => {
                const _k = (s && s.kind) || '?';
                if (!_byK373[_k]) { _byK373[_k] = []; _ord373.push(_k); }
                _byK373[_k].push(s);
              });
              _ord373.forEach(_k => { _byK373[_k].slice(-30).forEach(s => { _se.push(_sawLine373(s)); }); });
            } catch (eSK) {}
          } else {
            (scene._sawLog || []).slice(-10).forEach(s => { _se.push(_sawLine373(s)); });
          }
          // Остановки (k234): в полном последние 30 (k281: ранние эпизоды),
          // в коротком 10 — кто сколько стоял и почему.
          ((full ? (scene._stopLog || []).slice(-30) : (scene._stopLog || []).slice(-10))).forEach(s => {
            _se.push(`[STOP] t=${s.t}с ${s.nm} ${s.dur}с why=${s.why} x=${s.x},${s.y} g=${s.g || '?'} snap=${s.snap || '?'} src=${s.src} wg=${s.wg || '-'}`);
          });
          // k282: счётчики инцидентов за матч (какие ловушки стреляли и сколько).
          // k284: плюс gapticks (тиков разрыва) — диагностика молчания chasegap.
          if (full) {
            try {
              const _sc2 = scene._sawCounts || {};
              const _kk = Object.keys(_sc2);
              _kk.sort((a, b) => (_sc2[b] || 0) - (_sc2[a] || 0));
              const _parts = _kk.map(k => `${k}:${_sc2[k]}`);
              if ((scene._gapTicks || 0) > 0) _parts.push(`gapticks:${scene._gapTicks}`);
              if (_parts.length) text += '\n[SAWC] ' + _parts.join(' ');
            } catch (eSC) {}
          }
          // k303: разложение скорости носильщиков — куда ушло время проноса.
          try {
            const _cd = scene._carryDecomp || {};
            Object.keys(_cd).forEach(k => {
              const r = _cd[k];
              if (!r || !(r.n > 2)) return;
              const tot = (r.run || 0) + (r.strafe || 0) + (r.air || 0) + (r.climb || 0) + (r.stall || 0);
              if (tot < 3) return;
              const pc = (v) => Math.round(100 * v / tot) + '%';
              const avg = Math.round((r.dist || 0) / Math.max(1, tot));
              // k306: n (сэмплы) + maxGap (макс разрыв) — контроль honesty:
              // over обязан сходиться со STEAL-временами проноса
              // (k316: с учётом YOU — игрок теперь тоже в CARR с пометкой).
              const _isYou = !!(scene.player && r.ref === scene.player);
              // k425: коридор проноса (доля времени по ярусам) + бег по
              // ярусам (доля бега от всего проноса). Тот же знаменатель tot.
              let _tier425 = '', _runT425 = '';
              try {
                _tier425 = ` tierH${pc(r.tH || 0)}/M${pc(r.tM || 0)}/L${pc(r.tL || 0)}`;
                _runT425 = ` runH${pc(r.rH || 0)}/M${pc(r.rM || 0)}/L${pc(r.rL || 0)}`;
              } catch (eT425) {}
              text += `\n[CARR] ${r.nm}(${r.team})${_isYou ? '=YOU' : ''} ${r.flag} run${pc(r.run)} strafe${pc(r.strafe)} ` +
                `climb${pc(r.climb)} air${pc(r.air)} stall${pc(r.stall)} avg${avg}px/s over${Math.round(tot)}с n${r.n || 0} gap${Math.round((r.maxGap || 0) / 1000)}с` + _tier425 + _runT425;
            });
          } catch (eCD) {}
          if (_se.length) text += '\n' + _se.join('\n');
          // k267: след игрока сам едет в ПОЛНОМ логе (последние 60с, точки
          // каждые 0.5с) — жать V больше не надо. В коротких C не пишем.
          if (full) {
            try {
              const _trF = (scene._youTrail || []).slice(-120);
              if (_trF.length) {
                // k290: повторы жмём в интервал (кемпинг 60с — одна запись):
                // x,y@t0-t1. Одиночки как были.
                const _parts = [];
                let _i = 0;
                while (_i < _trF.length) {
                  let _j = _i;
                  while (_j + 1 < _trF.length && _trF[_j + 1].x === _trF[_i].x && _trF[_j + 1].y === _trF[_i].y) _j++;
                  _parts.push(_j > _i + 1
                    ? `${_trF[_i].x},${_trF[_i].y}@${_trF[_i].t}-${_trF[_j].t}`
                    : `${_trF[_i].x},${_trF[_i].y}@${_trF[_i].t}`);
                  _i = _j + 1;
                }
                text += '\n[TRAIL] ' + _parts.join(' ');
              }
            } catch (eTr) {}
          }
        } catch (eSee) {}
      } catch (ea) {}
    // Первая строка — версия кода и режим: сразу видно какой билд в дампе.
    // Вторая — я сам (имя, x/y), дальше боты со своими x/y и pd до меня.
    try {
      const tag = scene._codeTag || '?';
      let _you = '';
      try {
        const _mp = scene.player;
        if (_mp && Number.isFinite(_mp.x) && Number.isFinite(_mp.y)) {
          _you = `\n[YOU] ${_mp.playerName || '?'} x=${Math.round(_mp.x)},${Math.round(_mp.y)} team=${_mp.team || '?'} @${scene._youPlace(_mp.x, _mp.y)}`;
        }
      } catch (e2) {}
      text = `[${tag}+d mode=${scene.mode}]` + _you + (text ? '\n' + text : '');
    } catch (e) {}
    }
    if (!text) return '';
    // Интервальный счётчик урона обнуляем копированием: следующий дамп
    // покажет урон строго за время между двумя C.
    try { scene._dmgInterval = 0; scene._dmgIntLn = { H: 0, M: 0, L: 0 }; } catch (e0) {}
    const done = () => {
      const t = text.split('\n')[0];
      if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) {
        scene._dbgCopyFlash.destroy();
      }
      scene._dbgCopyFlash = scene.add.text(
        scene.dbgCopy.x + 32, scene.dbgCopy.y, 'copied!',
        { fontFamily: 'monospace', fontSize: '11px', color: '#7dffa0' }
      ).setOrigin(0, 0).setScrollFactor(0).setDepth(1502);
      scene.time.delayedCall(900, () => {
        if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) {
          scene._dbgCopyFlash.destroy();
          scene._dbgCopyFlash = null;
        }
      });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {
        scene.clipboardFallback(text, done);
      });
    } else {
      scene.clipboardFallback(text, done);
    }
    // Полный журнал — в хранилище (k219): переживает выход из матча,
    // прислать можно позже. Ключ один — всегда последний матч.
    if (full) {
      try {
        localStorage.setItem('sideShooterMatchLog', JSON.stringify({
          tag: scene._codeTag || '?', mode: scene.mode, at: Date.now(), text: text
        }));
      } catch (e) {}
    }
    return text;
}

// Скачивание полного журнала файлом (k334): буфер обмена режет длинные
// матчи, а чат — тем более. Кнопка «Лог матча» и автозапись в конце матча
// кладут файл ctf-log-<тег>-<дата-время>.txt в Загрузки; дальше ассистент
// читает его сам из папки Загрузки — в чат ничего вставлять не надо.
// Только скачивание, на бой не влияет. Возвращает имя файла или null.
