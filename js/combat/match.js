// match.js - barrel after restructuring (was ~1562 lines monolith).
// contribScore/bumpObj moved to ../score.js (breaks hud<->match cycle).
// Rest moved to js/combat/match/*.js
export * from './score.js';
export * from './match/activity.js';
export * from './match/death.js';
export * from './match/victory.js';
export * from './match/endGame.js';
