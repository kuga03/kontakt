// aim.js — прицел и раскладка оружия (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами. Вызывают из shoot.js, rig.js, ИИ и сцены.
export function aimAngle(player) {
  const bx = player.armGun ? player.armGun.x : player.x;
  const by = player.armGun ? player.armGun.y : player.y - 16;
  const eff = clampedAim(player, bx, by);
  return Phaser.Math.Angle.Between(bx, by, eff.x, eff.y);
}

// Влезает ли стоящее тело (56k): столбец 3×2 точки. Нет сцены — влезает.
// Прицел/LOS ботов берут голову/грудь отсюда же — в приседе голова
// НИЖЕ (иначе бот целит в пустое место над макушкой стоячего).
export function headYOffset(player) { return player.crouching ? 30 : 62; }
export function bodyYOffset(player) { return player.crouching ? 15 : 28; }

export function aimAt(player, x, y) {
  player.aimX = x;
  player.aimY = y;
  player.setFlipX(x < player.x);
}

// Какая сторона «впереди»: переворот происходит только ЖЁСТКО за пределами полосы
// (deadzone ±24px вокруг центра тела), и запоминается. Иначе прицел, ползущий по
// плечу/телу, дёргал бы персонажа и автомат туда-сюда через линию центра.
export function getSide(player) {
  if (typeof player.aimX !== 'number' || Number.isNaN(player.aimX)) return player._lastSide || 1;
  const dx = player.aimX - player.x;
  if (Math.abs(dx) < 24) return player._lastSide || 1;
  player._lastSide = dx > 0 ? 1 : -1;
  return player._lastSide;
}

// Цель прицела, прижатая ВПЕРЁД от точки sx/sy. Когда прицел «на себе» или за
// спиной (мёртвая зона _getSide), руки/ствол не выворачиваются назад: направляем
// их вперёд, сохраняя вертикальную составляющую (смотрю вниз/вверх — туда же,
// но не назад). Используется для рук, автомата и наклонов.
export function clampedAim(player, sx, sy) {
  const side = getSide(player);
  if (typeof player.aimX !== 'number' || Number.isNaN(player.aimX)) {
    return { x: sx + side * 40, y: sy };
  }
  const dx = player.aimX - sx;
  const dy = player.aimY - sy;
  const fwd = dx * side;
  if (fwd >= 16) return { x: player.aimX, y: player.aimY };
  const ang = Math.atan2(dy, Math.max(16, Math.abs(fwd)));
  const reach = Math.max(24, Math.hypot(dx, dy));
  return { x: sx + side * Math.cos(ang) * reach, y: sy + Math.sin(ang) * reach };
}

// Наклон головы/торса к прицелу (по прижатой вперёд цели): база угла — floor 26px,
// мёртвая зона ±0.35 рад (пока прицел почти на уровне глаз — не наклоняемся),
// плавная реакция до ±1.
export function leanFactor(player, dy, bx) {
  const ang = Phaser.Math.Clamp(Math.atan2(dy, Math.max(bx || 1, 26)), -1, 1);
  const DEADB = 0.35;
  const mag = Math.max(0, Math.abs(ang) - DEADB);
  return (mag / (1 - DEADB)) * Math.sign(ang || 1);
}

// Размер оружия из редактора (п.23–24): per-weapon gunScale из рига,
// 1 = как раньше. Хранится в localStorage — живёт без редактора.
export function gunScaleFor(player, name) {
  try {
    const rc = player._rcfg || {};
    const wh = (rc.weaponHands && rc.weaponHands[name]) || {};
    const v = Number(wh.gunScale);
    if (Number.isFinite(v)) return Phaser.Math.Clamp(v, 0.5, 2.5);
  } catch (e) {}
  return 1;
}

// Масштаб персонажа для пушки: ствол растёт вместе с телом
// (torso.s 22 = дефолт). Иначе большой персонаж держит игрушечный автомат.
export function charGunK(player) {
  try {
    const rc = player._rcfg || {};
    const s = (rc.torso && rc.torso.s) || 22;
    return Phaser.Math.Clamp(s / 22, 0.7, 2.2);
  } catch (e) {
    return 1;
  }
}

// Полный масштаб ствола: ручная настройка × размер персонажа.
export function gunFullScale(player, name) {
  return gunScaleFor(player, name) * charGunK(player);
}

// Прямой сдвиг ствола из редактора (СтвX вдоль ствола, СтвY поперёк),
// per-weapon. Даёт подвинуть пушку руками, а не только руки под пушку.
export function gunOffset(player, name) {
  try {
    const rc = player._rcfg || {};
    const wh = (rc.weaponHands && rc.weaponHands[name]) || {};
    return { x: Number(wh.gunOX) || 0, y: Number(wh.gunOY) || 0 };
  } catch (e) {
    return { x: 0, y: 0 };
  }
}
