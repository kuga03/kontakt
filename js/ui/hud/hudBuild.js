
import { ensureClassBadgeTextures } from '../../data/weapons.js';
import { getShowFps } from '../../scenes/SettingsScene.js';

import { gameState } from '../../data/gameState.js';

const STAT_ICONS = { 'Ф': 'icon_stat_frags', 'С': 'icon_stat_deaths', 'ФЛ': 'icon_stat_flag', 'УРОН': 'icon_stat_damage', 'ПИНГ': 'icon_stat_ping', 'КПД': 'icon_stat_kpd' };
export function statHeaderIcons(scene, add, edges, cols, y, opts) {
  const o = opts || {};
  // ×1.5 (было 14): значки читались мелко.
  const size = o.size || 21, fs = o.fs || '10px';
  (cols || []).forEach((cn, ci) => {
    const ik = STAT_ICONS[cn];
    if (ik && scene.textures.exists(ik)) {
      // чуть ниже шапки; флаг сдвинут чуть правее (не упирался в колонку).
      const dx = ik === 'icon_stat_flag' ? 6 : 0;
      const im = scene.add.image(edges[ci] + dx, y + 3, ik).setOrigin(1, 1);
      if (o.depth != null) { try { im.setDepth(o.depth); } catch (e) {} }
      if (o.scroll) { try { im.setScrollFactor(0); } catch (e) {} }
      im.setDisplaySize(size, size);
      add(im);
    } else {
      const t = scene.add.text(edges[ci], y, cn, { fontSize: fs, color: '#667788' }).setOrigin(1, 0);
      if (o.depth != null) { try { t.setDepth(o.depth); } catch (e) {} }
      if (o.scroll) { try { t.setScrollFactor(0); } catch (e) {} }
      add(t);
    }
  });
}

export function buildHud(scene) {
  scene.hudFixed = [];
  // Значки классов для таблиц (TAB/итоги) — пекутся один раз.
  try { ensureClassBadgeTextures(scene); } catch (e) {}
  // anchor: undefined/'C' — с блоком, 'R' — к правому краю, 'L' — к левому.
  scene.addHudElement = (obj, sx, sy, counterScale = true, anchor) => {
    scene.hudFixed.push({ obj, sx, sy, counterScale, anchor });
    return obj;
  };

  const barX0 = 462;
  const barX1 = 900;
  const barW = barX1 - barX0;
  const barCx = (barX0 + barX1) / 2;
  // Ширина полос — для заливок в update (было захардкожено 514
  // и вылезло за фон после сужения).
  scene._hudBarW = barW;

  scene.hpBarBg = scene.addHudElement(
    scene.add.rectangle(barCx, 659, barW, 24, 0x222244, 0.95).setScrollFactor(0).setDepth(95),
    barCx, 659
  );

  // Заливка утоплена в подложку на 3px с обеих сторон: раньше левый
  // край совпадал с подложкой (прятался за ней), а правый выпирал на 6px.
  scene.hpBarFill = scene.addHudElement(
    scene.add.rectangle(barX0 + 3, 659, barW - 6, 20, 0x55ff55, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
    barX0 + 3, 659
  );

  scene.hpBarText = scene.addHudElement(
    scene.add.text(barCx, 659, '100%', {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#00000088', padding: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(97),
    barCx, 659
  );

  scene.armorBarBg = scene.addHudElement(
    scene.add.rectangle(barCx, 677, barW, 16, 0x222244, 0.95)
      .setScrollFactor(0).setDepth(95),
    barCx, 677
  );

  scene.armorBarFill = scene.addHudElement(
    scene.add.rectangle(barX0 + 3, 677, barW - 6, 12, 0x55aaff, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
    barX0 + 3, 677
  );

  scene.armorBarText = scene.addHudElement(
    scene.add.text(barCx, 677, '100%', {
      fontSize: '13px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#00000088', padding: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(97),
    barCx, 677
  );

  // Колонка абилки — справа (x=1070): слева ей не хватило места
  // между ячейками оружия и полосами HP, тексты налезали друг на друга.
  // Весь HUD фиксирует updateHudTransform (позиция+масштаб от зума),
  // _noHudScale ниже — исторический маркер, на компенсацию не влияет.
  const abilityX = 1070;
  const abilityY = 690;
  scene.hudAbilityPt = { x: 1070, y: 690 };
  scene.abilityCircleBg = scene.add.graphics().setScrollFactor(0).setDepth(96);
  scene.abilityCircleText = scene.addHudElement(
    scene.add.text(abilityX, abilityY, '—', {
      fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(98),
    abilityX, abilityY
  );
  scene.abilityCircleText._noHudScale = true;

  // Текст гранат убран: вместо «G:Оск/H:Дым» — ячейки гранат
  // в стиле оружия (см. scene.grenSlots ниже).

  scene.ultHud = scene.addHudElement(
    scene.add.text(abilityX, abilityY - 68, '', {
      fontSize: '14px', fontStyle: 'bold', color: '#cccccc'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(98),
    abilityX, abilityY - 68
  );
  scene.ultHud._noHudScale = true;

  scene.abilityLabel = scene.addHudElement(
    scene.add.text(abilityX + 32, abilityY, '', {
      fontSize: '13px', color: '#ffeeaa', lineSpacing: 3
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(97),
    abilityX + 32, abilityY
  );
  scene.abilityLabel._noHudScale = true;

  // Табло TAB: контейнер строк (цвет ника = цвет команды).
  // Центр экрана (640, 360): строки внутри центрируются по высоте.
  // scrollFactor(0) у контейнера — иначе табло уезжает с миром.
  scene._scoreRows = [];
  scene._scoreSig = null;
  scene.scoreboard = scene.addHudElement(
    scene.add.container(640, 360).setScrollFactor(0).setDepth(101),
    640, 360
  );
  scene.scoreboard.setVisible(false);

  scene.reloadIcon = scene.add.graphics().setScrollFactor(0).setDepth(98);

  scene.crosshair = scene.add.graphics().setScrollFactor(0).setDepth(120);

  // Счётчик FPS слева вверху (включается в настройках). Через addHudElement —
  // стоит на месте при любом зуме. Обновляется 2 раза в секунду в update().
  scene.fpsTxt = null;
  scene.placeTxt = null;
  try {
    const showFps = typeof getShowFps === 'function' && getShowFps();
    if (showFps) {
      scene.fpsTxt = scene.addHudElement(
        scene.add.text(20, 14, '', {
          fontSize: '16px', fontStyle: 'bold', color: '#9fff9f',
          backgroundColor: '#00000088', padding: 4
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(130),
        20, 14
      );
      scene.fpsTxt._noHudScale = true;
      // k293: моё местоположение мелким текстом под счётчиком FPS.
      scene.placeTxt = null;
    }
  } catch (e) { scene.fpsTxt = null; }

  scene.scoreHud = (scene.mode === 'FFA' || scene.mode === 'TDM' || scene.mode === 'CTF')
    ? scene.addHudElement(
        scene.add.text(640, 10, '', {
          fontSize: scene.mode === 'FFA' ? '15px' : '22px',
          color: '#ffffff',
          backgroundColor: '#0d0d22cc',
          padding: 6,
          lineSpacing: 4,
          align: 'center'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(96),
        640, 10
      )
    : scene.addHudElement(
        scene.add.text(1255, 690, '', {
          fontSize: '17px',
          color: '#ffff88',
          backgroundColor: '#111133',
          padding: 8
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(96),
        1255, 690
      );

  // Командный счёт тремя частями: «Синие» — синим, «Красные» — красным.
  scene.scoreBlue = null;
  scene.scoreMid = null;
  scene.scoreRed = null;
  if (scene.mode === 'TDM' || scene.mode === 'CTF' || scene.mode === 'KOTH' || scene.mode === 'BOMB') {
    scene.scoreHud.setVisible(false);
    // Ряд «щит цифры : цифры щит» центрируется каждый кадр (см. update).
    scene.scoreBlue = scene.addHudElement(
      scene.add.text(452, 10, '', {
        fontSize: '22px', fontStyle: 'bold', color: '#6db4ff',
        backgroundColor: '#0d0d22cc', padding: 6
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(96),
      452, 10
    );
    scene.scoreMid = scene.addHudElement(
      scene.add.text(640, 10, ':', {
        fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#0d0d22cc', padding: 6
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(96),
      640, 10
    );
    scene.scoreRed = scene.addHudElement(
      scene.add.text(712, 10, '', {
        fontSize: '22px', fontStyle: 'bold', color: '#ff6666',
        backgroundColor: '#0d0d22cc', padding: 6
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(96),
      712, 10
    );
    // Щиты команд по краям ряда. Размер 31×38 (Ш×В): чуть меньше «вровень
    // с плашкой счёта» (~39 в высоту) и больше прежнего 26×32. Пропорция 26/32.
    // Нет артов — ряд без них.
    const _badgeH = 38;
    const _badgeW = 31;
    scene.scoreBadgeB = null;
    scene.scoreBadgeR = null;
    if (scene.textures.exists('badge_blue')) {
      scene.scoreBadgeB = scene.addHudElement(
        scene.add.image(0, 10, 'badge_blue')
          .setOrigin(0.5, 0).setScrollFactor(0).setDepth(96),
        0, 10
      );
      scene.scoreBadgeB.setDisplaySize(_badgeW, _badgeH);
    }
    if (scene.textures.exists('badge_red')) {
      scene.scoreBadgeR = scene.addHudElement(
        scene.add.image(0, 10, 'badge_red')
          .setOrigin(0.5, 0).setScrollFactor(0).setDepth(96),
        0, 10
      );
      scene.scoreBadgeR.setDisplaySize(_badgeW, _badgeH);
    }
    // Ссылки на HUD-записи ряда счёта: каждый кадр центрируем ряд
    // вокруг x640 (см. update) — иначе при длинных числах ряд кренится.
    // Поиск по объекту, а не по индексу (бейджи созданы позже текстов).
    scene._scoreBlueItem = scene.hudFixed.find(h => h.obj === scene.scoreBlue) || null;
    scene._scoreMidItem = scene.hudFixed.find(h => h.obj === scene.scoreMid) || null;
    scene._scoreRedItem = scene.hudFixed.find(h => h.obj === scene.scoreRed) || null;
    scene._scoreBadgeBItem = scene.scoreBadgeB ? scene.hudFixed.find(h => h.obj === scene.scoreBadgeB) : null;
    scene._scoreBadgeRItem = scene.scoreBadgeR ? scene.hudFixed.find(h => h.obj === scene.scoreBadgeR) : null;
    // Точки прогресса (CTF/BOMB с малым лимитом): один ряд под счётом,
    // строго по центру x640, y72 — ряд цифр (y10) и таймеры не задевает
    // (таймер в этом режиме сидит в самом ряду, см. update).
    // Рисуем в локальных координатах вокруг (0,0), якорь — (640, 72).
    scene.scoreDots = null;
    scene._dotsSig = null;
    if (scene.mode === 'CTF' || scene.mode === 'BOMB') {
      const dg = scene.add.graphics().setScrollFactor(0).setDepth(96);
      scene.scoreDots = scene.addHudElement(dg, 640, 72);
    }
  }

  // KOTH: таймер матча + буквы точек цветом владельца.
  // Бейдж мутаторов (п.14.2): слева вверху, статичен на матч.
  scene.mutBadge = null;
  try {
    const muts = scene.mutators || [];
    if (Array.isArray(muts) && muts.length) {
      const names = { knives: 'НОЖИ', fog: 'ТУМАН', moon: 'ЛУНА', glass: 'СТЕКЛО' };
      const label = 'МУТ: ' + muts.map(id => names[id] || id).join('+');
      scene.mutBadge = scene.addHudElement(
        scene.add.text(20, 10, label, {
          fontSize: '12px', color: '#ffd24a',
          backgroundColor: '#0d0d22cc', padding: 4
        }).setOrigin(0, 0).setScrollFactor(0).setDepth(96),
        20, 10
      );
    }
  } catch (e) { scene.mutBadge = null; }
  // Строгий ряд под счётом: счёт (y10) → таймер/буквы (y62).
  scene.kothTimerHud = null;
  scene.kothLetters = [];
  if (scene.mode === 'KOTH') {
    scene.kothTimerHud = scene.addHudElement(
      scene.add.text(560, 62, '', {
        fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#0d0d22cc', padding: 5
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(96),
      560, 62
    );
    ['А', 'Б', 'С'].forEach((L, i) => {
      scene.kothLetters.push(scene.addHudElement(
        scene.add.text(608 + i * 32, 62, L, {
          fontSize: '16px', fontStyle: 'bold', color: '#888899',
          backgroundColor: '#0d0d22cc', padding: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(96),
        608 + i * 32, 62
      ));
    });

    // Ряд-канат ВМЕСТО цифр счёта: [щит] [синяя полоса с числом]
    // [лимит] [красная полоса с числом] [щит]. Полосы ползут от краёв,
    // число счёта — внутри полосы, лимит — между полосами, таймер ниже.
    // Старый цифровой ряд прячем (только KOTH, остальные режимы как были).
    try {
      if (scene.scoreBlue) scene.scoreBlue.setVisible(false);
      if (scene.scoreMid) scene.scoreMid.setVisible(false);
      if (scene.scoreRed) scene.scoreRed.setVisible(false);
      if (scene.scoreBadgeB) scene.scoreBadgeB.setVisible(false);
      if (scene.scoreBadgeR) scene.scoreBadgeR.setVisible(false);
    } catch (e) {}
    scene._kRowBlueFill = null;
    scene._kRowRedFill = null;
    scene._kRowBlueNum = null;
    scene._kRowRedNum = null;
    scene._kRowLimNum = null;
    scene._kRowLimShown = -1;
    {
      const RY = 24, BW = 320, BH = 26, FH = 20;
      const LBX = 438, RBX = 842; // центры полос
      if (scene.textures.exists('badge_blue')) {
        scene.addHudElement(
          scene.add.image(252, RY, 'badge_blue').setOrigin(0.5).setScrollFactor(0).setDepth(96),
          252, RY
        ).setDisplaySize(26, 32);
      }
      if (scene.textures.exists('badge_red')) {
        scene.addHudElement(
          scene.add.image(1028, RY, 'badge_red').setOrigin(0.5).setScrollFactor(0).setDepth(96),
          1028, RY
        ).setDisplaySize(26, 32);
      }
      scene.addHudElement(
        scene.add.rectangle(LBX, RY, BW, BH, 0x1a1a2e).setScrollFactor(0).setDepth(96),
        LBX, RY
      ).setStrokeStyle(1, 0x556688, 1);
      scene._kRowBlueFill = scene.addHudElement(
        scene.add.rectangle(LBX - BW / 2, RY, BW, FH, 0x4488ff).setOrigin(0, 0.5).setScrollFactor(0).setDepth(97),
        LBX - BW / 2, RY
      );
      scene._kRowBlueNum = scene.addHudElement(
        scene.add.text(LBX, RY, '0', {
          fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(98),
        LBX, RY
      );
      scene._kRowLimNum = scene.addHudElement(
        scene.add.text(640, RY, '', {
          fontSize: '20px', fontStyle: 'bold', color: '#ffd24a'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(98),
        640, RY
      );
      scene.addHudElement(
        scene.add.rectangle(RBX, RY, BW, BH, 0x1a1a2e).setScrollFactor(0).setDepth(96),
        RBX, RY
      ).setStrokeStyle(1, 0x556688, 1);
      scene._kRowRedFill = scene.addHudElement(
        scene.add.rectangle(RBX + BW / 2, RY, BW, FH, 0xff4444).setOrigin(1, 0.5).setScrollFactor(0).setDepth(97),
        RBX + BW / 2, RY
      );
      scene._kRowRedNum = scene.addHudElement(
        scene.add.text(RBX, RY, '0', {
          fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(98),
        RBX, RY
      );
    }
  }

  // BOMB: статусы бомб + таймер раунда.
  // Ряды: счёт (y10) → таймер/событие (y62) → статусы (y110).
  // Вместо слов «СИНЯЯ:/КРАСНАЯ:» — щиты команд, дальше значение.
  scene.bombHudBlue = null;
  scene.bombHudRed = null;
  scene.bombTimerHud = null;
  if (scene.mode === 'BOMB') {
    // Иконка заряда слева от подписи (аспект арта 775:365).
    if (scene.textures.exists('bomb_ally')) {
      scene.addHudElement(
        scene.add.image(412, 110, 'bomb_ally')
          .setOrigin(1, 0.5).setScrollFactor(0).setDepth(96),
        412, 110
      ).setDisplaySize(40, 19);
    }
    // Щит синих вместо «СИНЯЯ:» (30×37, аспект 422:522).
    if (scene.textures.exists('badge_blue')) {
      scene.addHudElement(
        scene.add.image(416, 110, 'badge_blue')
          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
        416, 110
      ).setDisplaySize(30, 37);
    }
    scene.bombHudBlue = scene.addHudElement(
      scene.add.text(452, 110, '', {
        fontSize: '14px', fontStyle: 'bold', color: '#88dd88',
        backgroundColor: '#0d0d22cc', padding: 5
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
      452, 110
    );
    // Щит красных вместо «КРАСНАЯ:».
    if (scene.textures.exists('badge_red')) {
      scene.addHudElement(
        scene.add.image(708, 110, 'badge_red')
          .setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
        708, 110
      ).setDisplaySize(30, 37);
    }
    // Иконка заряда справа от красного статуса (места хватает до 950+).
    if (scene.textures.exists('bomb_foe')) {
      scene.addHudElement(
        scene.add.image(704, 110, 'bomb_foe')
          .setOrigin(1, 0.5).setScrollFactor(0).setDepth(96),
        704, 110
      ).setDisplaySize(40, 19);
    }
    scene.bombHudRed = scene.addHudElement(
      scene.add.text(744, 110, '', {
        fontSize: '14px', fontStyle: 'bold', color: '#88dd88',
        backgroundColor: '#0d0d22cc', padding: 5
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
      744, 110
    );
    scene.bombTimerHud = scene.addHudElement(
      scene.add.text(640, 62, '', {
        fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#0d0d22cc', padding: 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(96),
      640, 62
    );
  }

  // CTF: таймер раунда под счётом (как у KOTH/BOMB).
  // В овертайме — «ОТ»: идёт внезапная смерть за золотой флаг.
  scene.ctfTimerHud = null;
  if (scene.mode === 'CTF') {
    scene.ctfTimerHud = scene.addHudElement(
      scene.add.text(640, 62, '', {
        fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#0d0d22cc', padding: 5
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(96),
      640, 62
    );
  }

  // TDM: таймер раунда под счётом. В овертайме — «ОТ»: до первого кила.
  scene.tdmTimerHud = null;
  if (scene.mode === 'TDM') {
    scene.tdmTimerHud = scene.addHudElement(
      scene.add.text(640, 62, '', {
        fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#0d0d22cc', padding: 5
      }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(96),
      640, 62
    );
  }

  scene.expBarBg = scene.addHudElement(
    scene.add.rectangle(0, 712, 620, 18, 0x222244, 0.95)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(95),
    350, 712
  );

  scene.expBarFill = scene.addHudElement(
    scene.add.rectangle(0, 712, 0, 14, 0xffee55, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(96),
    352, 712
  );

  scene.expRankText = scene.addHudElement(
    scene.add.text(640, 712, '', {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffeeaa',
      backgroundColor: '#00000040',
      padding: { left: 8, right: 8, top: 1, bottom: 1 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(99),
    640, 712
  );

  scene.expRelText = scene.addHudElement(
    scene.add.text(985, 712, '', {
      fontSize: '11px',
      color: '#8899aa'
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(97),
    985, 712
  );

  scene.weaponSlots = [];
  scene.weaponSlotHits = [];
  scene.weaponSlotTexts = [];
  // Оружие без ячеек: только иконка + подпись + патроны, у выбранного —
  // светящийся контур. boxW/boxH остались для хитзоны и фита иконок.
  for (let i = 0; i < 3; i++) {
    const sx = [78, 226, 374][i];
    // Слоты опущены на 10 (иконка+подпись+рамка), патроны на месте.
    const sy = 650;
    const boxW = i === 0 ? 148 : 140;
    const boxH = 96;
    // Основное (слот 0) — заметно крупнее. Подписи все на одной
    // высоте (y=606), вплотную над иконками, но без налезания.
    const iconW = i === 0 ? 112 : 75;
    const iconH = i === 0 ? 52 : 39;
    const lo = 44;
    const ao = i === 0 ? 56 : 50;

    // Контур выбранного (рисуется в мировых координатах вокруг иконки,
    // перерисовка только при смене выбора — см. update ниже).
    const sel = scene.addHudElement(
      scene.add.graphics()
        .setScrollFactor(0).setDepth(95),
      sx, sy
    );
    sel._noHudScale = true;

    const hit = scene.addHudElement(
      scene.add.rectangle(sx, sy, boxW + 8, boxH + 76, 0xffffff, 0.001)
        .setScrollFactor(0).setDepth(94),
      sx, sy
    );
    hit._noHudScale = true;
    // Клик по слоту НЕ переключает оружие (только клавиши 1/2/3 и колесо):
    // хитзона остаётся невидимой заглушкой без интерактива.

    const icon = scene.addHudElement(
      scene.add.image(sx, sy, 'icon_rifle')
        .setScrollFactor(0).setDepth(96),
      sx, sy
    );
    icon._noHudScale = true;
    icon.setScale(0.6);

    const label = scene.addHudElement(
      scene.add.text(sx, sy - lo, '', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#cccccc',
        backgroundColor: '#0d0d22cc',
        padding: 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(96),
      sx, sy - lo
    );
    label._noHudScale = true;

    const ammoText = scene.addHudElement(
      scene.add.text(sx, sy + ao - 10, '', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#dddddd',
        backgroundColor: '#0d0d22cc',
        padding: 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(96),
      sx, sy + ao - 10
    );
    ammoText._noHudScale = true;

    // Пипсы магазинов запаса (макс. 2): вместо цифр запаса у
    // магазинного оружия. Позиция — точка ammoText, рисуем локально
    // правее числа. У трубки/ножа скрыты.
    const mags = scene.addHudElement(
      scene.add.graphics().setScrollFactor(0).setDepth(96),
      sx, sy + ao - 10
    );
    mags._noHudScale = true;

    scene.weaponSlots.push({ sel, selActive: null, sx, sy, boxW, boxH, iconW, iconH });
    scene.weaponSlotHits.push(hit);
    scene.weaponSlotTexts.push({ icon, label, ammoText, mags });
  }

  // Ячейки гранат в том же стиле (wslot + иконка + клавиша + счёт).
  // Справа от полос HP (конец 900), левее круга абилки (начало 1048):
  // строки ульты (y622) и опыта (y703+) не задевают.
  scene.grenSlots = [];
  [
    { type: 'frag', key: 'G', gx: 936 },
    { type: 'smoke', key: 'H', gx: 1004 }
  ].forEach(gd => {
    const gy = 660;
    const bg = scene.addHudElement(
      scene.add.image(gd.gx, gy, 'wslot')
        .setScrollFactor(0).setDepth(95),
      gd.gx, gy
    );
    bg._noHudScale = true;
    bg.setScale(Math.min(64 / bg.width, 56 / bg.height));
    const texKey = (gd.type === 'frag' ? 'frag_granade' : 'smoke_granade');
    const iconKey = scene.textures.exists(texKey) ? texKey
      : (scene.textures.exists('grenade') ? 'grenade' : null);
    let gicon = null;
    if (iconKey) {
      gicon = scene.addHudElement(
        scene.add.image(gd.gx, gy, iconKey)
          .setScrollFactor(0).setDepth(96),
        gd.gx, gy
      );
      gicon._noHudScale = true;
      gicon.setScale(Math.min(40 / gicon.width, 36 / gicon.height));
    }
    const keyTxt = scene.addHudElement(
      scene.add.text(gd.gx - 24, gy - 20, gd.key, {
        fontSize: '11px', fontStyle: 'bold', color: '#aaffaa',
        backgroundColor: '#0d0d22cc', padding: 2
      }).setOrigin(0.5).setScrollFactor(0).setDepth(97),
      gd.gx - 24, gy - 20
    );
    keyTxt._noHudScale = true;
    const cntTxt = scene.addHudElement(
      scene.add.text(gd.gx + 20, gy + 16, '0', {
        fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
        backgroundColor: '#0d0d22cc', padding: 2
      }).setOrigin(0.5).setScrollFactor(0).setDepth(97),
      gd.gx + 20, gy + 16
    );
    cntTxt._noHudScale = true;
    const hit = scene.addHudElement(
      scene.add.rectangle(gd.gx, gy, 68, 60, 0xffffff, 0.001)
        .setScrollFactor(0).setDepth(94),
      gd.gx, gy
    );
    hit._noHudScale = true;
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
      if (!scene.player || scene.player.dead) return;
      // Цель — текущий прицел; если он бит (NaN) — кидаем вперёд,
      // иначе граната улетит в NaN и дым/взрыв будут невидимы.
      const ax = Number.isFinite(scene.player.aimX) ? scene.player.aimX : scene.player.x + 200;
      const ay = Number.isFinite(scene.player.aimY) ? scene.player.aimY : scene.player.y;
      scene.player.throwGrenade(gd.type, ax, ay);
    });
    scene.grenSlots.push({ type: gd.type, bg, icon: gicon, count: cntTxt, gx: gd.gx, gy });
  });

  scene.hpDisp = scene.player.hp;
  scene.armorDisp = scene.player.armor;
  scene.expDisp = gameState.experience;
  scene._prevLevel = gameState.level;
  scene.abilityDisp = 0;

  if (scene.mode === 'TRIAL') {
    scene.trialHud = scene.addHudElement(
      scene.add.text(640, 40, '', {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffe08a',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(98),
      640, 40
    );
    scene.trialBestHud = scene.addHudElement(
      scene.add.text(1150, 30, '', {
        fontSize: '14px',
        color: '#ccd6ff',
        align: 'right'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(98),
      1120, 30
    );
    scene.trialPerksHud = scene.addHudElement(
      scene.add.text(18, 78, '', {
        fontSize: '13px',
        color: '#b8ffd0',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'left',
        lineSpacing: 2,
        wordWrap: { width: 260 }
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(98),
      18, 78
    );
  }
}

// Боковое табло одной команды на экране победы.
// mine=true — слева моя команда, иначе справа противник.
