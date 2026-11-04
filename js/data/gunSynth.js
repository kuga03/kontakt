// gunSynth.js — синтез выстрелов через Web Audio для стволов без своих записей.
// М1913, Neuhausen KE-7, М60 и Vickers K стреляли чужими сэмплами
// (М249/M1918/миниган) — теперь у каждого свой тембр: три слоя —
// щелчок-атака, трескучее тело (шум через спадающий lowpass) и
// басовый хвост (синус вниз). Короткий щелчок без тела звучал
// именно щелчком, а не выстрелом — так было, больше нет.
// Чистый Web Audio, без зависимостей; шум печётся один раз и кэшируется.
// Нет контекста (выключен WebAudio) — вызыватель откатывается на чужой сэмпл.
// ВАЖНО: прямой WebAudio идёт МИМО патча sound.play (audio.js),
// поэтому регулятор Звуки (sfxVol) и SFX_GAIN применяем здесь вручную —
// иначе при 0% синтез продолжает орать (баг 0%).
import { sfxVol, sfxGain } from './audio.js';
// lp0 — старт lowpass тела (Гц), tail — длина тела/хвоста (с),
// punch — старт басового осциллятора (Гц), thump — его форма
// (sine — кругло, triangle — злее, с гармониками),
// mech — лязг затвора {f, q, g} (у каждого свой — тембры не сливаются
// в кашу, когда лупят несколько пулемётов сразу),
// gain — общий триммер голоса.
const VOICES = {
  // М1913 — середняк: мясное тело + средний лязг.
  'М1913':          { lp0: 4200, tail: 0.28, punch: 105, thump: 'sine',     mech: { f: 2400, q: 1.4, g: 0.45 }, gain: 1.0 },
  'Neuhausen KE-7': { lp0: 5600, tail: 0.22, punch: 130, thump: 'sine',     mech: { f: 3300, q: 2.0, g: 0.4 },  gain: 0.95 },
  'М60':            { lp0: 3200, tail: 0.36, punch: 80,  thump: 'triangle', mech: { f: 1400, q: 1.0, g: 0.55 }, gain: 1.1 },
  'Vickers K':      { lp0: 6500, tail: 0.18, punch: 150, thump: 'sine',     mech: { f: 3900, q: 2.4, g: 0.35 }, gain: 0.9 }
};

const SWISH = {
  'Knife': { dur: 0.15, from: 900, to: 3200, gain: 0.7 },
  'топор': { dur: 0.22, from: 500, to: 2200, gain: 0.85 }
};

const _bufCache = {};
const _swishCache = {};

export function synthVoiceFor(name) {
  try { return VOICES[name] || null; } catch (e) { return null; }
}

function _noiseBuffer(ctx, seconds) {
  const rate = ctx.sampleRate || 44100;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(1, len, rate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function playSynthShot(scene, name, volume) {
  try {
    const v = VOICES[name];
    if (!v) return false;
    const mgr = scene && scene.sound;
    const ctx = mgr && mgr.context;
    if (!ctx || typeof ctx.createBufferSource !== 'function') return false;
    if (mgr.locked) return false;
    // volume на входе — позиционная БАЗА (без регулятора); домножаем тут.
    let vol = Number(volume) || 0;
    try { vol *= sfxVol() * sfxGain('shot_' + name); } catch (e) { vol = 0; }
    vol = Math.max(0, Math.min(2, vol));
    if (!(vol > 0.001)) return false;
    const key = name;
    if (!_bufCache[key]) _bufCache[key] = _noiseBuffer(ctx, 0.5);
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = vol * (v.gain || 1);
    // Играем в мастер-цепь Phaser (кран громкости/мут работают),
    // запасной вариант — напрямую в выход.
    try {
      const dest = mgr.masterGain || mgr.masterVolumeNode || mgr.volumeNode || mgr.destination || ctx.destination;
      out.connect(dest);
    } catch (e) { out.connect(ctx.destination); }
    const tail = Math.max(0.15, Math.min(0.4, Number(v.tail) || 0.25));
    // Живость: каждый выстрел чуть свой (±6% тембра) — очередь не
    // пулемётит одинаковым сэмплом, а несколько стволов не складываются
    // в один «удар палкой по бочке».
    const jit = () => 0.94 + Math.random() * 0.12;
    const lp0 = Math.max(800, (Number(v.lp0) || 4500) * jit());
    const punch0 = Math.max(50, (Number(v.punch) || 110) * jit());
    const mech = (v.mech && Number.isFinite(+v.mech.f)) ? v.mech : null;
    // Слой 1 — атака: короткий яркий щелчок (bandpass на старте тела).
    try {
      const aSrc = ctx.createBufferSource();
      aSrc.buffer = _bufCache[key];
      aSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      try { bp.Q.value = 0.8; } catch (e) {}
      bp.frequency.setValueAtTime(lp0, t0);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(1, t0);
      ag.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
      aSrc.connect(bp);
      bp.connect(ag);
      ag.connect(out);
      aSrc.start(t0);
      aSrc.stop(t0 + 0.07);
    } catch (e) {}
    // Слой 2 — тело: плотный шум через спадающий lowpass (сам «выстрел»).
    const src = ctx.createBufferSource();
    src.buffer = _bufCache[key];
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lp0, t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, lp0 * 0.08), t0 + tail);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + tail);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(out);
    src.start(t0);
    src.stop(t0 + tail + 0.05);
    // Слой 3 — хвост: бас вниз (грудь, дальность). Форма своя:
    // triangle злее (М60), sine круглее.
    try {
      const osc = ctx.createOscillator();
      osc.type = v.thump === 'triangle' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(punch0, t0);
      osc.frequency.exponentialRampToValueAtTime(38, t0 + Math.min(0.3, tail));
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.9, t0);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + Math.min(0.32, tail + 0.03));
      osc.connect(og);
      og.connect(out);
      osc.start(t0);
      osc.stop(t0 + Math.min(0.34, tail + 0.05));
    } catch (e) {}
    // Слой 4 — лязг затвора: короткий металлический тик сразу за атакой.
    // Частота/добротность свои у каждого ствола — подпись голоса.
    if (mech) {
      try {
        const mSrc = ctx.createBufferSource();
        mSrc.buffer = _bufCache[key];
        mSrc.loop = true;
        const mf = ctx.createBiquadFilter();
        mf.type = 'bandpass';
        try { mf.Q.value = Math.max(0.5, Number(mech.q) || 1.5); } catch (e) {}
        mf.frequency.setValueAtTime(Math.max(200, (+mech.f || 2400) * jit()), t0);
        const mg = ctx.createGain();
        const t1 = t0 + 0.008;
        mg.gain.setValueAtTime(Math.max(0.05, Number(mech.g) || 0.4), t1);
        mg.gain.exponentialRampToValueAtTime(0.001, t1 + 0.05);
        mSrc.connect(mf);
        mf.connect(mg);
        mg.connect(out);
        mSrc.start(t1);
        mSrc.stop(t1 + 0.08);
      } catch (e) {}
    }
    return true;
  } catch (e) { return false; }
}

// Свист взмаха для ближнего боя без записей (нож, топор): шум через
// bandpass вверх. Катана/мачете играют файлами (см. meleeSwing).
export function playSynthSwing(scene, name, volume) {
  try {
    const v = SWISH[name];
    if (!v) return false;
    const mgr = scene && scene.sound;
    const ctx = mgr && mgr.context;
    if (!ctx || typeof ctx.createBufferSource !== 'function') return false;
    if (mgr.locked) return false;
    // Свист тоже мимо патча — регулятор применяем вручную.
    let vol = Number(volume) || 0;
    try { vol *= sfxVol(); } catch (e) { vol = 0; }
    vol = Math.max(0, Math.min(2, vol));
    if (!(vol > 0.001)) return false;
    if (!_swishCache[name]) _swishCache[name] = _noiseBuffer(ctx, 0.3);
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = vol * (v.gain || 1);
    try {
      const dest = mgr.masterGain || mgr.masterVolumeNode || mgr.volumeNode || mgr.destination || ctx.destination;
      out.connect(dest);
    } catch (e) { out.connect(ctx.destination); }
    const src = ctx.createBufferSource();
    src.buffer = _swishCache[name];
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    try { bp.Q.value = 1.2; } catch (e) {}
    bp.frequency.setValueAtTime(v.from, t0);
    bp.frequency.exponentialRampToValueAtTime(v.to, t0 + v.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + v.dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + v.dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(t0);
    src.stop(t0 + v.dur + 0.05);
    return true;
  } catch (e) { return false; }
}
