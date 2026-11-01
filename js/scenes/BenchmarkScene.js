import GameScene from './GameScene.js?v=386';
import * as Lifecycle from './game/lifecycle.js';
import * as MatchTick from './game/matchTick.js?v=3';
import { gameW } from '../ui/layout.js?v=3';
import { getQuality, QUALITY_OPTIONS } from '../data/gameSettings.js';

// BenchmarkScene — реалистичный замер FPS: настоящий бой 8 на 8
// (CTF, карта Форты), игрока нет, камера отдалена на всю карту.
// Запускается кнопкой «ТЕСТ FPS» в настройках. 8 секунд боя → средний/мин/макс.
// Наследует GameScene — берёт все боевые методы (createMap/createPlayer/...).
const RUN_MS = 8000;

export default class BenchmarkScene extends GameScene {
  constructor() {
    super('BenchmarkScene');
  }

  // Камера бенчмарка — статичная (вся карта). HUD каждый кадр зовёт зум
  // под ствол игрока — глушим, иначе камера «приближается» к центру.
  updateCameraZoom() { return; }
  updateCameraFollow() { return; }

  // Скрыть HUD: все элементы из hudFixed + прицел/иконка перезарядки.
  _hideHud() {
    try {
      (this.hudFixed || []).forEach(e => {
        if (e && e.obj && typeof e.obj.setVisible === 'function') e.obj.setVisible(false);
      });
    } catch (e) { /* noop */ }
    try { if (this.crosshair && typeof this.crosshair.setVisible === 'function') this.crosshair.setVisible(false); } catch (e) {}
    try { if (this.reloadIcon && typeof this.reloadIcon.setVisible === 'function') this.reloadIcon.setVisible(false); } catch (e) {}
  }

  // Баннеры событий («Флаг захвачен» и т.п.) — тоже HUD, глушим.
  _ctfBanner() { return; }

  create(data) {
    // Форсируем карту «Форты» (CTF) на время создания сцены, потом возвращаем сейв.
    let _prevRaw = null, _hadRaw = false;
    try { _prevRaw = localStorage.getItem('sideShooterState'); _hadRaw = _prevRaw != null; } catch (e) {}
    try {
      const st = _prevRaw ? JSON.parse(_prevRaw) : {};
      st.freeMapId = 'ctf';
      localStorage.setItem('sideShooterState', JSON.stringify(st));
    } catch (e) { /* noop */ }
    try {
      // Реальный матч 8v8 ботов (CTF, Форты). Игрок-призрак закрывает слот синих.
      Lifecycle.create.call(this, {
        mode: 'CTF',
        benchmark: true,
        suddenStart: false,
        scoreLimit: 10,
        selectedClass: 'Assault',
        playerName: 'Зритель'
      });
    } finally {
      try {
        if (_hadRaw) localStorage.setItem('sideShooterState', _prevRaw);
        else localStorage.removeItem('sideShooterState');
      } catch (e) { /* noop */ }
    }

    // Прячем весь HUD (бенчмарк — только бой). updateHud при _benchmark
    // больше не трогает эти элементы, так что скрытость держится.
    this._hideHud();

    this._t0 = performance.now();
    this._frames = 0;
    this._ft = [];
    this._done = false;

    // Текст бенчмарка держим постоянного размера на экране: компенсируем
    // зум камеры (на всей карте камера далеко — текст иначе мельчает).
    const zs = 1 / (this.cameras.main.zoom || 1);
    this._fpsTxt = this.add.text(16, 12, '', {
      fontSize: '18px', color: '#9fff9f', backgroundColor: '#00000088', padding: 6
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(5000).setScale(zs);
    const qLabel = (QUALITY_OPTIONS.find(q => q.id === getQuality()) || {}).label || getQuality();
    this._infoTxt = this.add.text(gameW(this) / 2, 12, `ТЕСТ FPS · 8v8 CTF · Форты · качество: ${qLabel}`, {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#00000088', padding: 6
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(5000).setScale(zs);
    this._hint = this.add.text(gameW(this) / 2, 700, 'Идёт замер…', {
      fontSize: '16px', color: '#99aacc'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5000).setScale(zs);

    this._back = this.add.text(gameW(this) - 30, 700, 'ВЫЙТИ', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5000).setScale(zs).setInteractive({ useHandCursor: true });
    this._back.on('pointerdown', () => this.scene.start('SettingsScene'));
    this._back.on('pointerover', () => this._back.setStyle({ color: '#ffff55' }));
    this._back.on('pointerout', () => this._back.setStyle({ color: '#ffffff' }));

    // ESC — прямой выход из бенчмарка (игровой хендлер тут не нужен).
    this._escHandler = () => this.scene.start('SettingsScene');
    this.input.keyboard.on('keydown-ESC', this._escHandler);
  }

  onShutdown() {
    try { if (this._escHandler) this.input.keyboard.off('keydown-ESC', this._escHandler); } catch (e) {}
    GameScene.prototype.onShutdown.call(this);
  }

  // В бенчмарке пауза не нужна: ESC должен просто выйти, а не вставать на паузу.
  togglePause() { return; }

  update(time, delta) {
    // Полный боевой цикл (карта, боты, взрывы, дым, HUD) — как в реальном матче.
    MatchTick.updateTick.call(this, time, delta);
    // Прячем HUD и свежесозданные элементы (киллфид, баннеры, попапы).
    this._hideHud();
    if (this._done) return;

    // FPS считаем по РЕАЛЬНОМУ времени (performance.now), а не по Phaser delta:
    // delta сглажена и под капом 60 может показывать 16.67 при фактических 46.
    const now = performance.now();
    this._frames++;
    this._ft.push(now);
    if (this._ft.length > 30) this._ft.shift();
    const elapsed = now - this._t0;
    const live = this._ft.length > 1
      ? (this._ft.length - 1) / ((this._ft[this._ft.length - 1] - this._ft[0]) / 1000)
      : 0;
    this._fpsTxt.setText(`FPS: ${Math.round(live)}`);
    const left = Math.max(0, Math.ceil((RUN_MS - elapsed) / 1000));
    this._hint.setText(`Идёт замер… ${left} с`);

    if (elapsed >= RUN_MS) {
      this._done = true;
      const avg = this._frames / (elapsed / 1000);
      this._fpsTxt.setText(`Средний FPS: ${avg.toFixed(1)}`);
      this._hint.setText(`Средний: ${avg.toFixed(1)}`);
      const W = gameW(this);
      const again = this.add.text(W / 2, 60, 'ЗАНОВО', {
        fontSize: '15px', color: '#ffffff', backgroundColor: '#287a45', padding: 8
      }).setOrigin(0.5).setScrollFactor(0).setDepth(5000).setInteractive({ useHandCursor: true });
      again.on('pointerdown', () => this.scene.restart());
      again.on('pointerover', () => again.setStyle({ color: '#ffff55' }));
      again.on('pointerout', () => again.setStyle({ color: '#ffffff' }));
    }
  }
}
