import { statHeaderIcons } from './hudBuild.js?v=372';
import { classBadgeKey } from '../../data/weapons.js?v=170';

import { contribScore } from '../../combat/score.js';

export function endGameTeamBoard(scene, mine) {
  const out = [];
  const isCTF = scene.mode === 'CTF';
  const myTeam = scene.player.team;
  const team = mine ? myTeam : (myTeam === 'blue' ? 'red' : 'blue');
  const list = scene.players.filter(p => p.team === team);
  // Сортировка — по вкладу (те же тарифы, что звезда): полезные действия
  // выше. Ничья — по урону, потом по фрагам. Себя не прибиваем наверх —
  // жёлтый ник и так видно.
  list.sort((a, b) => {
    const ka = [contribScore(a), (a && a.damageDealt) || 0, (a && a.kills) || 0];
    const kb = [contribScore(b), (b && b.damageDealt) || 0, (b && b.kills) || 0];
    return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
  });
  const cx = mine ? 190 : 1090;
  // Блоки шире (было 300): влезла колонка КПД, ники не ужались.
  const W = 340;
  const rowH = 24;
  const H = 52 + list.length * rowH;
  const top = 360 - H / 2;
  const color = team === 'blue' ? '#6db4ff' : '#ff6666';
  const bg = scene.add.rectangle(cx, 360, W, H, 0x0a0a1e, 0.72)
    .setScrollFactor(0).setDepth(199);
  bg.setStrokeStyle(2, team === 'blue' ? 0x3a6aaa : 0xaa3a3a, 0.9);
  out.push(bg);
  // Щит над блоком по центру, крупный (60×75 = ×2.5 от углового 24×30).
  const titleBadge = team === 'blue' ? 'badge_blue' : 'badge_red';
  if (scene.textures.exists(titleBadge)) {
    const im = scene.add.image(cx, top - 8 - 75, titleBadge)
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);
    im.setDisplaySize(60, 75);
    out.push(im);
  } else {
    const titleTxt = team === 'blue' ? 'СИНИЕ' : 'КРАСНЫЕ';
    out.push(scene.add.text(cx, top + 16, titleTxt, {
      fontSize: '14px', color, fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200));
  }
  // Шапка колонок статов (фиксированные правые края — как у строк).
  // КПД — последним после урона (та же механика вклада, что сортировка).
  // Слот урона широкий (6–7 знаков): иначе цифры налезут на флаги.
  // Тот же массив — и шапке, и строкам (разъезжались).
  const RX = cx + W / 2 - 8;
  const colEdges = isCTF ? [RX - 196, RX - 160, RX - 124, RX - 68, RX] : [RX - 162, RX - 126, RX - 68, RX];
  const colNames = isCTF ? ['Ф', 'С', 'ФЛ', 'УРОН', 'КПД'] : ['Ф', 'С', 'УРОН', 'КПД'];
  statHeaderIcons(scene, (o) => out.push(o), colEdges, colNames, top + 34, { depth: 200, scroll: true });
  const nameMaxR = colEdges[0] - 34;
  // Лучший — первый после сортировки (максимум вклада).
  // Подсветка — только если вклад ненулевой (иначе все по нулям).
  const best = list.length ? list[0] : null;
  const bestScore = best ? contribScore(best) : 0;
  const hasBest = !!(best && bestScore > 0);
  list.forEach((p, i) => {
    const y = top + 52 + i * rowH;
    const k = p.kills || 0, d = p.deaths || 0, dmg = p.damageDealt || 0;
    const kpd = Math.round(contribScore(p));
    const vals = isCTF ? [k, d, p.flagsDelivered || 0, dmg, kpd] : [k, d, dmg, kpd];
    // Лучший ряд подсвечен золотой подложкой (рисуем первой — текст поверх).
    // Узкая (по ширине колонки) и тонкая (по высоте строки) — соседей не трогает.
    const isBest = hasBest && p === best;
    // Своя АФК-строка: красная заливка + всё красным + «АФК» по центру.
    const isAfkMe = (p === scene.player && scene._playerAfk);
    if (isBest) {
      const hl = scene.add.graphics().setScrollFactor(0).setDepth(199);
      hl.fillStyle(0x3a2c10, 0.9);
      hl.fillRoundedRect(cx - W / 2 + 4, y - 3, W - 8, rowH, 6);
      hl.lineStyle(1, 0xffd24a, 0.55);
      hl.strokeRoundedRect(cx - W / 2 + 4, y - 3, W - 8, rowH, 6);
      out.push(hl);
    }
    if (isAfkMe) {
      const wash = scene.add.graphics().setScrollFactor(0).setDepth(199);
      wash.fillStyle(0x5a1414, 0.9);
      wash.fillRoundedRect(cx - W / 2 + 4, y - 3, W - 8, rowH, 6);
      wash.lineStyle(1, 0xff5555, 0.6);
      wash.strokeRoundedRect(cx - W / 2 + 4, y - 3, W - 8, rowH, 6);
      out.push(wash);
    }
    const badge = classBadgeKey(p.constructor ? p.constructor.name : null);
    const nameX = cx - W / 2 + 10 + (badge ? 20 : 0);
    if (badge && scene.textures.exists(badge)) {
      out.push(scene.add.image(cx - W / 2 + 10 + 8, y + 7, badge)
        .setScrollFactor(0).setDepth(200).setDisplaySize(16, 16));
    }
    // Ник обрезаем под колонки (длинные ники налезали на статы).
    // Резерв справа под звезду лучшего (АФК теперь по центру, не за ником).
    let nick = String(p.playerName || '');
    const tagReserve = isBest ? 20 : 0;
    const nameT = scene.add.text(nameX, y, nick, {
      fontSize: '13px', color: isAfkMe ? '#ff6666' : nameColor(scene, p), fontStyle: 'bold'
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(200);
    let guard = 0;
    while (nameT.displayWidth > Math.max(30, nameMaxR - tagReserve - nameX) && nick.length > 4 && guard < 24) {
      nick = nick.slice(0, -1);
      nameT.setText(nick + '…');
      guard++;
    }
    out.push(nameT);
    // Метка лучшего — сразу за ником. АФК — по центру строки
    // (только себе; активным — ничего).
    let tagX = nameX + nameT.displayWidth + 6;
    if (isBest) {
      const star = scene.add.text(tagX, y + 1, '★', {
        fontSize: '12px', color: '#ffd24a', fontStyle: 'bold'
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(200);
      out.push(star);
      tagX += star.displayWidth + 6;
    }
    if (isAfkMe) {
      // АФК встаёт вместо вклада (КПД), в той же колонке.
      const afkT = scene.add.text(colEdges[colEdges.length - 1], y, 'АФК', {
        fontSize: '15px', color: '#ff4444', fontStyle: 'bold'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(200);
      try { afkT.setStroke('#000000', 4); } catch (e) {}
      out.push(afkT);
    }
    vals.forEach((v, ci) => {
      if (isAfkMe && ci === vals.length - 1) return; // вклад скрыт за АФК
      out.push(scene.add.text(colEdges[ci], y, String(v), {
        fontSize: '12px', color: isAfkMe ? '#ff9a9a' : '#dddddd'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(200));
    });
  });
  return out;
}

// TAB-табло: один общий блок, слева моя команда, справа противник.
// У каждого: киллы/смерти[/флаги]/урон отдельными колонками (как в итогах),
// сверху короткая шапка. Длинные ники обрезаются под колонки.
export function renderTeamsBoard(scene) {
  const isCTF = scene.mode === 'CTF';
  const myTeam = scene.player.team;
  // Сортировка таблицы — по урону (больше сверху), а не по фрагам.
  const byDmg = (a, b) => (b.damageDealt || 0) - (a.damageDealt || 0);
  const mates = [scene.player, ...scene.players.filter(p => p !== scene.player && p.team === myTeam)].sort(byDmg);
  const foes = scene.players
    .filter(p => p !== scene.player && p.team !== myTeam)
    .sort(byDmg);
  const statCols = isCTF ? ['Ф', 'С', 'ФЛ', 'УРОН', 'КПД'] : ['Ф', 'С', 'УРОН', 'КПД'];
  const statOf = (p) => {
    const k = p.kills || 0, d = p.deaths || 0, dmg = p.damageDealt || 0;
    const kpd = Math.round(contribScore(p));
    return isCTF ? [k, d, p.flagsDelivered || 0, dmg, kpd] : [k, d, dmg, kpd];
  };
  const teamTitle = (team) => {
    if (scene.mode === 'FFA') return team === myTeam ? 'ВЫ' : 'ПРОТИВНИК';
    return team === 'blue' ? `СИНИЕ (${scene.scores.blue | 0})` : `КРАСНЫЕ (${scene.scores.red | 0})`;
  };
  const teamBadge = (team) => {
    if (scene.mode === 'FFA') return null;
    const key = team === 'blue' ? 'badge_blue' : 'badge_red';
    return scene.textures.exists(key) ? key : null;
  };
  const teamScore = (team) => team === 'blue' ? (scene.scores.blue | 0) : (scene.scores.red | 0);
  const teamColor = (team) => team === myTeam ? '#6db4ff'
    : (team === 'blue' ? '#6db4ff' : team === 'red' ? '#ff6666' : '#ff9d9d');
  const colData = (list, team) => {
    const rows = [{
      name: null, title: teamTitle(team), color: teamColor(team),
      badge: teamBadge(team), score: teamScore(team)
    }];
    list.forEach(p => rows.push({
      name: p.playerName, color: nameColor(scene, p), stats: statOf(p),
      cls: p.constructor ? p.constructor.name : null
    }));
    return rows;
  };
  const left = colData(mates, myTeam);
  const foeTeam = foes.length && foes[0].team !== myTeam ? foes[0].team : 'red';
  const right = colData(foes, foeTeam);

  const sig = JSON.stringify([left, right, statCols]);
  if (sig === scene._scoreSig && scene.scoreboard.length) return;
  scene._scoreSig = sig;
  scene.scoreboard.removeAll(true);

  const rowH = 24;
  // Блок шире (было 300): колонка КПД без ужимания ников.
  const colW = 340;
  const n = Math.max(left.length, right.length);
  // Заголовок со щитом выше (+44): щит 37 + счёт под ним.
  const H = n * rowH + 52 + ((left[0].badge || right[0].badge) ? 44 : 0);
  const bg = scene.add.rectangle(0, 0, colW * 2 + 40, H, 0x0a0a1e, 0.93);
  scene.scoreboard.add(bg);

  const drawCol = (cx, rows) => {
    let y = -H / 2 + 10;
    rows.forEach((r, i) => {
      if (r.name == null) {
        if (r.badge) {
          // Щит вместо слова «СИНИЕ/КРАСНЫЕ», счёт команды — под ним.
          const im = scene.add.image(cx, y + 2, r.badge).setOrigin(0.5, 0);
          im.setDisplaySize(30, 37);
          scene.scoreboard.add(im);
          const t = scene.add.text(cx, y + 42, `${r.score | 0}`, {
            fontSize: '17px', color: r.color, fontStyle: 'bold'
          }).setOrigin(0.5, 0);
          scene.scoreboard.add(t);
        } else {
          const t = scene.add.text(cx, y + 2, r.title, {
            fontSize: '17px', color: r.color, fontStyle: 'bold'
          }).setOrigin(0.5, 0);
          scene.scoreboard.add(t);
        }
        const RX = cx + colW / 2 - 8;
        const edges = isCTF ? [RX - 196, RX - 160, RX - 124, RX - 68, RX] : [RX - 162, RX - 126, RX - 68, RX];
        // Шапка под щитом и счётом (было y+24 — прямо по щиту, «Ф» налезала на бейдж).
        const headY = y + (r.badge ? 64 : 24);
        statHeaderIcons(scene, (o) => scene.scoreboard.add(o), edges, statCols, headY, { fs: '11px' });
        y += rowH + 20 + (r.badge ? 44 : 0);
      } else {
        const badge = classBadgeKey(r.cls);
        const shift = (badge && scene.textures.exists(badge)) ? 22 : 0;
        if (shift) {
          const im = scene.add.image(cx - colW / 2 + 8 + 9, y + 10, badge);
          scene.scoreboard.add(im);
        }
        const RX = cx + colW / 2 - 8;
        const edges = isCTF ? [RX - 196, RX - 160, RX - 124, RX - 68, RX] : [RX - 162, RX - 126, RX - 68, RX];
        const nameMaxR = edges[0] - 34;
        let nick = String(r.name || '');
        const t = scene.add.text(cx - colW / 2 + 8 + shift, y, nick, {
          fontSize: '15px', color: r.color, fontStyle: 'bold'
        }).setOrigin(0, 0);
        let guard = 0;
        const nameX = cx - colW / 2 + 8 + shift;
        while (t.displayWidth > Math.max(30, nameMaxR - nameX) && nick.length > 4 && guard < 24) {
          nick = nick.slice(0, -1);
          t.setText(nick + '…');
          guard++;
        }
        scene.scoreboard.add(t);
        (r.stats || []).forEach((v, ci) => {
          const s = scene.add.text(edges[ci], y, String(v), {
            fontSize: '14px', color: '#dddddd'
          }).setOrigin(1, 0);
          scene.scoreboard.add(s);
        });
        y += rowH;
      }
    });
  };
  drawCol(-1 * (colW / 2 + 10), left);
  drawCol(colW / 2 + 10, right);
}

function nameColor(scene, p) {
  if (p === scene.player) return '#ffe066';
  if (p.team === 'blue') return '#7db8ff';
  if (p.team === 'red') return '#ff8888';
  return '#ffffff';
}

export function drawScoreDots(scene) {
  const g = scene.scoreDots;
  if (!g) return;
  try {
    const lim = Math.max(1, scene.scoreLimit | 0 || 1);
    // Точки — только CTF/BOMB с малым лимитом (иначе чистим и молчим).
    if ((scene.mode !== 'CTF' && scene.mode !== 'BOMB') || lim > 10) {
      if (scene._dotsSig !== 'off') {
        scene._dotsSig = 'off';
        g.clear();
      }
      return;
    }
    const b = scene.scores.blue | 0, r = scene.scores.red | 0;
    const rad = lim > 5 ? 5 : 7;
    const step = rad * 2 + 7;
    // Центр свободен всегда: 40px зазор (по 20 с каждой стороны).
    const sig = `${lim}:${b}:${r}`;
    if (sig === scene._dotsSig) return;
    scene._dotsSig = sig;
    g.clear();
    const dot = (x, filled, color) => {
      if (filled) {
        g.fillStyle(color, 1);
        g.fillCircle(x, 0, rad);
      } else {
        g.fillStyle(0x1a1a3c, 1);
        g.fillCircle(x, 0, rad);
        g.lineStyle(2, 0x333355, 1);
        g.strokeCircle(x, 0, rad);
      }
    };
    for (let k = 0; k < lim; k++) {
      // k=0 — у своего края (как было от бейджа), счёт растёт к центру.
      dot(-20 - (lim - 1 - k) * step, k < b, 0x6db4ff);
      dot(20 + (lim - 1 - k) * step, k < r, 0xff6666);
    }
  } catch (e) {}
}

// Per-frame обновление HUD — хвост update() сцены (бары, слоты, счёт, TAB).
// lerp считается здесь же из delta (как в update: зависимость от времени,
// а не от кадров — иначе на 30/120 FPS скорость разная).
