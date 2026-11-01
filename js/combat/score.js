export function contribScore(p) {
  try {
    if (!p) return 0;
    return ((p.kills | 0) * 30)
      + Math.floor(((p.damageDealt || 0)) / 25)
      + ((p.flagsDelivered || 0) * 100)
      + ((p.plants || 0) * 100)
      + ((p.defuses || 0) * 50)
      + ((p.caps || 0) * 20)
      + ((p.returnsCount || 0) * 25)
      + ((p.carrierKills || 0) * 50)
      + (((p.healedGiven || 0)) * 0.5);
  } catch (e) {
    return 0;
  }
}

// Счётчик задачных эвентов игрока за матч (для калибровки медалей).
export function bumpObj(scene, key) {
  try {
    if (!scene || !key) return;
    scene._objStats = scene._objStats || {};
    scene._objStats[key] = (scene._objStats[key] | 0) + 1;
  } catch (e) {}
}

// Калибровочный лог боя (v1): компактная сводка для подбора условий медалей.
// Печатается в консоль + уходит в буфер кнопки «Лог матча» (см. copyDbg).
// Формат построчный, скидывать целиком.

