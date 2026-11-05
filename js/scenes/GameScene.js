import Assault from '../entities/Assault.js';
import Tank from '../entities/Tank.js';
import Medic from '../entities/Medic.js';
import Sniper from '../entities/Sniper.js';

import Pickup from '../entities/Pickup.js';

import { weaponsList } from '../data/weapons.js';

import * as LosMath from '../world/losMath.js';
import * as CameraRig from '../world/cameraRig.js';
import * as SoundSys from '../combat/soundSys.js';
import * as Fx from '../combat/fx.js';

import * as Arenas from '../world/arenas.js';
import * as Pickups from '../combat/pickups.js';
import * as Dump from '../debug/dump.js';
import { installPenWatch } from '../debug/penWatch.js';
import * as PauseModal from '../ui/pauseModal.js';
import * as Input from '../ui/input.js';
import * as NavGraph from '../world/navGraph.js';
import * as Hud from '../ui/hud.js';
import * as Trial from '../modes/trial.js';
import * as Koth from '../modes/koth.js';
import * as Ctf from '../modes/ctf.js';
import * as BombMode from '../modes/bomb.js';
import * as Campaign from '../modes/campaign.js';
import * as Match from '../combat/match.js';

import * as Bullets from '../combat/bullets.js';
import * as Grenades from '../combat/grenades.js';

const classMap = { Assault, Tank, Medic, Sniper };

// Захват точки / матч точек — константы живут в modes/koth.js.
const KOTH_NEED = Koth.KOTH_NEED;
// Матч точек: 5 минут, дальше — победа по счёту или овертайм.
const KOTH_TIME = Koth.KOTH_TIME;

const typeLabels = { Assault: 'Штурмовик', Tank: 'Танк', Medic: 'Медик', Sniper: 'Снайпер' };

const MAP_THEMES = {
  night:     { bg: 0x0a0a2a, below: 0x07091c, rim: 0x0f1430, bgTex: null },
  sunset:    { bg: 0x241024, below: 0x160a18, rim: 0x3b1a33, bgTex: null },
  wasteland: { bg: 0x1a1c12, below: 0x101208, rim: 0x2a2c18, bgTex: 'fon_ulici' },
  krisha:    { bg: 0x1a1820, below: 0x0f1018, rim: 0x2a2830, bgTex: 'fon_krisha' },
  ulica:     { bg: 0x181620, below: 0x0e0e18, rim: 0x242230, bgTex: 'fon_ulici' },
  pechera:   { bg: 0x080808, below: 0x040404, rim: 0x101010, bgTex: 'fon_pechera' },
  peshera:   { bg: 0x0a0a0c, below: 0x060606, rim: 0x121214, bgTex: 'fon_peshera' },
  pustoch:   { bg: 0x1a1208, below: 0x100c04, rim: 0x2a2010, bgTex: 'fon_pustoch' },
  pustinya:  { bg: 0x2a2418, below: 0x1a1610, rim: 0x3a3020, bgTex: 'fon_pustinya' },
  zavod:     { bg: 0x12141a, below: 0x0a0c10, rim: 0x1a1c24, bgTex: 'fon_zavod' }
};

import * as Lifecycle from './game/lifecycle.js';
import * as MapBuilder from './game/mapBuilder.js';
import * as ModeObjects from './game/modeObjects.js';
import * as MatchTick from './game/matchTick.js';
import * as Spawns from './game/spawns.js';

export default class GameScene extends Phaser.Scene {
  constructor(key) {
    // Ключ по умолчанию 'GameScene'; BenchmarkScene передаёт свой.
    super(key || 'GameScene');
  }

  init() { return Lifecycle.init.call(this); }
  onShutdown() { return Lifecycle.onShutdown.call(this); }
  create(data) {
    // Кэши статики LOS/солидов живут на сцене, а Phaser переиспользует
    // объект сцены при рестарте. Иначе после «Заново»/следующей миссии
    // с тем же числом тел бот мог видеть геометрию прошлой карты.
    try {
      this._losFlatCache = null;
      this._losSplitCache = null;
      this._losFlatN = -1;
      this._losSplitN = -1;
      this._solidExactList = null;
      this._solidExactN = -1;
      this._aiPhaseN = 0;
      this._aiPhaseRun = 0;
      this._aiPhaseSeq = 0;
      this._aiAcc = 0;
      this._rigFrame = 0;
      this._perfAt = 0;
      this._perfLow = false;
    } catch (e) {}
    const r = Lifecycle.create.call(this, data);
    // k477: браузерный вотчер залипания в укрытии. Без ?penwatch=1 — no-op.
    try { installPenWatch(this); } catch (e) {}
    return r;
  }
  createMap() { return MapBuilder.createMap.call(this); }
  _buildHouseLayers(themeId) { return MapBuilder._buildHouseLayers.call(this, themeId); }
  createPlatform(x, y, width, height, alpha = 1, texKey = null) { return MapBuilder.createPlatform.call(this, x, y, width, height, alpha, texKey); }
  createGround(x, y, width, height, alpha = 1, texKey = null) { return MapBuilder.createGround.call(this, x, y, width, height, alpha, texKey); }
  createCover(x, y, width, height, texOrAlpha = 1, opts = {}) { return MapBuilder.createCover.call(this, x, y, width, height, texOrAlpha, opts); }
  createDecor(x, y, width, height, texKey, alpha = 1, depth = -2) { return MapBuilder.createDecor.call(this, x, y, width, height, texKey, alpha, depth); }
  createWeather(themeId) { return MapBuilder.createWeather.call(this, themeId); }
  createBuilding(x, y, width, height, texKey, alpha = 1) { return MapBuilder.createBuilding.call(this, x, y, width, height, texKey, alpha); }
  createWall(x, y, width, height, alpha = 1, texKey = null) { return MapBuilder.createWall.call(this, x, y, width, height, alpha, texKey); }
  createPlayer() { return Spawns.createPlayer.call(this); }
  _isObjectiveCarrier(p) { return Spawns._isObjectiveCarrier.call(this, p); }
  _bindFighter(p) { return Spawns._bindFighter.call(this, p); }
  createEnemies() { return Spawns.createEnemies.call(this); }
  _pickBotPrimary(classId, veteranAK) { return Spawns._pickBotPrimary.call(this, classId, veteranAK); }
  _botName() { return Spawns._botName.call(this); }
  _paintName(p) { return Spawns._paintName.call(this, p); }
  applyBotDifficulty(bot, force) { return Spawns.applyBotDifficulty.call(this, bot, force); }
  createModeObjects() { return ModeObjects.createModeObjects.call(this); }

  // Фоновый дом без коллизии (арты for maps): стоит низом на yBottom.
  // depth: -5 ближний ряд, -8 дальний (меньше + прозрачнее).
  // Над землёй, под игроками. Нет текстуры — пропуск.
  // Здания (dispH≥150) притапливаем на 8px: у PNG прозрачная кромка снизу,
  // иначе все дома висят в воздухе. Мелкий реквизит не трогаем.

  // Задник для карт режимов из level-objects (maps/*.json): в файлах только
  // геометрия, без фона — тянем те же два ряда домов и заграждения, что и
  // в процедурных аренах. Только картинки (depth -8/-5), коллизии нет.
  _addModeDecor() {
    return Arenas.addModeDecor(this);
  }

  // Арена бомбы (зеркально от центра): земля + верхний ярус по бокам
  // (платформы со ступенями-ящиками, шаг ≤60 — носильщики проходят),
  // центр открыт. Два варианта. Базы и проход к ним чистые.
  _buildBombArena() {
    return Arenas.buildBombArena(this);
  }

  // Симметричная арена точек (зеркально от центра): земля + платформа B
  // (верх на 90 выше земли — допрыгиваемо), низкие укрытия у зон, боковые
  // ступени. Всё парное, условия равные. Без «ям»: укрытия низкие (70)
  // и широко (края ±145 от центра) — бот заходит свободно и даже стоя
  // на укрытии засчитывается (|6-70|=64 < 70). Верх B чистый (негде застрять
  // в прыжке), прикрытие подхода — бочки на земле по бокам.
  // Внешность — бочки/металл (for maps).
  _buildKothArena() {
    return Arenas.buildKothArena(this);
  }

  // Арена перестрелок (командный бой / каждый за себя / захват флага):
  // два яруса (земля + платформы), ступени-ящики к платформам (шаг ≤60 —
  // заходят и носильщики), спавны/флаги (x<350, x>W-350) чистые.
  // Два варианта + богатый задник в два ряда.
  _buildSkirmishArena() {
    return Arenas.buildSkirmishArena(this);
  }

  trialWaveSize(wave) {
    return Trial.trialWaveSize(wave);
  }

  trialWaveHpMult(wave) {
    return Trial.trialWaveHpMult(wave);
  }

  trialWaveDmgMult(wave) {
    return Trial.trialWaveDmgMult(wave);
  }

  trialTypesForWave(wave) {
    return Trial.trialTypesForWave(wave);
  }

  spawnTrialEnemy() {
    return Trial.spawnTrialEnemy(this);
  }

  updateTrial(time) {
    return Trial.updateTrial(this, time);
  }

  startTrialWave(time) {
    return Trial.startTrialWave(this, time);
  }

  trialEndedTime() {
    return Trial.trialEndedTime(this);
  }

  createInput() {
    return Input.createInput(this);
  }

  // Ввод — в ui/input.js (createInput).

  // Физический фланг по ногам (те же пороги, что lane= в EnemyAI):
  // high<560 / mid<760 / low. Работает и для игрока (у него нет ai).
  // С гистерезисом ±30 по last: без него топтание на границе (ноги 759/761)
  // даёт 60+ липовых «заходов» за матч (k195: Вихрь M68/L64). Время при этом
  // и так честное (семпл 0.5с), дребезжал только счётчик заходов.
  _laneOf(p, last) {
    return Dump.laneOf(p, last);
  }

  // Дебаг-журналы (C/V-дампы) — в debug/dump.js.
  _logSteal(f, p, now) {
    return Dump.logSteal(this, f, p, now);
  }

  _closeSteal(f, out, now) {
    return Dump.closeSteal(this, f, out, now);
  }

  // Первый статик на луче (k210): ЧТО мешает — для лога зрения.
  // Плиту стрелка/цели под ногами пропускаем (это льготы supports*),
  // дым не смотрим (он отдельно). Возвращает {x,y} центра или null.
  _losBlocker(x1, y1, x2, y2) {
    return LosMath.losBlocker(this._losFlat(), x1, y1, x2, y2);
  }

  _seeInfo(p) {
    return Dump.seeInfo(this, p);
  }

  _logSaw(ai, kind, cnt, moved, note) {
    return Dump.logSaw(this, ai, kind, cnt, moved, note);
  }

  _logStop(ai, secs, whys) {
    return Dump.logStop(this, ai, secs, whys);
  }

  _logSpawn(p, x, y) {
    return Dump.logSpawn(this, p, x, y);
  }
  _logKill(killer, vic) {
    return Dump.logKill(this, killer, vic);
  }

  _logHit(att, vic) {
    return Dump.logHit(this, att, vic);
  }

  _youPlace(x, y) {
    return Dump.youPlace(this, x, y);
  }

  copyYouTrail() {
    return Dump.copyYouTrail(this);
  }

  copyRecPath() {
    return Dump.copyRecPath(this);
  }

  copyDbg(full) {
    return Dump.copyDbg(this, full);
  }

  // k334: файл вместо буфера (см. Dump.saveMatchLog).
  // k374: суффикс снимка пробрасывается (classic).
  saveMatchLog(text, suf) {
    return Dump.saveMatchLog(this, text, suf);
  }

  clipboardFallback(text, done) {
    return Dump.clipboardFallback(this, text, done);
  }

  getDesiredZoom(range) {
    return CameraRig.getDesiredZoom(range);
  }

  pickSpawns(count) {
    return NavGraph.pickSpawns(this, count);
  }

  updateCameraZoom() {
    return CameraRig.updateCameraZoom(this);
  }

  updateCameraFollow() {
    return CameraRig.updateCameraFollow(this);
  }

  createHud() {
    return Hud.buildHud(this);
  }

  // HUD — в ui/hud.js (buildHud).

  // Боковое табло одной команды на экране победы.
  // mine=true — слева моя команда, иначе справа противник.
  _endGameTeamBoard(mine) {
    return Hud.endGameTeamBoard(this, mine);
  }

  // TAB-табло: один общий блок, слева моя команда, справа противник.
  // У каждого: киллы/смерти[/флаги]/урон отдельными колонками (как в итогах),
  // сверху короткая шапка. Длинные ники обрезаются под колонки.
  _renderTeamsBoard() {
    return Hud.renderTeamsBoard(this);
  }

  updateHudTransform() {
    return Hud.updateHudTransform(this);
  }

  _trackModalElems(elems) {
    return Hud.trackModalElems(this, elems);
  }

  // Модалки (победа/поражение/конец) рисуем при зуме 1: иначе компенсация
  // масштаба (setScale 1/z) раздувает тексты вокруг фиксированных позиций —
  // строки опыта налезают на кнопки. update() после gameOver стоит, зум frozen.
  _resetCamForModal() {
    return Hud.resetCamForModal(this);
  }

  drawAbilityCircle(ready01) {
    return Hud.drawAbilityCircle(this, ready01);
  }

  drawCrosshair() {
    return Hud.drawCrosshair(this);
  }

  drawReloadIcon() {
    return Hud.drawReloadIcon(this);
  }

  // Звук наведения кнопок начала/конца матча — как в меню.
  _hoverSfx() {
    return SoundSys.hoverSfx(this);
  }

  createPauseMenu() {
    return PauseModal.createPauseMenu(this);
  }

  buyTrialAlly() {
    return Trial.buyTrialAlly(this);
  }

  // Демо-бой: игроком управляет ИИ — ручной ввод игнорируется.
  _demoBlock() {
    return !!(this.player && this.player._demoPuppet);
  }

  togglePause() {
    return PauseModal.togglePause(this);
  }

  // Сюжетный экран: пропустить случайно нельзя. Первый клик/клавиша
  // только допечатывают текст мгновенно, а дальше пускает лишь кнопка
  // (в интро — «В БОЙ!», в аутро — свой текст). Первые 800мс ввод вообще
  // игнорируется — чтобы двойной клик по кнопке запуска не улетал в пропуск.
  // Курсор на время заставки — видимый (в бою он скрыт под прицелом).
  showStory(text, onComplete, btnLabel) {
    return Campaign.showStory(this, text, onComplete, btnLabel);
  }

  // Подборы теперь берутся каналом 2.5с в Pickup.update — метод привязки
  // оверлапов удалён (канал сам находит стоящего: игрока и ботов).
  _bindPickupOverlap(bot) {
    return Pickups.bindPickupOverlap(this, bot);
  }

  spawnPickup(type, x, y, weaponName) {
    return Pickups.spawnPickup(this, Pickup, type, x, y, weaponName);
  }

  // Выстрел оружия: звук shot_<Имя> (у Remington отдельный последний патрон).
  // Громкость по дистанции (п.21): не видно — 10%, край видимости — 15%,
  // ближе — громче, 100% в радиусе половины видимости ИЛИ 100% радиуса
  // самого недальнобойного оружия. Нет файла — тишина, игра не падает.
  sfxShot(name, magLeft, sx, sy) {
    return SoundSys.sfxShot(this, name, magLeft, sx, sy, weaponsList);
  }

  // Громкость любого позиционного звука по той же кривой, что выстрелы.
  _sfxVolAt(sx, sy, base) {
    return SoundSys.sfxVolAt(this, sx, sy, base);
  }

  // Позиционный звук по ключу (взрывы, бросок). Нет файла — тишина.
  _sfxAt(key, sx, sy, base) {
    return SoundSys.sfxAt(this, key, sx, sy, base);
  }

  // Громкий звук (выстрел/взрыв): боты с ИИ в радиусе слышат и идут
  // проверять (поле _hear — отдельно от _noise реакции на урон).
  _alertNoise(x, y, radius) {
    return SoundSys.alertNoise(this, x, y, radius);
  }

  spawnBullet(owner, angle, damage, range, startX, startY, visual) {
    return Bullets.spawnBullet(this, owner, angle, damage, range, startX, startY, visual);
  }

  // ВСЕ коллайдеры пули складываем в bullet._cols: движок их сам НЕ чистит,
  // без этого каждый выстрел навсегда оставлял ~3×N записей в мире физики
  // (N = игроков) — список рос тысячами и FPS умирал. Чистятся в destroy().
  // Попадание пули в стену: ракета взрывается, пуля даёт искры + пыль.
  _bulletHitWall(bullet) {
    return Bullets.bulletHitWall(this, bullet);
  }

  // Свип-тест пуль против туннелинга: 1700px/s = ~28px/кадр, тонкие
  // платформы (8–16) и маленькие круги головы сидящего (Ø ~16-18)
  // пролетаются между физшагами. Проверяем отрезок prev→cur каждого
  // кадра вместо точечной коллизии — и по стенам, и по бойцам.
  // Кто ближе по отрезку (стена или боец) — тот и ловит пулю:
  // иначе гонка оверлапа/коллайдера в одном физшаге давала урон
  // сквозь платформу или, наоборот, гасила пулю стеной при честном
  // попадании во врага перед ней («летит мимо у платформ»).
  _sweepBullets() {
    return Bullets.sweepBullets(this);
  }

  // Параметр t пересечения отрезка p1→p2 с прямоугольником (0..1),
  // null — нет пересечения. Нужен для приоритета «боец vs стена».
  _segRectT(x1, y1, x2, y2, L, T, R, B) {
    return LosMath.segRectT(x1, y1, x2, y2, L, T, R, B);
  }

  // Параметр t пересечения отрезка p1→p2 с кругом, null — мимо.
  _segCircleT(x1, y1, x2, y2, cx, cy, r) {
    return LosMath.segCircleT(x1, y1, x2, y2, cx, cy, r);
  }

  // Зона попадания по телу для пуль: ниже верха ног — 'legs' (x0.7),
  // иначе 'body' (x1). Голова — отдельным оверлапом. Ног как тел нет,
  // поэтому срез по живому низу хитбокса и длине ног из рига.
  _hitZone(target, bulletY) {
    return Bullets.hitZone(this, target, bulletY);
  }

  // Взрыв ракеты: радиус = половина гранаты, урон 100% в центре → 30% на краю.
  // Прямое попадание (120) сносит стокового бота.
  explodeRPG(bullet) {
    return Bullets.explodeRPG(this, bullet);
  }

  // Вспышка + дымок из ствола при выстреле.
  spawnMuzzle(x, y, angle) {
    return Fx.spawnMuzzle(this, x, y, angle);
  }

  // Искры/кровь/пыль от попадания: n мелких осколков с затуханием.
  spawnImpact(x, y, color, n) {
    return Fx.spawnImpact(this, x, y, color, n);
  }

  // Кровь попадания по ТЗ (веер по направлению, без каши).
  spawnBlood(x, y, angle, big) {
    return Fx.spawnBlood(this, x, y, angle, big);
  }

  // Выброс смерти + пятно (ТЗ попаданий).
  spawnDeath(x, y) {
    return Fx.spawnDeath(this, x, y);
  }

  // Пыль от попаданий в стены: серые медленно оседающие клубы.
  spawnDust(x, y) {
    return Fx.spawnDust(this, x, y, (typeof Phaser !== 'undefined') ? Phaser : null);
  }

  // Вылет гильзы: латунный бокс со случайным углом/силой —
  // вверх-вбок с падением и затуханием (было строго в одну сторону).
  spawnShell(x, y, dir) {
    return Fx.spawnShell(this, x, y, dir);
  }

  // Трассеры всех пуль одним Graphics за кадр (дешевле спрайтов на пулю).
  // Слой 3.9: под бойцами и стволами (4+), над китами (0–3) — пулю не видно
  // за оружием и телами, вспышка выстрела (19) при этом остаётся поверх.
  drawTracers() {
    return Fx.drawTracers(this);
  }

  throwGrenade(owner, type, angle) {
    return Grenades.throwGrenade(this, owner, type, angle);
  }

  explodeGrenade(grenade, owner) {
    return Grenades.explodeGrenade(this, grenade, owner);
  }

  showLevelUpAura() {
    return Hud.showLevelUpAura(this);
  }

  emitSmoke(grenade) {
    return Grenades.emitSmoke(this, grenade);
  }

  // Киллфид (п.19): «кто кого» в правом верхнем углу, тает за 4 сек.
  // Через hudFixed: иначе зум камеры уносит строки с угла экрана.
  // src — честный источник (граната уже не маскируется под ствол в руках).
  _pushKillFeed(killer, victim, src) {
    return Hud.pushKillFeed(this, killer, victim, src);
  }

  // Перекладка строк киллфида + лимит 6 (старые удаляем сразу).
  // Иконки хедшотов едут вместе со строками и чистятся с ними.

  // Доигрывание времени в статистику класса (showcase/ачивки).
  _flushPlayTime() {
    return Match.flushPlayTime(this);
  }

  // Фраг игрока: общая + по классу + недельная (меню v2).

  handleDeath(victim, killer, src) {
    return Match.handleDeath(this, victim, killer, src);
  }

  checkVictory() {
    return Match.checkVictory(this);
  }

  completeCampaignLevel() {
    return Match.completeCampaignLevel(this);
  }

  endGame(message, playerWon = false) {
    return Match.endGame(this, message, playerWon);
  }

  // Точки KOTH каждый кадр — в modes/koth.js.
  _updateKoth(time) {
    return Koth.updateKoth(this, time);
  }

  _paintKoth(pt) {
    return Koth.paintKoth(this, pt);
  }

  // Всплывающий статус точки (захват/спор/захвачено). Компактный шрифт,
  // чтобы не перекрывать бой.
  _kothFx(x, y, text, color) {
    return Koth.kothFx(this, x, y, text, color);
  }
  // Навграф для ботов («зрение карты»): точки на верхах земли/платформ/
  // ящиков каждые ~60px + связи: соседи по поверхности и прыжки между
  // поверхностями (вверх ≤105px — прыжок 123 с запасом, вниз ≤450 —
  // падение; по горизонтали ≤260 вверх / ≤320 вниз). Строится лениво
  // раз за матч (после создания карты), боты делят один граф.
  // Bake проходимости v2 («клеточная карта»):
  // 1) снимаем все твёрдые боксы в плоский список + сетку твёрдости
  //    (клетка 30px) — дальше все проверки «тут стена?» это O(1) взгляд
  //    в табличку, а не перебор всех платформ каждый раз;
  // 2) узлы — точки стояния на верхах поверхностей каждые 40px;
  // 3) рёбра — только реально проходимые: пешком по своей поверхности,
  //    падение вниз с проверкой вертикали, прыжок вверх с проверкой
  //    дуги (высота одиночного ~128, боты двойным не пользуются).
  // Невозможный скачок (мост 698 -> плато 478 = 220вверх) ребро НЕ
  // получает — A* поведёт в обход через боковые лесенки, а не в стену.
  // Читает живые groups => работает на любой карте, включая редактор.
  _buildNavGraph() {
    return NavGraph.buildNavGraph(this);
  }

  // Навигация — в world/navGraph.js (buildNavGraph).

  // Твёрдость точки вылета: дуло нельзя закинуть за платформу —
  // отрезок плечо→дуло упирается в первую статику на пути и точка
  // возвращается на свою сторону (минус зазор). Пуля всегда стартует
  // с чистого места, сквозняков из-за торчащего ствола нет.
  _clampMuzzle(x1, y1, x2, y2) {
    return NavGraph.clampMuzzle(this, x1, y1, x2, y2);
  }
  // вообще не входило в статику (ни на пиксель) — ни вверх в потолок,
  // ни вниз сквозь пол, ни боком в стену. Вызывается каждый кадр после
  // решений ИИ/ввода, до физшага. После этого пересечений нет:
  // стрелять можно всегда, ноги под землю не уходят, вис на кромке
  // невозможен физически. Дешёвый AABB-рейкаст, без аллокаций в кадре.
  _clampFighterMotion(p, dt) {
    return NavGraph.clampFighterMotion(this, p, dt);
  }

  _inSolid(tx, ty, r = 10) {
    return NavGraph.inSolid(this, tx, ty, r);
  }

  // Точная проверка «точка в солиде» (k213): прямой AABB по телам, БЕЗ сетки
  // bake (ячейки 30px + запас 12px: точка в 30px от плиты уже «внутри»).
  // Только для вопроса «цель зарыта целиком» (оба замера): сеточная версия
  // давала невидимость сидящему ПОД плитой с головой у неё (эксплойт «сижу
  // на ящике под мостом — меня нет»). Физика/спавны — как были, по сетке.
  _inSolidExact(tx, ty, pad) {
    return NavGraph.inSolidExact(this, tx, ty, pad);
  }

  // Выталкиваем точку из солида вверх (до ~216px). Не вышло — отдаём
  // как есть: дальше сработает автовозврат флага по таймеру.
  // БЕЗ запаса сверх выхода: +16 протаскивал сквозь тонкие плиты (8px),
  // и бойцы/пули оказывались внутри геометрии — «стрельба сквозь».
  _escapeSolid(x, y, r) {
    return NavGraph.escapeSolid(this, x, y, r);
  }

  // Точка спавна: ищем землю СВЕРХУ ВНИЗ от неба (первый солид под x) —
  // работает на любой карте, а не только где грунт ровно на mapHeight-50.
  // Старая логика «от низа вверх» спавнила внутри высокого/неровного
  // грунта. Возвращаем центр тела с запасом над поверхностью.
  _findGroundY(x) {
    return NavGraph.findGroundY(this, x);
  }

  // Точка спавна на земле (верх грунта минус полтела), вытолкнутая
  // из геометрии вверх. Матч начинается стоя, а не падением с неба.
  _groundSpawnY(x) {
    return NavGraph.groundSpawnY(this, x);
  }

  // Масштаб хитбокса из рига — как Player._rigHitboxK (тот же глобал).
  _spawnRigK() {
    return NavGraph.spawnRigK(this);
  }

  // Тело 30k×56k с низом на feetY влезает в статику (касание 1px — можно).
  _bodyFree(cx, feetY, k) {
    return NavGraph.bodyFree(this, cx, feetY, k);
  }

  // Верх опоры под точкой: сканируем вниз (ступенька/земля/полка).
  _groundFeetY(cx, fromY) {
    return NavGraph.groundFeetY(this, cx, fromY);
  }

  // Спавн без ловушек: тело влезает, под ногами опора и хотя бы
  // в одну сторону проход 150px (иначе это карман — ищем рядом).
  // Лечит «спавн под платформой флага» на Фортах: щели 40px клинили
  // игрока, а ботов вышвыривал анти-стак. Возвращает {x, y} (центр).
  _validateSpawn(x, y) {
    return NavGraph.validateSpawn(this, x, y);
  }

  // Снимок матча в историю боёв (последние 20): режим, счёт,
  // таблицы обеих команд и моё место в команде.
  // Кампания не пишется (решение автора); испытание — волной без поражения.
  _recordMatch(playerWon) {
    return Match.recordMatch(this, playerWon);
  }

  // Внезапная смерть CTF: оба флага исчезают, в центре — один золотой.
  // Доставка его на свою базу решает матч (см. _updateFlags).
  _startCtfSuddenDeath() {
    return Ctf.startCtfSuddenDeath(this);
  }

  // Короткие объявления сверху — в modes/ctf.js.
  _ctfBanner(text, color, y, fontSize, replace) {
    return Ctf.ctfBanner(this, text, color, y, fontSize, replace);
  }

  // Подтянуть очередь вверх после сгорания верхнего (плавно, 250мс).
  // Двигаем item.sy — позицию из него каждый кадр ставит updateHudTransform.

  // Звук взаимодействия с флагом/бомбой: союзник — свой файл, враг — свой.
  // side: 'ally' | 'foe'. Нет файла — тишина (патч громкости учтёт слайдер).
  _playFlagSfx(side) {
    return Ctf.playFlagSfx(this, side);
  }

  // Подписи событий флага: вместо «ТЫ» — ник (игрок всегда за синих).

  _ctfFlagLostBanner(f, victim) {
    return Ctf.ctfFlagLostBanner(this, f, victim);
  }

  _updateFlags(time) {
    return Ctf.updateFlags(this, time);
  }

  // Награда за выполненную задачу (доставка флага, закладка бомбы):
  // +100 монет и +40 опыта сразу (опыт — как везде, только Бывалый+).
  _rewardObjective() {
    return Ctf.rewardObjective(this);
  }

  // Выплата за мелкие задачные эвенты (вор/возврат/дефуз/точка).
  // Делегат нужен режимам (ctf/bomb/koth), чтобы не тянуть match.js в цикл.
  // key — счётчик эвента за матч (thief/ret/defuse/cap) для калибровки медалей.
  _rewardObjectiveEvent(coins, xp, key) {
    Match.rewardObjectiveEvent(this, coins, xp);
    if (key) Match.bumpObj(this, key);
  }

  // Видимый фидбек доставки флага (счёт в HUD тоже растёт сам).
  // Попап на фиксированном месте экрана (под баннером событий),
  // а не в мире у игрока: иначе позиция и размер плавают от зума камеры.
  // Через addHudElement: голый текст зум уносит с места.

  interact() {
    return BombMode.interact(this);
  }

  // Установка бомбы: носитель СВОЕЙ бомбы удерживает зону чужой базы 5с.
  // За это даётся одно очко (по ТЗ).

  // Обезвреживание: враг стоит рядом с лежащей чужой бомбой 5с —
  // бомба возвращается на базу владельца (без очков). По ТЗ.

  // Бомбы каждый кадр: автоподбор СВОЕЙ по касанию, канал закладки 5с,
  // обезвреживание лежащей врагом 5с, возврат через 15с,
  // маркеры носильщиков, проникновение для ничьей.
  _updateBomb(time) {
    return BombMode.updateBomb(this, time);
  }

  // Овертайм-турель — в modes/bomb.js.
  _spawnOvertimeTurret() {
    return BombMode.spawnOvertimeTurret(this);
  }

  _dropTurret() {
    return BombMode.dropTurret(this);
  }

  // Маркер обезвреживания над лежащей бомбой: обратный отсчёт.

  // Красная метка над носильщиком (по ТЗ).
  // Во время закладки — обратный отсчёт, чтоб было видно процесс.

  // Базы + заливка идущей закладки. Круга нет: полоса зоны ±100
  // (честная ширина) + столбы по краям, прогресс — заливка полосы.
  _drawBombBases() {
    return BombMode.drawBombBases(this);
  }

  // (bases — в modes/bomb.js)

  // Статусы бомб + таймер раунда.

  // (hud — в modes/bomb.js)

  update(time, delta) {
    try { window.__gsUpdate = (window.__gsUpdate || 0) + 1; } catch (e) {}
    return MatchTick.updateTick.call(this, time, delta);
  }
  _matchOver(dur, time) {
    return Match.matchOver(this, dur, time);
  }

  _matchLeft(dur, time) {
    return Match.matchLeft(this, dur, time);
  }

  _updateCtfHud(time) {
    return Ctf.updateCtfHud(this, time);
  }

  // Таймер TDM (счёт — строкой выше, как у остальных).
  _updateTdmHud(time) {
    return Match.updateTdmHud(this, time);
  }

  // Таймер и буквы точек KOTH (цвет = владелец).
  _updateKothHud(time) {
    return Koth.updateKothHud(this, time);
  }

  // BOMB: адаптивное возрождение. База 6с + 1с за каждое очко матча
  // (к концу тянутся дольше), потолок 14с. Отстающим на 2+ — 2с скидки
  // (минимум 4с): разгром не превращается в тир.
  _bombRespawnDelay(team) {
    return BombMode.bombRespawnDelay(this, team);
  }

  respawnDeadEnemies(time) {
    return Match.respawnDeadEnemies(this, time);
  }

  // Дымовое облако в точке (или null): для проверок «в одном дыму».
  _smokeAt(x, y) {
    return LosMath.smokeAt(this.smokeClouds || [], x, y);
  }

  // strict=true — без льготы «стою на платформе» (иначе стрелок на миду
  // Плоские rects для losMath: строим из тел каждый раз (свежая геометрия,
  // без stale-кэша; N~50-100, дешевле рассинхрона).
  _losFlat() {
    return NavGraph.losFlat(this);
  }

  _losFlatSplit() {
    return NavGraph.losFlatSplit(this);
  }

  // видит/бьёт сквозь свой пол цель на low и держит позицию вместо спуска).
  // ИИ зовёт строгим, когда цель на другом ярусе (|dy|>80): честные выстрелы
  // с края (луч мимо платформы) проходят и так, сквозные — режутся.
  hasLineOfSight(x1, y1, x2, y2, strict) {
    return LosMath.hasLineOfSight(this._losFlat(), this.smokeClouds || [], x1, y1, x2, y2, strict);
  }

  // Плита между взрывом и целью: граната лежит НА платформе, а боец
  // ПОД ней (или наоборот) с пересечением по X — урона нет, даже если
  // тонкий луч чиркнул край плиты мимо lineIntersectsRect. Прыжок с ударом
  // головой в платформу урон не даёт: голова упёрлась — значит под плитой.
  _blastBlockedBySlab(cx, cy, tx, ty) {
    const s = this._losFlatSplit();
    return LosMath.blastBlockedBySlab(s.plats, s.covers, cx, cy, tx, ty);
  }

  // Взрывной LOS: только геометрия, строго — без льготы «стою на платформе»
  // (иначе граната на платформе бьёт сквозь неё вниз) и без дыма
  // (дым скрывает, но от осколков не защищает).
  hasBlastLos(x1, y1, x2, y2) {
    return LosMath.hasBlastLos(this._losFlat(), x1, y1, x2, y2);
  }

  // Тот же LOS, но без дыма (только геометрия). Нужен ИИ, чтобы отличить
  // «враг за дымом» (стрелять вслепую/смещаться) от «враг за стеной».
  // strict=true — без льготы «стою на платформе» (для взрывов: граната,
  // лежащая на платформе, обязана считаться за ней, иначе бьёт сквозь неё).
  hasWallLos(x1, y1, x2, y2, strict) {
    return LosMath.hasWallLos(this._losFlat(), x1, y1, x2, y2, strict);
  }

  // Скрыт ли чужой бот от меня дымом: сидит в дыму сам или дым между нами
  // по лучу зрения. Стены тут не при чём (их видит и рендер, и LOS).
  _botHiddenBySmoke(v, b) {
    try {
      if (!v || !b) return false;
      return LosMath.botHiddenBySmoke(this.smokeClouds || [], v.x, v.y - 28, b.x, b.y - 28);
    } catch (e) { return false; }
  }

  // Пересекает ли отрезок круг (луч зрения сквозь дым).
  _segCircle(x1, y1, x2, y2, cx, cy, r) {
    return LosMath.segCircle(x1, y1, x2, y2, cx, cy, r);
  }

  // Плавное скрытие/возврат бота в дыму (220мс): ВСЯ тушка через
  // _smokeParts (тело — отдельные картинки, не базовый спрайт) + полоски
  // и тень. Без этого враг остаётся виден, а от полосок висел красный
  // прямоугольник. Через alpha (не visible): не конфликтует с updateBars/revive.
  _setSmokeGhost(p, hide) {
    return Grenades.setSmokeGhost(this, p, hide);
  }

  lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    return LosMath.lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh);
  }

  lineSegIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    return LosMath.lineSegIntersect(x1, y1, x2, y2, x3, y3, x4, y4);
  }

  setupTutorial() {
    return Campaign.setupTutorial(this);
  }

  updateTutorial(time) {
    return Campaign.updateTutorial(this, time);
  }

  groundHeightAt(x) {
    return NavGraph.groundHeightAt(this, x);
  }
}
