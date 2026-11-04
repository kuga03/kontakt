// hud.js — полоски/ник/значки игрока каждый кадр (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами. Посадка уборов (GEAR_FIT) переехала сюда
// целиком — больше нигде не используется. GEO_HUMAN — копия флага.
import { classBadgeKey } from '../../data/weapons.js';

// ГЕОМЕТРИЧЕСКИЙ персонаж: копия флага из Player.js (там свой для
// оставшегося кода) — значение заморожено (true), дрейфа нет.
const GEO_HUMAN = true;

// Посадка уборов: ширина в диаметрах живой головы (fit), дальше размер
// правится вкусом cap.s. Вне-сетевые уборы удалены из игры.
// (Переехало из Player.js: единственный потребитель — updateBars ниже.)
const GEAR_FIT = {
  'военный_шлем': 1.45,
  'камуфляжный_шлем': 1.45,
  'бескозырка': 1.2,
  'маска_ночная': 1.45,
  'фуражка_парадная': 1.2,
  'шляпа_закона': 1.7,
  'берет_десанта': 1.2,
  'берет_стрелка': 1.2,
  'бандана_атлета': 1.2,
  'маска_сапёра': 1.5,
  'каска_пожарная': 1.45
};

// Мало патронов (<20% всего боезапаса текущего ствола)?
// Мили и бесконечные (ульта штурмовика) — мимо.
export function ammoLow(player) {
  try {
    const w = player.weapon;
    if (!w || w.isMelee || w.infiniteAmmo) return false;
    const max = (w.magazineSize | 0) + (w._initReserve ?? w.reserveAmmo | 0);
    if (!(max > 0)) return false;
    return ((w.magazine | 0) + (w.reserveAmmo | 0)) < max * 0.2;
  } catch (e) { return false; }
}

export function updateBars(player) {
  if (player.dead) {
    // После респауна полоски обязаны перерисоваться с нуля: без сброса
    // кэша длины они могли остаться от последнего кадра до смерти.
    player._hpBarW = -1;
    player._armorBarW = -1;
    try { if (player._ammoMark && player._ammoMark.visible) { player._ammoMark.clear(); player._ammoMark.setVisible(false); } } catch (e) {}
    try { if (player.nameBadge && player.nameBadge.visible) player.nameBadge.setVisible(false); } catch (e) {}
    return;
  }

  // Тень под ногами — только на земле (в прыжке/полёте прячем).
  try {
    const b = player.body;
    if (player._shadow && player._shadow.active) {
      if (player._lodHideShadow) {
        if (player._shadow.visible) player._shadow.setVisible(false);
      } else if (b && (b.blocked.down || b.touching.down)) {
        player._shadow.setVisible(true);
        player._shadow.setPosition(player.x, b.bottom + 1);
      } else {
        player._shadow.setVisible(false);
      }
    }
  } catch (e) {}

  const hc = player._partCfg('head');
  player._updateThrowAnim();
  if (player._recoilT > 0) {
    const dt = (player.scene.game.loop && player.scene.game.loop.delta) || 16;
    player._recoilT = Math.max(0, player._recoilT - dt);
  }
  // Затухание взмаха — тем же кадром, что отдача.
  if (player._swingT > 0) {
    const dt = (player.scene.game.loop && player.scene.game.loop.delta) || 16;
    player._swingT = Math.max(0, player._swingT - dt);
  }
  player._updateParts();

  // Голова/шея/лицо — для ВСЕХ: раньше этот блок стоял ниже
  // `if (!showBars) return` и у своего игрока (и красных) физика головы
  // висела на точке спавна. В GEO тут же едут глаза и кепка.
  let headX, headY;
  if (player.headImg) {
    const ctr = player._pointOn(player.headImg, hc, 0.5, 0.5);
    headX = ctr.x;
    headY = ctr.y;
  } else {
    // фолбэк-голова (круг): сажаем на «шею» — верх торса, а не в центр корпуса
    const side = player.aimX >= player.x ? 1 : -1;
    const neck0 = player._anchorFor('head');
    headX = neck0.x + (side < 0 ? hc.mx : hc.ox);
    headY = neck0.y + (side < 0 ? hc.my : hc.oy) + (player.crouching ? 12 : 0);
    // Пивот головы: отклонение шарнира от дефолта (0.5/0.93) двигает голову
    // вперёд по взгляду (зеркалится стороной). В дефолте сдвиг нулевой.
    const hD = (player._geoHeadR || 8) * 2;
    headX += side * (0.5 - (hc.px ?? 0.5)) * hD;
    headY += (0.93 - (hc.py ?? 0.93)) * hD;
  }
  // Голова слегка тянется за курсором: наклон за прицелом, глаза и убор
  // едут следом (ниже: eY, зрачки, поворот кепки).
  let _leanX = 0, _leanY = 0;
  try {
    const _hr0 = player._geoHeadR || 8;
    _leanX = Phaser.Math.Clamp((player.aimX - headX) / 220, -1, 1);
    _leanY = Phaser.Math.Clamp((player.aimY - headY) / 220, -1, 1);
    headX += _leanX * _hr0 * 0.22;
    headY += _leanY * _hr0 * 0.18;
  } catch (e) {}
  // Твёрдость головы: не даём уйти в платформу (иначе хитбокс головы
  // торчит сквозь и по нему бьют, в т.ч. по «старой» точке при приседе).
  // Выдавливаем вниз под поверхность — лицо/кепка/тело едут следом.
  try {
    const _sc = player.scene;
    if (_sc && typeof _sc._inSolid === 'function') {
      for (let _gi = 0; _gi < 3 && _sc._inSolid(headX, headY, 4); _gi++) {
        headY += 6;
      }
    }
  } catch (e) {}
  if (player.head && player.head.body) {
    player.head.body.reset(headX, headY);
  }
  // Геометрическое лицо едет за головой: глаза смотрят в сторону взгляда,
  // кепка сидит на макушке, козырёк — вперёд.
  if (typeof GEO_HUMAN !== 'undefined' && GEO_HUMAN && player._geoFace && player._geoFace.length) {
    const fside = player.aimX >= player.x ? 1 : -1;
    const hr = player._geoHeadR || 8;
    const eY = headY - hr * 0.12 + _leanY * hr * 0.15;
    if (player._neckVis) player._neckVis.setPosition(headX - fside * hr * 0.14, headY + hr * 0.72);
    if (player._eyeWF) player._eyeWF.setPosition(headX + fside * hr * 0.02, eY);
    if (player._faceOv) {
      player._faceOv.setPosition(headX, headY);
      try { player._faceOv.setScale((hr * 2) / 20); } catch (e2) {}
      try { player._faceOv.setFlipX(fside < 0); } catch (e) {}
    }
    if (player._eyePF) player._eyePF.setPosition(headX + fside * (hr * 0.02 + hr * 0.10) + _leanX * hr * 0.10, eY);
    if (player._eyeWB) player._eyeWB.setPosition(headX + fside * hr * 0.42, eY - hr * 0.04);
    if (player._eyePB) player._eyePB.setPosition(headX + fside * (hr * 0.42 + hr * 0.08) + _leanX * hr * 0.10, eY - hr * 0.04);
    // Брови с лёгким сосредоточенным наклоном, ухо сзади, спинка носа спереди, сжатые губы.
    if (player._browF) {
      player._browF.setPosition(headX + fside * hr * 0.02, headY - hr * 0.44);
      try { player._browF.setRotation(fside * 0.10); } catch (e) {}
    }
    if (player._browB) {
      player._browB.setPosition(headX + fside * hr * 0.42, headY - hr * 0.48);
      try { player._browB.setRotation(fside * 0.08); } catch (e) {}
    }
    if (player._ear) player._ear.setPosition(headX - fside * hr * 0.78, headY + hr * 0.05);
    if (player._nose) {
      player._nose.setPosition(headX + fside * hr * 0.86, headY + hr * 0.10);
      try { player._nose.setRotation(-fside * 0.18); } catch (e) {}
    }
    if (player._mouth) {
      player._mouth.setPosition(headX + fside * hr * 0.38, headY + hr * 0.48);
      try { player._mouth.setRotation(fside * 0.04); } catch (e) {}
    }
    if (player.capImg) {
      // Размер убора — от живой ширины головы (а не от констант):
      // fit = ширина убора в диаметрах головы, cap.s — вкус (11 = норма).
      // Поэтому шлемы/шляпы сидят при любом размере головы и превью.
      try {
        const cc = player._partCfg('cap');
        const tkey = (player.capImg.texture && player.capImg.texture.key) || '';
        const tw = (player.capImg.frame && player.capImg.frame.realWidth) || player.capImg.displayWidth || 30;
        const stockCap = tkey.startsWith('__geo_cap');
        const fit = (GEAR_FIT[tkey] ?? (stockCap ? 1.1 : 1.2));
        const headD = (player.head && player.head.displayWidth) || hr * 2;
        // Стоковые (классовые) кепки чуть крупнее покупных уборов — тот же
        // коэффициент, что в Player/previewScale. updateBars пересчитывает
        // масштаб каждый кадр и перекрывает значения конструктора.
        const cs = (headD * fit / Math.max(1, tw)) * ((cc.s || 11) / 11 / (player._previewK || 1)) * (stockCap ? 1.12 : 1);
        player.capImg.setScale(cs * fside, cs);
      } catch (e) {}
      player.capImg.setPosition(headX, headY - hr * 0.82);
      // Пивот кепки: отклонение от дефолта (0.5/0.15) двигает убор
      // вперёд по взгляду (fside уже зеркалит сторону).
      try {
        const cc = player._partCfg('cap');
        const cw = player.capImg.displayWidth || 1;
        const chh = player.capImg.displayHeight || 1;
        player.capImg.x += fside * (0.5 - (cc.px ?? 0.5)) * cw;
        player.capImg.y += (0.15 - (cc.py ?? 0.15)) * chh;
      } catch (e) {}
      // Убор слегка кренится за вертикалью прицела.
      try { player.capImg.rotation = _leanY * 0.1 * fside; } catch (e) {}
    }
  }
  {
    const neck = player._anchorFor('head');
    if (player.neck && player.neck.body) {
      player.neck.body.reset(neck.x, neck.y);
    }
  }
  if (player.aura) {
    player.aura.setPosition(player.x, player.y);
  }

  const showBars = player.isAI && player.team === 'blue';
  if (player.healthBar.visible !== showBars) {
    player.healthBar.setVisible(showBars);
    player.armorBar.setVisible(showBars);
  }
  // Ник — над всеми живыми (цвет по команде), полоски — только союзникам.
  if (!player.nameText.visible) player.nameText.setVisible(true);
  // Позиция ника — для ВСЕХ (раньше была ниже раннего return и игрок/
  // красные видели ник в точке 0,0). Ник приспущен ближе к голове.
  try {
    const nk = player._rigHitboxK();
    player.nameText.setPosition(player.x, player.crouching ? player.y - 20 * nk : player.y - 50 * nk);
  } catch (e) {}
  // Значок класса слева от ника — у всех живых (кроме превью
  // в редакторах: там ники гасят сценами, а _editorGrounded выдаёт их).
  try {
    if (!player.nameBadge) {
      const bk = (typeof classBadgeKey === 'function')
        ? classBadgeKey(player.constructor ? player.constructor.name : null) : null;
      if (bk && player.scene && player.scene.textures && player.scene.textures.exists(bk)) {
        player.nameBadge = player.scene.add.image(0, 0, bk);
        player.nameBadge.setDepth(7);
        player.nameBadge.setDisplaySize(14, 14);
      }
    }
    if (player.nameBadge) {
      const show = !player.dead && !player._editorGrounded && !player._lodHideBadge && player.nameText.visible;
      if (show) {
        const nw = player.nameText.displayWidth || 0;
        player.nameBadge.setPosition(player.nameText.x - nw / 2 - 12, player.nameText.y - 8);
        if (!player.nameBadge.visible) player.nameBadge.setVisible(true);
      } else if (player.nameBadge.visible) {
        player.nameBadge.setVisible(false);
      }
    }
  } catch (e) {}
  if (!showBars) {
    try { if (player._ammoMark && player._ammoMark.visible) { player._ammoMark.clear(); player._ammoMark.setVisible(false); } } catch (e) {}
    return;
  }

  const width = 42;
  const armorMax = Math.max(1, player.maxArmor);
  const hpWidth = width * Math.max(0, player.hp / Math.max(1, player.maxHp));
  const armorWidth = width * Math.max(0, player.armor / armorMax);

  // Плашки над головой едут за масштабом рига (у больших персов не на лице).
  // Полоски вплотную, ник почти на полоске хп.
  const k = player._rigHitboxK();
  const hpY = player.crouching ? player.y - 18 * k : player.y - 52 * k;
  const armorY = player.crouching ? player.y - 12 * k : player.y - 46 * k;
  const nameY = player.crouching ? player.y - 20 * k : player.y - 50 * k;

  // Полоски рисуем локально (0,0) и двигаем объектом: clear/fill каждый
  // кадр на каждого синего бота — лишняя перестройка WebGL-геометрии.
  // Перерисовываем только при заметном изменении длины (0.5px).
  const _bw = player.healthBar;
  if (Math.abs((player._hpBarW ?? -1) - hpWidth) >= 0.5) {
    player._hpBarW = hpWidth;
    _bw.clear();
    _bw.fillStyle(0x222222);
    _bw.fillRect(0, 0, width, 5);
    _bw.fillStyle(0xff3333);
    _bw.fillRect(0, 0, hpWidth, 5);
  }
  _bw.setPosition(player.x - width / 2, hpY);

  const _ab = player.armorBar;
  if (Math.abs((player._armorBarW ?? -1) - armorWidth) >= 0.5 ||
      (player._armorBarMax ?? -1) !== armorMax) {
    player._armorBarW = armorWidth;
    player._armorBarMax = armorMax;
    _ab.clear();
    _ab.fillStyle(0x222222);
    _ab.fillRect(0, 0, width, 4);
    _ab.fillStyle(0x55aaff);
    _ab.fillRect(0, 0, armorWidth, 4);
  }
  _ab.setPosition(player.x - width / 2, armorY);

  // Значок патрона слева от полосок: у текущего ствола <20% боезапаса.
  // Только там, где есть сами полоски (синие боты).
  // Пульсация 2с: секунда таем до 30%, секунду восстанавливаем до 100%.
  try {
    if (player._ammoMark) {
      if (ammoLow(player)) {
        let now = 0;
        try { now = (player.scene && player.scene.time && player.scene.time.now) || 0; } catch (e) {}
        if (!now) now = Date.now();
        const ph = ((now % 2000) + 2000) % 2000 / 2000;
        const a = ph < 0.5 ? 1 - ph * 2 * 0.7 : 0.3 + (ph - 0.5) * 2 * 0.7;
        const ax = player.x - width / 2 - 12, ay = hpY - 2;
        player._ammoMark.clear();
        // Латунная гильза с носиком.
        player._ammoMark.fillStyle(0xd8a920, a);
        player._ammoMark.fillRect(ax, ay, 6, 8);
        player._ammoMark.fillTriangle(ax, ay, ax + 6, ay, ax + 3, ay - 5);
        player._ammoMark.lineStyle(1, 0x7a5c10, a);
        player._ammoMark.strokeRect(ax, ay, 6, 8);
        if (!player._ammoMark.visible) player._ammoMark.setVisible(true);
      } else if (player._ammoMark.visible) {
        player._ammoMark.clear();
        player._ammoMark.setVisible(false);
      }
    }
  } catch (e) {}

  player.nameText.setPosition(player.x, nameY);
}
