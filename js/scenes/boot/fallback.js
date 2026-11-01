import { GENERATED } from './config.js';
export function generateFallback(key) {
    const def = GENERATED[key];
    if (!def) return;

    // лист ходьбы не заменяем фолбэком: ноги упадут на лист бега
    if (def.kind === 'chrWalkFrames') return;

    if (def.kind === 'chrRunSheet' || def.kind === 'chrRunFrames') {
      this.generateRunSheet(key, def);
      return;
    }

    if (def.kind === 'chr') {
      this.generateChrPart(key, def.part, def.w, def.h);
      return;
    }

    const g = this.make.graphics({ x: 0, y: 0, add: false });

    if (key === 'chr_arm_up') {
      g.fillStyle(0x556b5e, 1);
      g.fillRoundedRect(0, 1, def.w, def.h - 2, 4);
      g.generateTexture(key, def.w, def.h);
    } else if (key === 'chr_arm_fore' || key === 'chr_arm_fore_l' || key === 'chr_arm_fore_r') {
      g.fillStyle(0x556b5e, 1);
      g.fillRoundedRect(0, 1, def.w, def.h - 2, 3);
      g.generateTexture(key, def.w, def.h);
    } else if (key === 'chr_hand' || key === 'chr_hand_l' || key === 'chr_hand_r') {
      g.fillStyle(0xe8c9a0, 1);
      g.fillCircle(def.w * 0.5, def.h * 0.5, Math.min(def.w, def.h) * 0.4);
      g.generateTexture(key, def.w, def.h);
    } else if (def.kind === 'coins') {
      // Стопка баксов: 3 купюры лесенкой + золотая бандероль.
      g.fillStyle(0x1d7a34, 1);
      g.fillRoundedRect(0, 8, def.w, 12, 2);
      g.fillStyle(0x249a41, 1);
      g.fillRoundedRect(0, 4, def.w, 12, 2);
      g.fillStyle(0x2fbf52, 1);
      g.fillRoundedRect(0, 0, def.w, 12, 2);
      g.fillStyle(0xd8b400, 1);
      g.fillRect(Math.floor(def.w / 2) - 2, 0, 4, 12);
      g.generateTexture(key, def.w, def.h);
    } else if (def.kind === 'circle') {
      g.fillStyle(def.color, 1);
      g.fillCircle(def.r, def.r, def.r);
      g.generateTexture(key, def.r * 2, def.r * 2);
    } else if (key === 'platform') {
      // Металлическая платформа (тайлится, высота 16 — под типовые h16/h8:
      // у тонких виден верх с кантом). Светлый верхний кант выделяет
      // поверхность на тёмном фоне + панели, заклёпки, тень снизу.
      const W = def.w, H = 16;
      g.fillStyle(0x2b3052, 1);
      g.fillRect(0, 0, W, H);
      // верхний кант-поверхность
      g.fillStyle(0x8b9bd6, 1);
      g.fillRect(0, 0, W, 3);
      g.fillStyle(0x565f9e, 1);
      g.fillRect(0, 3, W, 1);
      // тело
      g.fillStyle(0x343b63, 1);
      g.fillRect(0, 4, W, 6);
      // стыки панелей каждые 60px
      g.fillStyle(0x1a1e38, 1);
      for (let px = 0; px <= W; px += 60) g.fillRect(px, 4, 1, 7);
      // заклёпки между стыками
      for (let px = 30; px < W; px += 60) {
        g.fillStyle(0x14162b, 1);
        g.fillCircle(px, 8, 2.5);
        g.fillStyle(0x9aa7c7, 1);
        g.fillCircle(px, 8, 1.5);
      }
      // нижняя тень и кромка
      g.fillStyle(0x14162b, 1);
      g.fillRect(0, 11, W, 4);
      g.fillStyle(0x05060f, 1);
      g.fillRect(0, 15, W, 1);
      g.generateTexture(key, W, H);
    } else {
      g.fillStyle(def.color, 1);
      g.fillRect(0, 0, def.w, def.h);
      g.generateTexture(key, def.w, def.h);
    }
    g.destroy();
  }
