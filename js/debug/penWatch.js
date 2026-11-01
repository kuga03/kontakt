// penWatch.js — БРАУЗЕРНЫЙ вотчер «тело внутри укрытия».
// Диагностика, на геймплей не влияет: при выключенном флаге не делает ничего.
//
// Зачем: headless-трап [pen] ловит «мёртвое окно» движка (кадр смены стойки),
// которое физика не видит (docs/ctf-bots-learning.md §17–§18). Настоящее
// залипание может быть только в браузере, где его нельзя померить из Node.
// Вотчер ищет именно его: ГЛУБОКОЕ (обе оси > 4px) перекрытие тела с боксом
// укрытия, которое держится ≥5 кадров подряд, и печатает в консоль ОДИН дамп
// на эпизод (тело/спрайт/offset/стойка/скорость/canStand/укрытие/соседи).
//
// Включение: открыть игру с ?penwatch=1 (или localStorage.setItem('penwatch','1')).
// Выключение: ?penwatch=0 или localStorage.removeItem('penwatch').
export function installPenWatch(scene) {
  try {
    let on = false;
    try {
      const search = (globalThis.location && globalThis.location.search) || '';
      if (/[?&]penwatch=1\b/.test(search)) on = true;
      else if (/[?&]penwatch=0\b/.test(search)) on = false;
      else if (globalThis.localStorage) on = globalThis.localStorage.getItem('penwatch') === '1';
    } catch (e) {}
    if (!on) return;

    const run = new Map();   // name -> {n, t0}
    const lastDumpAt = new Map();
    console.log('[penwatch] on: ждём глубокое перекрытие тела с укрытием ≥5 кадров');

    const tickFn = () => {
      try {
        const players = (scene.players || []);
        const covers = scene.covers ? scene.covers.getChildren() : [];
        if (!covers.length) return;
        const now = (scene.time && scene.time.now) || Date.now();
        for (const p of players) {
          if (!p || !p.body || p.dead || p.active === false) continue;
          const b = p.body;
          let hit = null;
          for (const c of covers) {
            const cb = c && c.body;
            if (!cb) continue;
            const ox = Math.min(b.x + b.width, cb.x + cb.width) - Math.max(b.x, cb.x);
            const oy = Math.min(b.y + b.height, cb.y + cb.height) - Math.max(b.y, cb.y);
            if (ox > 4 && oy > 4) { hit = { ox, oy, cb }; break; }
          }
          const st = run.get(p.playerName);
          if (hit) {
            if (!st) run.set(p.playerName, { n: 1, t0: now });
            else st.n++;
            const cur = run.get(p.playerName);
            if (cur && cur.n === 5) {
              const last = lastDumpAt.get(p.playerName);
              if (last == null || now - last > 3000) {
                lastDumpAt.set(p.playerName, now);
                let canStand = '?';
                try { canStand = p.canStand ? p.canStand() : '?'; } catch (e) {}
                const dump = {
                  who: p.playerName, ai: !!p.isAI, team: p.team, t: Math.round(now),
                  crouch: !!p.crouching, canStand,
                  body: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)],
                  bodyBottom: Math.round(b.y + b.height),
                  sprite: [Math.round(p.x), Math.round(p.y)],
                  off: [Math.round(b.offset.x * 10) / 10, Math.round(b.offset.y * 10) / 10],
                  vel: [Math.round(b.velocity.x), Math.round(b.velocity.y)],
                  grounded: !!(b.blocked && b.blocked.down || b.touching && b.touching.down),
                  embedded: !!b.embedded,
                  crate: [Math.round(hit.cb.x), Math.round(hit.cb.y),
                    Math.round(hit.cb.width), Math.round(hit.cb.height)],
                  ov: [Math.round(hit.ox * 10) / 10, Math.round(hit.oy * 10) / 10],
                  holdMs: Math.round((now - ((run.get(p.playerName) || {}).t0 || now))),
                  src: (p.ai && p.ai._dbgSrc) || '?',
                  goal: [Math.round((p.ai && p.ai._dbgGoalX) || 0), Math.round((p.ai && p.ai._dbgGoalY) || 0)],
                  dir: (p.ai && p.ai._dbgDir) || 0,
                  hp: Math.round(p.hp),
                };
                console.log('[penwatch] ЗАЛИПАНИЕ: ' + JSON.stringify(dump));
                run.delete(p.playerName);
              }
            }
          } else if (st) {
            run.delete(p.playerName);
          }
        }
      } catch (e) {}
    };

    // POST_UPDATE сцены идёт после physics + scene.update — то же место, где
    // смотрит headless-трап, но здесь эпизод уже длится несколько кадров.
    scene.events.on('postupdate', tickFn);
  } catch (e) {}
}
