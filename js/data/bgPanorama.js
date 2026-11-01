// bgPanorama.js - facade after restructuring (was ~2296 lines monolith).
// Paintings moved to js/data/pano/*.js; PAINTERS registry + bakePanorama stay here.
// Old imports of { bakePanorama, bakeCrispBands } keep working.
import { hashStr, mulberry32, PANO_W, PANO_H } from './pano/util.js';
import { paintUlica, paintKrisha, paintZavod } from './pano/city.js';
import { paintPustoch, paintPustinya, paintPechera, paintPeshara, paintWasteland, paintNight, paintSunset } from './pano/nature.js';
import { bakeCrispBands } from './pano/bands.js';
export { bakeCrispBands };
export { BAND_PALS } from './pano/bands.js';
// ============================================================ точка входа
const PAINTERS = {
  ulica: paintUlica, krisha: paintKrisha, zavod: paintZavod,
  pustoch: paintPustoch, pustinya: paintPustinya,
  pechera: paintPechera, peshera: paintPeshara, wasteland: paintWasteland,
  night: paintNight, sunset: paintSunset
};

export function bakePanorama(scene, themeId) {
  try {
    const id = themeId || 'night';
    const paint = PAINTERS[id];
    if (!paint) return null;
    const key = 'pano_' + id;
    if (!scene || !scene.textures) return null;
    if (scene.textures.exists(key)) return key;
    // Пустошь — двойная ширина (5120) двумя уникальными половинами:
    // показ во всю карту одним куском. Было: ужатка /2 + 2 зеркала —
    // один и тот же город трижды (копипаста). Память ~33МБ статикой.
    const devW = (id === 'wasteland') ? PANO_W * 2 : PANO_W;
    const ct = scene.textures.createCanvas(key, devW, PANO_H);
    if (!ct || !ct.context) {
      try { scene.textures.remove(key); } catch (e) {}
      return null;
    }
    const rng = mulberry32(hashStr('pano:' + id));
    const ctx = ct.context;
    try { ctx.clearRect(0, 0, devW, PANO_H); } catch (e) {}
    // Рисуем в базовых 1600x1000 с масштабом под реальный размер.
    try {
      if (id === 'wasteland') {
        ctx.save();
        ctx.scale(PANO_W / 1600, PANO_H / 1000);
        paint(ctx, mulberry32(hashStr('pano:wasteland')), 1600, 1000);
        ctx.restore();
        ctx.save();
        ctx.translate(PANO_W, 0);
        ctx.scale(PANO_W / 1600, PANO_H / 1000);
        paint(ctx, mulberry32(hashStr('pano:wasteland:B')), 1600, 1000);
        ctx.restore();
      } else {
        ctx.save();
        ctx.scale(PANO_W / 1600, PANO_H / 1000);
        paint(ctx, rng, 1600, 1000);
        ctx.restore();
      }
    } catch (e) {
      try { ctx.restore(); } catch (e2) {}
      try { scene.textures.remove(key); } catch (e3) {}
      return null;
    }
    try { ct.refresh(); } catch (e) {}
    if (!scene.textures.exists(key)) return null;
    return key;
  } catch (e) {
    return null;
  }
}

