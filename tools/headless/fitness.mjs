// fitness.mjs — фитнес и штрафы без зависимостей от игрового кода.
// Используется и харнессом (metrics.mjs), и тренером (evolve.mjs).

// Поломки из дамп-счётчиков: застревания/стойки/пилы. Чем меньше — тем лучше.
export function breakagePenalty(saw) {
  if (!saw) return 0;
  const g = (k) => (typeof saw[k] === 'number' ? saw[k] : 0);
  return (
    g('freeze') * 3 +
    g('wedge') * 2 +
    g('detstuck') * 0.5 +
    g('pile') * 1 +
    g('chskip') * 0.1 +
    g('chgrab') * 0.1 +
    g('jumploop') * 2 +
    g('wallshot') * 0.05
  );
}

// Общий фитнес матча. ЦЕЛЕВАЯ сторона — синяя: тренер ищет параметры, при
// которых синие доставляют флаг. Красные термы оставлены, но с малым весом:
// карта асимметрична (синяя база стоит на плите, красная — на ящике; см.
// docs/ctf-bots-learning.md §10.2), поэтому успех красных НЕ эквивалентен
// успеху синих. Раньше захваты ОБЕИХ команд суммировались с весом +200, и
// вклад доставки размывался — тренеру было всё равно, кто занёс.
export function matchFitness(m) {
  const MW = 3800;
  const captures = (m.scores.blue | 0) * 300 + (m.scores.red | 0) * 50; // доставка синих — главный сигнал
  const f = m.flag || {};
  const minB = (typeof f.minBlue === 'number') ? f.minBlue : MW;
  const minR = (typeof f.minRed === 'number') ? f.minRed : MW;
  // Приближение к вражескому флагу: синие ×3, красные ×1 (плотный прокси игры).
  const flagApproach = ((MW - minB) * 3 + (MW - minR)) / MW * 100;
  const flagPickups = (f.bluePickup | 0) * 25 + (f.redPickup | 0) * 5;
  const contrib = (m.team.blue.contrib | 0) * 0.5 + (m.team.red.contrib | 0) * 0.15;
  const kills = (m.team.blue.kills | 0) * 5 + (m.team.red.kills | 0) * 2;
  const pr = m.progress || { blue: 0, red: 0 };
  const progress = (pr.blue | 0) * 0.02 + (pr.red | 0) * 0.005;
  return captures + flagApproach * 2 + flagPickups + contrib + kills + progress - breakagePenalty(m.saw);
}
