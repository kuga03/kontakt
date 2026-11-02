import BootScene from './scenes/BootScene.js?v=411';
import MenuScene from './scenes/MenuScene2.js?v=378';
import LobbyScene from './scenes/LobbyScene.js?v=205';
import GameScene from './scenes/GameScene.js?v=412';
import ShopScene from './scenes/ShopScene.js?v=180';
import DonateScene from './scenes/DonateScene.js?v=3';
import LootBoxScene from './scenes/LootBoxScene.js?v=175';
import InventoryScene from './scenes/InventoryScene.js?v=191';
import SettingsScene, { getScreenRes, getFpsCap, getVsync } from './scenes/SettingsScene.js?v=181';
import { getQuality, getCamShake } from './data/gameSettings.js';
import LevelEditorScene from './scenes/LevelEditorScene.js?v=411';
import MyLevelsScene from './scenes/MyLevelsScene.js?v=172';
import RigEditorScene from './scenes/RigEditorScene.js?v=380';
import SkillsScene from './scenes/SkillsScene.js?v=171';
import GenomeScene from './scenes/GenomeScene.js?v=171';
import AchievementsScene from './scenes/AchievementsScene.js?v=171';
import FriendsScene from './scenes/FriendsScene.js?v=200';
import GangScene from './scenes/GangScene.js?v=14';
import NetLobbyScene from './scenes/NetLobbyScene.js?v=172';
import NetGameScene from './scenes/NetGameScene.js?v=380';
import BenchmarkScene from './scenes/BenchmarkScene.js';


// Метка сборки: в консоли браузера видно, какие именно версии загружены.
// matchTick/spawns/brain/sensors намеренно без ?v= — сервер отдаёт их no-store,
// поэтому в кэш-цепочке их быть не должно.
try {
  const _build = {
    game: '393', scene: '386', boot: '381', ai: '194', shoot: '176',
    navGraph: '171', matchTick: 'unversioned', at: '2026-10-30'
  };
  if (typeof window !== 'undefined') window.__KONTAKT_BUILD__ = _build;
  if (typeof console !== 'undefined') console.info('[KONTAKT BUILD]', _build);
} catch (e) {}

// k556: пилот планировщика маршрута (низ по земле, прыжки только в точках
// переходов) — в игре включается ?plan=1 (как ?penwatch=1). Бенч/headless
// флаг не ставят, измеряемая база k523 не меняется.


try { localStorage.removeItem('kontakt_perf'); } catch (e) {}
const _rawRes = getScreenRes();
const _rawFps = getFpsCap();
const screenRes = ['1280', '1600', '1920', 'fit'].includes(_rawRes) ? _rawRes : '1280';
const _fpsCap = ['0', '30', '60'].includes(_rawFps) ? _rawFps : '0';
// Адаптивная ширина без растягивания: высота всегда 720, ширина = 720*aspect
// (1280 на 16:9 — попиксельно как раньше, ~1560 на 20:9 — мир виден шире).
// FIT при совпадающем аспекте даёт точное заполнение без полос.
// UI центрируется через layout.js (OX/CX), мир — сам (камера).
// Настройка screenRes размер НЕ меняет (иначе UI уезжает влево-вверх).
import { bootW, BASE_H } from './ui/layout.js?v=3';
const _w = bootW();
const _h = BASE_H;
const scaleConfig = {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: _w,
  height: _h
};

const fpsCap = _fpsCap;
const fpsConfig = {};
// VSync: браузер и так компонует канвас синхронно с развёрткой, но при
// свободном цикле (70+ FPS на 60Гц мониторе) кадры рвутся и дёргаются.
// Тумблер лочит цикл ровно на 60. Выкл — как стоит в лимите выше.
if (getVsync()) {
  fpsConfig.target = 60;
} else if (fpsCap === '30') {
  fpsConfig.target = 30;
} else if (fpsCap === '60') {
  fpsConfig.target = 60;
}

const config = {
  type: Phaser.AUTO,
  width: _w,
  height: _h,
  backgroundColor: '#0a0a2a',
  fps: fpsConfig,
  render: {
    pixelArt: false,
    // Сглаживание зависит от качества: на «низком» выключено (дешевле).
    antialias: getQuality() !== 'low',
    roundPixels: false
  },
  resolution: (function () {
    // Качество графики (настройки): low=1x, medium=1.5x, high=2x.
    // Дефолт — авто: мобильный 1x (слабый GPU), ПК 2x (суперсемплинг).
    var q = getQuality();
    return q === 'low' ? 1 : (q === 'medium' ? 1.5 : 2);
  })(),
  scale: scaleConfig,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: {
        y: 900
      },
      debug: false
    }
  },
  audio: {
    disableWebAudio: false
  },
  dom: {
    createContainer: true
  },
  scene: [
    BootScene,
    MenuScene,
    LobbyScene,
    GameScene,
    ShopScene,
    DonateScene,
    LootBoxScene,
    InventoryScene,
    SettingsScene,
    LevelEditorScene,
    MyLevelsScene,
    RigEditorScene,
    SkillsScene,
    GenomeScene,
    AchievementsScene,
    FriendsScene,
    GangScene,
    NetLobbyScene,
    NetGameScene,
    BenchmarkScene
  ]
};

const FONT = 'ScienceGothic, monospace, sans-serif';
// HiDPI-текст: текстура букв рисуется в 2x и показывается в масштабе 0.5 —
// буквы чёткие при resolution 2. Логические размеры (displayWidth/Height)
// не меняются, замерять текст кодом нужно через displayWidth/displayHeight.
const TEXT_HIDPI = 2;
function hidpiSize(fs) {
  if (typeof fs === 'number' && isFinite(fs)) return fs * TEXT_HIDPI;
  if (typeof fs === 'string') {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(fs.trim());
    if (m) return (parseFloat(m[1]) * TEXT_HIDPI) + 'px';
  }
  return fs;
}
function hidpiPadding(p) {
  if (typeof p === 'number' && isFinite(p)) return p * TEXT_HIDPI;
  if (p && typeof p === 'object') {
    const out = Array.isArray(p) ? [...p] : { ...p };
    ['x', 'y', 'left', 'right', 'top', 'bottom'].forEach(k => {
      if (typeof out[k] === 'number' && isFinite(out[k])) out[k] *= TEXT_HIDPI;
    });
    return out;
  }
  return p;
}
const origFactoryText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (x, y, text, style) {
  // ВАЖНО: стиль клонируем, а не правим на месте. Раньше общий объект стиля
  // (например BTN в редакторе персонажа) удваивался при КАЖДОМ создании
  // текста: 14→28→56→…→астрономия, и канвы таких текстов молча не влезали
  // в GPU — кнопки становились невидимками.
  if (!style || typeof style !== 'object') {
    style = { fontFamily: FONT };
  } else {
    style = { ...style };
    if (style.wordWrap && typeof style.wordWrap === 'object') style.wordWrap = { ...style.wordWrap };
    if (!style.fontFamily) style.fontFamily = FONT;
  }
  if (style.fontSize !== undefined) style.fontSize = hidpiSize(style.fontSize);
  if (style.strokeThickness) style.strokeThickness *= TEXT_HIDPI;
  // fixedWidth/Height, padding и wordWrap задаются в пикселях текстуры —
  // при 2x-шрифте их тоже удваиваем, иначе текст обрежется/переносы поплывут.
  if (style.fixedWidth) style.fixedWidth *= TEXT_HIDPI;
  if (style.fixedHeight) style.fixedHeight *= TEXT_HIDPI;
  if (style.padding !== undefined) style.padding = hidpiPadding(style.padding);
  if (style.wordWrap && typeof style.wordWrap.width === 'number') style.wordWrap.width *= TEXT_HIDPI;
  if (typeof style.lineSpacing === 'number') style.lineSpacing *= TEXT_HIDPI;
  const t = origFactoryText.call(this, x, y, text, style);
  t.scaleX = 0.5;
  t.scaleY = 0.5;
  t.setData('__hidpi', true);
  return t;
};
// setFontSize и setWordWrapWidth принимают ЛОГИЧЕСКИЕ размеры (как раньше) — удвоение внутри.
const origTextSetFontSize = Phaser.GameObjects.Text.prototype.setFontSize;
Phaser.GameObjects.Text.prototype.setFontSize = function (fs) {
  return origTextSetFontSize.call(this, hidpiSize(fs));
};
// setColor с тем же цветом — пропуск: иначе HUD, дёргающий setColor каждый
// кадр, перепекет канву и перезаливает текстуру в GPU 60 раз в секунду.
const origTextSetColor = Phaser.GameObjects.Text.prototype.setColor;
Phaser.GameObjects.Text.prototype.setColor = function (color) {
  try {
    if (this.style && this.style.color === color) return this;
  } catch (e) {}
  return origTextSetColor.call(this, color);
};
// setStyle тоже обязан удваивать fontSize: иначе любое наведение
// (setStyle при hover) перепекает текстуру в 1x при масштабе 0.5 —
// кнопка «сдувается» вдвое. Клонируем, общий объект не портим.
const origTextSetStyle = Phaser.GameObjects.Text.prototype.setStyle;
Phaser.GameObjects.Text.prototype.setStyle = function (style, updateText) {
  if (style && typeof style === 'object' && style.fontSize !== undefined) {
    style = { ...style, fontSize: hidpiSize(style.fontSize) };
  }
  return origTextSetStyle.call(this, style, updateText);
};
const origTextSetWrapW = Phaser.GameObjects.Text.prototype.setWordWrapWidth;
Phaser.GameObjects.Text.prototype.setWordWrapWidth = function (w) {
  return origTextSetWrapW.call(this, typeof w === 'number' ? w * TEXT_HIDPI : w);
};

// Тряска камеры — глобальный тумблер из настроек. Патчим прототип камеры,
// чтобы ВСЕ вызовы cameras.main.shake(...) уважали настройку (не трогая
// полдюжины мест в бою). Без настройки — поведение как было.
(function () {
  try {
    var Cam = Phaser.Cameras.Scene2D.Camera;
    if (!Cam || typeof Cam.prototype.shake !== 'function') return;
    var origShake = Cam.prototype.shake;
    Cam.prototype.shake = function (duration, intensity) {
      try { if (!getCamShake()) return this; } catch (e) { return origShake.apply(this, arguments); }
      return origShake.apply(this, arguments);
    };
  } catch (e) { /* без патча игра работает */ }
})();

window.__game = new Phaser.Game(config);

// Смена аспекта на лету (поворот, ресайз окна, складной экран):
// пересчитываем ширину под новый аспект, высота всегда 720.
// HUD переезжает сам (per-frame updateHudTransform), тач — по событию
// scale 'resize' (см. touch.js), мир — сам (камера).
(function () {
  let _rt = null;
  function refit() {
    try {
      const g = window.__game;
      if (!g || !g.scale) return;
      const nw = bootW();
      if (Math.abs(nw - g.scale.width) >= 2) g.scale.setGameSize(nw, BASE_H);
    } catch (e) {}
  }
  function schedule() {
    try { clearTimeout(_rt); } catch (e) {}
    _rt = setTimeout(refit, 150);
  }
  try {
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
  } catch (e) {}
})();

// Экран погас / вкладка скрыта (блокировка телефона, сворачивание):
// rAF встаёт сам, а WebAudio продолжает играть — глушим все звуки.
// Разблокировка — продолжаем с того же места.
(function () {
  function setHidden(hidden) {
    try {
      const g = window.__game;
      if (!g || !g.sound) return;
      if (hidden) { try { g.sound.pauseAll(); } catch (e) {} }
      else { try { g.sound.resumeAll(); } catch (e) {} }
    } catch (e) {}
  }
  try {
    document.addEventListener('visibilitychange', () => {
      setHidden(document.hidden || document.visibilityState === 'hidden');
    });
  } catch (e) {}
  try {
    window.addEventListener('pagehide', () => setHidden(true));
    window.addEventListener('pageshow', () => setHidden(false));
  } catch (e) {}
})();
