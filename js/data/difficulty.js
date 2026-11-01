export const botDifficulties = [
  // reaction — задержка первого выстрела по новой цели;
  // lead — упреждение движущейся цели (0 — в текущую точку, 1 — в точку встречи);
  // burstLen — длина очереди, дальше пауза;
  // cadMult — темп ботов от темпа ствола (интервал = fireRate × cadMult),
  // чтобы миниган у бота реально поливал, а болтовка — нет.
  // NOTE: missRadius/shootInterval удалены — были мёртвыми полями
  // (точность задают hitChance+радиусы в aimPoint, темп — cadMult).
  { id: 'novice', label: 'Новичок', detail: 'точность ~32%, урон ×0.85',
    hitChance: 0.32, dmgMult: 0.85, moveSpread: 36,
    reaction: [550, 750], lead: 0.1, burstLen: 4, cadMult: 2.2 },
  { id: 'experienced', label: 'Бывалый', detail: 'точность ~68%',
    hitChance: 0.68, dmgMult: 1.05, moveSpread: 18,
    reaction: [220, 320], lead: 0.75, burstLen: 7, cadMult: 1.5 },
  { id: 'veteran', label: 'Ветеран', detail: 'точность ~90%, урон ×1.2, +15% HP врагам, стрельба в голову',
    hitChance: 0.9, aimChance: 0.7, hpBonus: 0.15, dmgMult: 1.2, moveSpread: 8,
    reaction: [60, 110], lead: 1, burstLen: 12, cadMult: 1.0 },
  // Песочница — только свободная игра (в кампанию и испытание не пускаем,
  // см. LobbyScene/GameScene): боты не стреляют вообще (флаг passive —
  // ворота в ai/shoot.js: стволы, нож и гранаты), опыт и деньги не даются
  // (ворота в combat/match.js). Остальные поля — страховочные.
  { id: 'sandbox', label: 'Песочница', detail: 'боты не стреляют, без наград',
    hitChance: 0, dmgMult: 0, moveSpread: 36, passive: true,
    reaction: [100000, 100000], lead: 0, burstLen: 0, cadMult: 99 }
];

export function getBotDifficulty(id) {
  // Фолбэк для битого id — novice (самый безопасный), как в nextBotDifficulty.
  return botDifficulties.find(d => d.id === id) || botDifficulties[0];
}

export function nextBotDifficulty(id) {
  const i = botDifficulties.findIndex(d => d.id === id);
  if (i < 0) return 'novice';
  return botDifficulties[(i + 1) % botDifficulties.length].id;
}