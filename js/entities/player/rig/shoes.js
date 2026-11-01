

import { artScale, partCfg } from './config.js';

function parentRef(player, childKey) {
  if (childKey === 'cap' && player.headImg) {
    return { img: player.headImg, cfg: partCfg(player, 'head') };
  }
  if ((childKey === 'head' || childKey === 'arms' || childKey === 'legs') && player.torso) {
    return { img: player.torso, cfg: partCfg(player, 'torso') };
  }
  return null;
}

// Зеркалим часть через scaleX (=-1): Phaser.flipX отражает текстуру вокруг ЦЕНТРА
// кадра, а не вокруг точки-шарнира, из-за чего рука «вылетала» из плеча влево.
// scaleX же зеркалит ровно вокруг origin — то есть вокруг шарнира, как и считается
// в _pointOn/partLocalOn (там проверка scaleX<0).
export function flipX(player, img, key, cfgName, side) {
  if (!img) return;
  const fs = side < 0 ? -1 : 1;
  const sc = artScale(player, key, cfgName);
  if (sc) img.setScale(sc * fs, sc);
}

export function pointOn(player, img, cfg, u, v) {
  const W = img.displayWidth || 1;
  const H = img.displayHeight || 1;
  const c = Math.cos(img.rotation);
  const s = Math.sin(img.rotation);
  const dx = (img.scaleX < 0 ? -(u - cfg.px) : (u - cfg.px)) * W;
  const dy = (v - cfg.py) * H;
  return { x: img.x + dx * c - dy * s, y: img.y + dx * s + dy * c };
}

export function anchorFor(player, childKey) {
  const par = parentRef(player, childKey);
  if (!par) return { x: player.x, y: player.y };
  const cfg = partCfg(player, childKey);
  return pointOn(player, par.img, par.cfg, cfg.paX, cfg.paY);
}

export function partLocalOn(player, childKey, wx, wy) {
  const par = parentRef(player, childKey);
  if (!par) return { u: 0.5, v: 0.5 };
  const img = par.img;
  const cfg = par.cfg;
  const W = img.displayWidth || 1;
  const H = img.displayHeight || 1;
  const c = Math.cos(img.rotation);
  const s = Math.sin(img.rotation);
  const dx = wx - img.x;
  const dy = wy - img.y;
  const ix = dx * c + dy * s;
  const iy = -dx * s + dy * c;
  const u = cfg.px + (img.scaleX < 0 ? -ix : ix) / W;
  const v = cfg.py + iy / H;
  return { u: Phaser.Math.Clamp(u, 0, 1), v: Phaser.Math.Clamp(v, 0, 1) };
}

export function partObject(player, key) {
  if (key === 'torso') return player.torso;
  if (key === 'head') return player.headImg;
  if (key === 'cap') return player.capImg;
  if (key === 'arms') return player.armGun;
  if (key === 'legs') return player.legsRun;
  return null;
}
