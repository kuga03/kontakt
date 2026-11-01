// guns.js — оружейный инвентарь (было в Player).
// Функции принимают игрока первым аргументом; в классе остались тонкие
// обёртки с теми же именами. Геттер weapon — accessor, остаётся в классе.
// Внутри модуля зовём друг друга напрямую.
import Weapon from '../Weapon.js?v=171';
import { weaponsList } from '../../data/weapons.js?v=170';
import { mergeGeneMods } from '../../data/genes.js?v=169';
import { totalSkillMods } from '../../data/skills.js?v=169';
import { gearSetBonus } from '../../data/gearSets.js?v=172';
import { applyWeaponUpgrade } from '../../data/upgrades.js?v=2';

export function addWeapon(player, name) {
  const data = weaponsList.find(item => item.name === name);
  if (!data) {
    console.warn('[Player] unknown weapon:', name);
    return;
  }
    const w = new Weapon(data);
    w.reloadMult = player.reloadMult || 1;
    w._scene = player.scene;
    // Владелец ствола — для позиционных звуков (клац трубки и т.п.).
    w._owner = player;
    const ammo = player.ammoMult || 1;
    if (!w.isMelee) {
      // Скилл на патроны качает РАЗМЕР магазина; запас — всегда
      // 2 полных магазина (сток). Выдаём полным и фиксируем базу,
      // чтобы revive()/resetAmmo() возвращали прокачанное, а не дату.
      // Одностволки (RPG: заряжен всегда 1) — размер не растёт:
      // иначе со скиллом на боезапас стреляет несколько раз подряд.
      if (ammo > 1 && w.magazineSize > 1) {
        w.magazineSize = Math.max(1, Math.round(w.magazineSize * ammo));
      }
      w.magazine = w.magazineSize;
      w.reserveAmmo = w.magazineSize * 2;
      w._initMagazine = w.magazineSize;
      w._initReserve = w.reserveAmmo;
      // Заточка +1…+5 (п.14.4): только удобство, только игроку.
      try { applyWeaponUpgrade(player, w); } catch (e) {}
    }
    player.inventory.push(w);
}

export function applyPassives(player) {
  // Боты качаются честно: дерево/гены/сеты игрока им не положены
  // (иначе враги росли вместе с прокачкой — баг «как в Обливионе»).
  // Сложность (урон/ХП/меткость/темп) им ставит applyBotDifficulty отдельно.
  if (player && player.isAI) {
    player.ammoMult = 1;
    try { player.hp = player.maxHp; } catch (e) {}
    return;
  }
  const m = mergeGeneMods(totalSkillMods());
  if (m.maxHp) player.maxHp += m.maxHp;
  if (m.maxArmor) player.maxArmor += m.maxArmor;
  if (m.damageMult) player.damageMult *= m.damageMult;
  if (m.takenMult) player.damageTakenMult *= m.takenMult;
  if (m.reloadMult) player.reloadMult *= m.reloadMult;
  if (m.rangeMult) player.rangeMult *= m.rangeMult;
  if (m.spreadMult) player.spreadMult *= m.spreadMult;
  if (m.headshotMult) player.headshotMult *= m.headshotMult;
  if (m.healMult) player.healMult *= m.healMult;
  if (m.regen) player.passiveRegen += m.regen;
  if (m.moveSpeedPct) player.moveSpeedPct += m.moveSpeedPct;
  // Бонус сета одежды: у каждого сета СВОЯ механика (скорость, реген,
  // урон, темп перезарядки, броня, боезапас) — считается чистой функцией
  // от надетого, сервер в онлайне пересчитает.
  try {
    const gb = (typeof gearSetBonus === 'function') ? gearSetBonus() : {};
    if (gb && gb.moveSpeedPct) player.moveSpeedPct += gb.moveSpeedPct;
    if (gb && gb.damagePct) player.damageMult *= (1 + gb.damagePct / 100);
    if (gb && gb.regen) player.passiveRegen += gb.regen;
    if (gb && gb.reloadMult) player.reloadMult *= gb.reloadMult;
    if (gb && gb.maxArmor) player.maxArmor += gb.maxArmor;
    // Новые механики сетов (Десант/Стрелок/Сапёр/Пожарный/Атлет):
    // чистая функция от надетого — сервер в онлайне пересчитает так же.
    if (gb && gb.maxHpPct) player.maxHp = Math.round(player.maxHp * (1 + gb.maxHpPct / 100));
    if (gb && gb.takenMult) player.damageTakenMult *= gb.takenMult;
    if (gb && gb.healMult) player.healMult *= gb.healMult;
    if (gb && gb.headshotMult) player.headshotMult *= gb.headshotMult;
    if (gb && gb.spreadMult) player.spreadMult *= gb.spreadMult;
  } catch (e) {}
  // Темп перезарядки сменился (скилл/сет) — разнести по выданным стволам:
  // иначе старые держат прежний w.reloadMult (новым ставит addWeapon).
  // Только огнестрел, только если поле есть.
  try {
    (player.inventory || []).forEach(w => {
      if (w && !w.isMelee && ('reloadMult' in w)) w.reloadMult = player.reloadMult || 1;
    });
  } catch (e) {}
  player.ammoMult = m.ammoMult || 1;
  // Боезапас от сета — ПОСЛЕ базы, иначе строка выше его затирает.
  try {
    const gb2 = (typeof gearSetBonus === 'function') ? gearSetBonus() : {};
    if (gb2 && gb2.ammoMult) player.ammoMult *= gb2.ammoMult;
  } catch (e) {}
  player.hp = player.maxHp;
  if (!player.isAI) player.armor = player.maxArmor;
}

export function selectWeapon(player, index) {
  const w = player.inventory[index];
  if (!w || index === player.activeWeaponIndex) return;
  // Носильщик бомбы: только второе оружие и нож (по ТЗ).
  if (player.isCarrier && w.category === 'primary') return;
  if (player.inventory[player.activeWeaponIndex]) {
    player.inventory[player.activeWeaponIndex].cancelReload();
    // Смена ствола гасит и флаг прерывания трубки (иначе залипший флаг
    // пропустит один автоперезапуск после возврата на ствол).
    try { player.inventory[player.activeWeaponIndex]._tubeInterrupted = false; } catch (e) {}
  }
  player.activeWeaponIndex = index;
}

// Выбор слота клавишами 1/2/3: 0 — основное, 1 — второе, 2 — холодное.
// По категории, а не по индексу: подобранный пистолет встаёт в конец
// инвентаря (за нож), а клавиша обязана давать второе оружие.
// Совпадает со статичными слотами HUD (см. GameScene).
export function selectWeaponSlot(player, slot) {
  try {
    const inv = player.inventory || [];
    const pred = slot === 0
      ? (w) => w && w.category === 'primary' && !w.isMelee
      : slot === 1
        ? (w) => w && w.category === 'secondary'
        : (w) => w && (w.isMelee || w.category === 'melee');
    const idx = inv.findIndex(pred);
    if (idx >= 0) selectWeapon(player, idx);
  } catch (e) {}
}

// Экипировать разрешённое носильщику (второе → нож). Вызывается при подборе.
export function armCarrierWeapon(player) {
  try {
    const inv = player.inventory || [];
    let idx = inv.findIndex(w => w && w.category !== 'primary' && !w.isMelee);
    if (idx < 0) idx = inv.findIndex(w => w && w.isMelee);
    if (idx >= 0 && idx !== player.activeWeaponIndex) {
      if (player.inventory[player.activeWeaponIndex]) {
        player.inventory[player.activeWeaponIndex].cancelReload();
        try { player.inventory[player.activeWeaponIndex]._tubeInterrupted = false; } catch (e) {}
      }
      player.activeWeaponIndex = idx;
    }
  } catch (e) {}
}

// Пусто в руках (0/0) — ищем ствол с патронами, иначе ближний бой.
// Возвращаем индекс или -1. Выстрела в этом тике нет — только смена.
export function autoSwitchWeapon(player) {
  if (!player.inventory || player.inventory.length < 2) return -1;
  let meleeIdx = -1;
  for (let i = 0; i < player.inventory.length; i++) {
    if (i === player.activeWeaponIndex) continue;
    const w = player.inventory[i];
    if (!w) continue;
    if (w.isMelee) {
      if (meleeIdx < 0) meleeIdx = i;
      continue;
    }
    if ((w.magazine | 0) + (w.reserveAmmo | 0) > 0) {
      selectWeapon(player, i);
      return i;
    }
  }
  if (meleeIdx >= 0) {
    selectWeapon(player, meleeIdx);
    return meleeIdx;
  }
  return -1;
}
