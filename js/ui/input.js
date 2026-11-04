// input.js — привязка ввода боя (было в GameScene.createInput).
// Ставит те же поля сцены (_pointerDownHandler, _rHandler, ...),
// снятие — в onShutdown сцены как раньше.
// + мобильное управление (touch.js): два джойстика только на телефоне.
// + переназначение клавиш (data/gameSettings.js) и вибрация.
import { createTouchControls, destroyTouchControls, touchOwns } from './touch.js';
import { getKeyCode, vibrate } from '../data/gameSettings.js';

export function createInput(scene) {
  // Мобильное управление ПЕРВЫМ: его pointerdown должен пометить палец
  // (ownIds) раньше, чем хендлер выстрела ниже — иначе касание стика
  // даст лишний выстрел. На ПК createTouchControls = null и ни на что не влияет.
  try { createTouchControls(scene); } catch (e) { try { scene._touch = null; } catch (e2) {} }
  const KC = Phaser.Input.Keyboard.KeyCodes;
  const codeOf = (a) => getKeyCode(a);
  scene.keys = scene.input.keyboard.addKeys({
    left: codeOf('left'),
    right: codeOf('right'),
    jump: codeOf('jump'),
    jumpW: KC.W,
    crouch: codeOf('crouch'),
    ability: codeOf('ability'),
    reload: codeOf('reload'),
    tab: KC.TAB,
    one: KC.ONE,
    two: KC.TWO,
    three: KC.THREE,
    // F — сбросить бомбу (носильщик).
    dropB: codeOf('dropBomb')
  });
  // TAB не отдаём браузеру (иначе фокус уходит и табло не открывается).
  try { scene.input.keyboard.addCapture(9); } catch (e) {}

  scene._pointerDownHandler = pointer => {
    if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
    // Бенчмарк: игрок-призрак не стреляет (клики — не его ввод).
    if (scene.player && scene.player._benchmarkGhost) return;
    // Палец на джойстике/кнопке — не выстрел (мобильное управление).
    try { if (touchOwns(scene, pointer)) return; } catch (e) {}
    // Клик для старта раунда/закрытия стори не должен стрелять (п.16):
    // физика на паузе (стори-интро) — только метим прицел.
    if (scene.physics.world.isPaused) {
      scene._aimInit = true;
      return;
    }
    if (scene.mode === 'CAMPAIGN' && !scene._introDone && scene.campaignLevel?.storyIntro) {
      scene._aimInit = true;
      return;
    }
    scene._aimInit = true;
    scene.player.shoot(scene.time.now, pointer.worldX, pointer.worldY);
    scene._shootingPointer = pointer;
    vibrate(12);
  };
  scene.input.on('pointerdown', scene._pointerDownHandler);

  scene._pointerUpHandler = () => {
    scene._shootingPointer = null;
  };
  scene.input.on('pointerup', scene._pointerUpHandler);

  scene._moveHandler = pointer => {
    if (scene._demoBlock()) return;
    try { if (touchOwns(scene, pointer)) return; } catch (e) {}
    scene._aimInit = true;
    scene.player.aimAt(pointer.worldX, pointer.worldY);
  };
  scene.input.on('pointermove', scene._moveHandler);

  scene._rHandler = () => {
    if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
    if (scene.player.weapon) scene.player.weapon.reload();
    vibrate(8);
  };

  scene._xHandler = () => {
    if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
    scene.player.useUltimate(scene.time.now);
    vibrate(30);
  };

  scene._gHandler = () => {
    if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
    const p = scene.input.activePointer;
    scene.player.throwGrenade('frag', p.worldX, p.worldY);
    vibrate(25);
  };

  scene._hHandler = () => {
    if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
    const p = scene.input.activePointer;
    scene.player.throwGrenade('smoke', p.worldX, p.worldY);
    vibrate(20);
  };

  scene._eHandler = () => {
    if (scene.isPaused || scene.gameOver || scene._demoBlock()) return;
    scene.player.useAbility(scene.time.now);
    scene.interact();
    vibrate(20);
  };

  // Переназначаемые клавиши — одним обработчиком: сравниваем event.keyCode
  // с настроенными кодами (R/X/G/H/E). Так работает любая раскладка/клавиша.
  const K = {
    reload: codeOf('reload'),
    ultimate: codeOf('ultimate'),
    grenade: codeOf('grenade'),
    smoke: codeOf('smoke'),
    ability: codeOf('ability')
  };
  scene._keyHandler = (event) => {
    const k = event && event.keyCode;
    if (k === K.reload) { scene._rHandler(); return; }
    if (k === K.ultimate) { scene._xHandler(); return; }
    if (k === K.grenade) { scene._gHandler(); return; }
    if (k === K.smoke) { scene._hHandler(); return; }
    if (k === K.ability) { scene._eHandler(); return; }
  };
  scene.input.keyboard.on('keydown', scene._keyHandler);

  scene._escHandler = () => {
    if (scene.gameOver) {
      scene.scene.start('MenuScene');
      return;
    }
    // ESC стори-экран не трогает: пауза морозит scene.time и печатная
    // машинка встанет навсегда (плюс меню ляжет поверх истории).
    if (scene._storyOpen) return;
    scene.togglePause();
  };
  scene.input.keyboard.on('keydown-ESC', scene._escHandler);

  scene._wheelHandler = (pointer, over, deltaX, deltaY) => {
    if (scene.isPaused || scene.gameOver || !scene.player || scene._demoBlock()) return;
    const inv = scene.player.inventory;
    if (inv.length <= 1) return;
    const dir = deltaY > 0 ? 1 : -1;
    let next = scene.player.activeWeaponIndex + dir;
    if (next < 0) next = inv.length - 1;
    if (next >= inv.length) next = 0;
    scene.player.selectWeapon(next);
    // Дозарядка при смене — только пустого магазина (запас есть):
    // частичный магазин молча остаётся как был, без лишней перезарядки.
    const sw = scene.player.weapon;
    if (sw && !sw.isMelee && (sw.magazine | 0) <= 0 && (sw.reserveAmmo | 0) > 0 && !sw.reloading) sw.reload();
  };
  scene.input.on('wheel', scene._wheelHandler);

  scene.dbgBg = scene.add.rectangle(8, 8, 230, 96, 0x000000, 0.6)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(1500).setVisible(false);
  scene.dbgTxt = scene.add.text(16, 16, '', {
    fontFamily: 'monospace', fontSize: '12px',
    color: '#ffd75f'
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(1501).setVisible(false);

  scene.dbgCopy = scene.add.text(228, 8, '[C]', {
    fontFamily: 'monospace', fontSize: '13px', color: '#9fd8ff', backgroundColor: '#1c2540'
  }).setPadding(2).setOrigin(0, 0).setScrollFactor(0).setDepth(1502).setVisible(false)
    .setInteractive({ useHandCursor: true });
  // Дебаг-панель ботов скрыта по умолчанию (C — показать/скопировать).
  // Счётчики при этом копятся всегда (_dbgAlways, k243): WARN/строки
  // доступны и без единого C — ловить момент не надо.
  scene._dbgEnabled = false;
  scene._dbgAlways = true;
  // C — запись МОЕГО маршрута (фланги/подъёмы): первое C — старт, второе — стоп
  // и копия в буфер как [[x,y],[x,y]...]. Дебаг-панель переехала на B.
  scene._recording = false;
  scene._recPath = [];
  scene._cHandler = () => {
    if (scene.isPaused) return;
    if (!scene._recording) {
      scene._recording = true;
      scene._recPath = [];
      try { if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) scene._dbgCopyFlash.destroy(); } catch (e) {}
      scene._dbgCopyFlash = scene.add.text(
        16, 120, 'REC \u25cf', { fontFamily: 'monospace', fontSize: '13px', color: '#ff6b6b', backgroundColor: '#1c2540' }
      ).setPadding(2).setOrigin(0, 0).setScrollFactor(0).setDepth(1502);
    } else {
      scene._recording = false;
      try { if (scene._dbgCopyFlash && scene._dbgCopyFlash.parent) scene._dbgCopyFlash.destroy(); } catch (e) {}
      scene.copyRecPath();
    }
  };
  scene.input.keyboard.on('keydown-C', scene._cHandler);
  // B — дебаг-панель ботов (раньше было C).
  scene._bHandler = () => {
    if (scene.isPaused) return;
    scene._dbgEnabled = !scene._dbgEnabled;
    if (!scene._dbgEnabled) {
      scene.dbgTxt.setVisible(false);
      scene.dbgBg.setVisible(false);
      scene.dbgCopy.setVisible(false);
    } else {

    }
  };
  scene.input.keyboard.on('keydown-B', scene._bHandler);
  // Мой след (V — только я, без кучи ботов): встал на точку прыжка —
  // нажал V, в буфере компактный трек. Для золотных ворот погони.
  scene._vHandler = () => {
    if (scene.isPaused) return;
    scene.copyYouTrail();
  };
  scene.input.keyboard.on('keydown-V', scene._vHandler);
}

export function destroyInput(scene) {
  try { destroyTouchControls(scene); } catch (e) {}
}
