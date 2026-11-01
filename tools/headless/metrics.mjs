// metrics.mjs — сбор метрик матча и расчёт фитнеса для обучения ботов.
// Использует уже существующую в игре объективную метрику вклада
// (js/combat/score.js: contribScore) плюс телеметрию поломок (_sawCounts).
import { contribScore } from '../../js/combat/score.js';
import { breakagePenalty } from './fitness.mjs';

export { breakagePenalty };

export function collectMetrics(scene) {
  const players = Array.isArray(scene.players) ? scene.players : [];
  const rows = players.map((p) => ({
    name: p.playerName || '?',
    team: p.team,
    isAI: !!p.isAI,
    x: Math.round(p.x),
    kills: p.kills | 0,
    deaths: p.deaths | 0,
    dmg: Math.round(p.damageDealt || 0),
    flags: p.flagsDelivered | 0,
    returns: p.returnsCount | 0,
    carrierKills: p.carrierKills | 0,
    healed: Math.round(p.healedGiven || 0),
    caps: p.caps | 0,
    contrib: Math.round(contribScore(p)),
    // Простой: доля тиков на земле без движения, худшая серия и главный режим.
    idlePct: (p._idleStat && p._idleStat.ticks)
      ? Math.round(p._idleStat.idle / p._idleStat.ticks * 1000) / 10 : null,
    idleMaxMs: p._idleStat ? Math.round(p._idleStat.maxRun * 1000 / 60) : null,
    idleSrc: (() => {
      const bs = p._idleStat && p._idleStat.bySrc;
      if (!bs) return null;
      const e = Object.entries(bs).sort((a, b) => b[1] - a[1])[0];
      return e ? `${e[0]}:${Math.round(e[1] / (p._idleStat.ticks || 1) * 100)}%` : null;
    })(),
  }));

  const saw = scene._sawCounts || {};
  const blue = rows.filter((r) => r.team === 'blue');
  const red = rows.filter((r) => r.team === 'red');
  const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] | 0), 0);

  // Прогресс к вражеской базе (только ИИ, без idle-игрока): плотный сигнал
  // объективной игры, ненулевой даже когда флаг ещё не взят.
  const MW = scene.mapWidth || 3800;
  const aiBlue = blue.filter((r) => r.isAI);
  const aiRed = red.filter((r) => r.isAI);
  const avg = (arr, f) => (arr.length ? arr.reduce((a, r) => a + f(r), 0) / arr.length : 0);
  const progress = {
    blue: Math.round(avg(aiBlue, (r) => r.x)),
    red: Math.round(avg(aiRed, (r) => MW - r.x)),
  };

  return {
    mode: scene.mode,
    navGraph: scene._navGraph ? (scene._navGraph.nodes ? scene._navGraph.nodes.length : -1) : 0,
    mapId: scene.campaignLevel ? (scene.campaignLevel.id || scene.campaignLevel.name || 'obj:' + Object.keys(scene.campaignLevel).join(',')) : null,
    playerAI: !!(scene.player && scene.player.ai),
    covers: (scene.covers && scene.covers.getChildren ? scene.covers.getChildren() : [])
      .map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width), h: Math.round(c.height) })),
    scores: scene.scores || { blue: 0, red: 0 },
    limit: scene.scoreLimit | 0,
    gameOver: !!scene.gameOver,
    time: Math.round(scene.time ? scene.time.now : 0),
    saw,
    players: rows,
    progress,
    team: {
      blue: {
        score: (scene.scores && scene.scores.blue) | 0,
        kills: sum(blue, 'kills'),
        deaths: sum(blue, 'deaths'),
        dmg: sum(blue, 'dmg'),
        flags: sum(blue, 'flags'),
        contrib: sum(blue, 'contrib'),
      },
      red: {
        score: (scene.scores && scene.scores.red) | 0,
        kills: sum(red, 'kills'),
        deaths: sum(red, 'deaths'),
        dmg: sum(red, 'dmg'),
        flags: sum(red, 'flags'),
        contrib: sum(red, 'contrib'),
      },
    },
  };
}

// Фитнес команды (для эволюции/RL). Оси по ТЗ пользователя:
// объективная игра, боевая эффективность, отсутствие поломок, живучесть.
export function teamFitness(m, team, weights = {}) {
  const w = Object.assign(
    { obj: 1.0, combat: 0.5, surv: 0.3, breakage: 0.5, win: 3.0 },
    weights
  );
  const me = m.team[team];
  const foe = m.team[team === 'blue' ? 'red' : 'blue'];
  const obj = (me.flags - foe.flags) * 100 + (me.score - foe.score) * 50;
  const combat = (me.kills - foe.kills) * 20 + (me.dmg - foe.dmg) / 25;
  const surv = (foe.deaths - me.deaths) * 10;
  const win = m.gameOver ? ((me.score > foe.score ? 1 : 0) * w.win * 100) : 0;
  const pen = breakagePenalty(m.saw) * w.breakage;
  return w.obj * obj + w.combat * combat + w.surv * surv + win - pen;
}
