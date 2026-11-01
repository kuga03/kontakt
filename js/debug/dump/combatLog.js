export function logSpawn(scene, p, x, y, sh) {
    try {
      if (!p) return;
      const now = (scene.time && scene.time.now) || 0;
      scene._spawnLog = scene._spawnLog || [];
      let _sh = '-';
      try { _sh = (sh != null && Number.isFinite(+sh)) ? Math.round(+sh) : ((p._spawnShift != null && Number.isFinite(+p._spawnShift)) ? Math.round(+p._spawnShift) : '-'); } catch (eS) {}
      scene._spawnLog.push({
        t: Math.round(now / 1000),
        nm: p.playerName || '?', team: p.team || '?',
        x: Math.round(x), y: Math.round(y), sh: _sh
      });
      // k386: стартовые (t<=5) не вытесняем капой (k385 чинил вывод, но кап 60
      // съедал t=0 раньше вывода). Только журнал.
      if (scene._spawnLog.length > 60) {
        const _idx = scene._spawnLog.findIndex(s => (s.t != null ? s.t : 99) > 5);
        if (_idx >= 0) scene._spawnLog.splice(_idx, 1);
        else scene._spawnLog.splice(0, scene._spawnLog.length - 60);
      }
    } catch (e) {}
}

export function logKill(scene, killer, vic) {
    try {
      if (!vic) return;
      const now = (scene.time && scene.time.now) || 0;
      const kn = (killer && killer.playerName) || '?';
      const kt = (killer && killer.team) || '?';
      const w = (killer && killer.weapon) || {};
      scene._killLog = scene._killLog || [];
      scene._killLog.push({
        t: Math.round(now / 1000),
        k: kn, kt: kt,
        v: vic.playerName || '?', vt: vic.team || '?',
        kl: scene._laneOf(killer) || '?', vl: scene._laneOf(vic) || '?',
        d: (killer && Number.isFinite(killer.x) && Number.isFinite(vic.x))
          ? Math.round(Math.hypot(killer.x - vic.x, killer.y - vic.y)) : '?',
        wpn: (w && !w.isMelee && w.magazine != null) ? 'fire' : (w && w.isMelee ? 'melee' : '?')
      });
      if (scene._killLog.length > 30) scene._killLog.splice(0, scene._killLog.length - 30);
    } catch (e) {}
}

// Журнал МОИХ попаданий (k210): слепок врага в момент моего урона —
// дистанция, его ХП после, задача, ярус, видел ли меня, фокус, луч, патроны.
export function logHit(scene, att, vic) {
    try {
      if (!att || !vic || att !== scene.player || att.isAI || att._demoPuppet) return;
      if (!vic.ai || vic.dead) return;
      const now = (scene.time && scene.time.now) || 0;
      const si = scene._seeInfo(vic) || {};
      // Ярус жертвы — своим замером, а не _laneNow бота: до первого нажатия C
      // dbg-цикл не крутился и _laneNow пуст (k211: lane=? в ранних HIT).
      let _vl = (si.lane && si.lane !== '?') ? si.lane : null;
      if (!_vl) { try { _vl = scene._laneOf(vic) || '?'; } catch (e) { _vl = '?'; } }
      scene._hitLog = scene._hitLog || [];
      scene._hitLog.push({
        t: Math.round(now / 1000),
        vic: vic.playerName || '?',
        d: si.d != null ? si.d : '?',
        hp: Math.round(vic.hp) + '/' + Math.round(vic.maxHp || 100),
        src: si.src || '?', lane: _vl,
        see: (si.rng && si.fov && !si.buried && si.los !== '-') ? 1 : 0,
        foc: si.foc != null ? si.foc : '?',
        los: si.los || '?', am: si.am || '?'
      });
      if (scene._hitLog.length > 12) scene._hitLog.splice(0, scene._hitLog.length - 12);
    } catch (e) {}
}

// Место по координатам (Форты 3800×900): короткое имя для лога,
// чтобы не гадать где точка по числам.
export function youPlace(scene, x, y) {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return '?';
      const MW = scene.mapWidth || 3800;
      if (x < 350) return 'базаС';
      if (x > MW - 350) return 'базаК';
      // Перч-ящики (верх Craft): восток 2330–2470, запад 1330–1470, верх ~360.
      if (y < 380 && ((x >= 2310 && x <= 2490) || (x >= 1310 && x <= 1490))) return 'ящик-перч';
      // Форты tops ~300.
      if (y < 550 && x >= 820 && x <= 1180) return 'фортЗ';
      if (y < 550 && x >= 2620 && x <= 2980) return 'фортВ';
      // Плато ~470.
      if (y >= 380 && y < 560 && x >= 900 && x <= MW - 900) return 'плато';
      // Мост ~690.
      if (y >= 560 && y < 760 && x >= 1000 && x <= MW - 1000) return 'мост';
      // Лесенки по бокам.
      if (x >= 600 && x < 1000) return 'лесенкаЗ';
      if (x > MW - 1000 && x <= MW - 600) return 'лесенкаВ';
      if (y >= 800) return 'низ';
      if (x < MW * 0.4) return 'полеЗ';
      if (x > MW * 0.6) return 'полеВ';
      return 'центр';
    } catch (e) { return '?'; }
}

// Отдельный лог моих перемещений (V): текущая точка + след.
// Компактно, без ботов — кидать одну-две строки вместо простыни.
export function copyYouTrail(scene) {
    let text = '';
    try {
      const tag = scene._codeTag || '?';
      const _mp = scene.player;
      const _you = (_mp && Number.isFinite(_mp.x) && Number.isFinite(_mp.y))
        ? `[YOU] ${_mp.playerName || '?'} x=${Math.round(_mp.x)},${Math.round(_mp.y)} team=${_mp.team || '?'} @${scene._youPlace(_mp.x, _mp.y)}`
        : '[YOU] ?';
      const _tr = (scene._youTrail || []).slice(-30);
      const _line = _tr.map(p => `${p.x},${p.y}`).join(' ');
      text = `[${tag} YOU-TRAIL]` + '\n' + _you + (_line ? '\ntrail: ' + _line : '');
    } catch (e) { return; }
    if (!text) return;
    const done = () => {
      try {
        if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) scene._dbgCopyFlash.destroy();
        scene._dbgCopyFlash = scene.add.text(
          scene.dbgCopy.x + 32, scene.dbgCopy.y, 'trail copied!',
          { fontFamily: 'monospace', fontSize: '11px', color: '#7dffa0' }
        ).setOrigin(0, 0).setScrollFactor(0).setDepth(1502);
        scene.time.delayedCall(900, () => {
          if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) {
            scene._dbgCopyFlash.destroy();
            scene._dbgCopyFlash = null;
          }
        });
      } catch (e2) {}
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => scene.clipboardFallback(text, done));
      } else {
        scene.clipboardFallback(text, done);
      }
    } catch (e3) {}
}

// Запись МОЕГО маршрута (клавиша C): копия в буфер как [[x,y],[x,y]...]
// (ноги). Формат — готовый массив для FLANK_WAYPOINTS.
export function copyRecPath(scene) {
  let text = '';
  try {
    const _rp = (scene._recPath || []);
    if (!_rp.length) { text = ''; }
    else text = `[${scene._codeTag || '?'} ROUTE]\n` + JSON.stringify(_rp);
  } catch (e) { return; }
  if (!text) {
    // Пусто — просто подмигнём подсказкой.
    try {
      if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) scene._dbgCopyFlash.destroy();
      scene._dbgCopyFlash = scene.add.text(
        16, 120, 'rec empty', { fontFamily: 'monospace', fontSize: '11px', color: '#ff9d9d' }
      ).setOrigin(0, 0).setScrollFactor(0).setDepth(1502);
      scene.time.delayedCall(900, () => { if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) { scene._dbgCopyFlash.destroy(); scene._dbgCopyFlash = null; } });
    } catch (e2) {}
    return;
  }
  const done = () => {
    try {
      if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) scene._dbgCopyFlash.destroy();
      scene._dbgCopyFlash = scene.add.text(
        16, 120, `route copied (${(scene._recPath || []).length} pts)`,
        { fontFamily: 'monospace', fontSize: '11px', color: '#7dffa0' }
      ).setOrigin(0, 0).setScrollFactor(0).setDepth(1502);
      scene.time.delayedCall(1200, () => {
        if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) {
          scene._dbgCopyFlash.destroy();
          scene._dbgCopyFlash = null;
        }
      });
    } catch (e2) {}
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => scene.clipboardFallback(text, done));
    } else {
      scene.clipboardFallback(text, done);
    }
  } catch (e3) {}
}

// full=true: полный журнал матча (все STEAL/KILL/HIT) + запись в хранилище.
// Обычный C — короткие хвосты. Автозапись (k219): endGame дёргает full сам,
// руками ловить ничего не надо; в финале кнопка «Лог матча» копирует снова
// (там уже точно по жесту — буфер отдадут).
export function saveMatchLog(scene, text, suf) {
  try {
    if (!text || text.length < 200) return null;
    const tag = (scene && scene._codeTag) || '?';
    let _ts = '';
    try {
      const _d = new Date();
      const _p = (n) => String(n).padStart(2, '0');
      _ts = `${_d.getFullYear()}${_p(_d.getMonth() + 1)}${_p(_d.getDate())}-${_p(_d.getHours())}${_p(_d.getMinutes())}${_p(_d.getSeconds())}`;
    } catch (eTS) { _ts = String(Date.now()); }
    // k374: суффикс снимка (classic) — пара файлов на матч, имена не бьются.
    const _suf = (suf && /^[A-Za-z0-9-]+$/.test(suf)) ? '-' + suf : '';
    const name = `ctf-log-${tag}-${_ts}${_suf}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    try { document.body.appendChild(a); } catch (eA) {}
    a.click();
    try { document.body.removeChild(a); } catch (eR) {}
    try { setTimeout(() => URL.revokeObjectURL(url), 5000); } catch (eU) {}
    return name;
  } catch (e) { return null; }
}
