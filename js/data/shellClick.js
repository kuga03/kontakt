import { sfxVol } from './audio.js';

// Поштучное клацанье трубки без файлов: щелчок синтезируется через
// WebAudio (контекст Phaser) — шумовой burst через bandpass + короткий
// металлический тон. У каждого безмагазинного ствола свой профиль
// (высота/длит./одинарный-двойной), так что на слух различимы.
// Звук НИКОГДА не должен ронять игру — весь тракт в try/catch,
// при locked/suspended контекст молча пропускаем.

// freq — центр bandpass шума, q — добротность, dur — длина щелчка (с),
// tone — частота металлического призвука, toneVol — его громкость,
// second — второй удар (помпа/рычаг): { dFreq, gap }.
const PROFILES = {
  // Помпа: «ка-чак» — низкий отвод + высокий досыл.
  Remington:  { freq: 1400, q: 1.1, dur: 0.09, tone: 300, toneVol: 0.5, second: { dFreq: 900, gap: 0.06 } },
  // Полуавтомат: один плотный клац.
  Benelli_M4: { freq: 2000, q: 1.5, dur: 0.07, tone: 380, toneVol: 0.4 },
  // Переломка: глухой стук казённика.
  'обрез':    { freq: 800, q: 0.7, dur: 0.12, tone: 160, toneVol: 0.6 },
  // Рычаг: быстрое двойное тик-тик.
  Winchester: { freq: 2800, q: 2.0, dur: 0.05, tone: 620, toneVol: 0.35, second: { dFreq: 600, gap: 0.045 } },
  // Обойма: высокий лязг + призвук.
  M1918:      { freq: 2500, q: 1.8, dur: 0.08, tone: 520, toneVol: 0.45 },
  // Барабан: короткий высокий тик собачки.
  revolver:   { freq: 4500, q: 4.0, dur: 0.04, tone: 1100, toneVol: 0.3 },
  // Граник: тяжёлый глухой встав.
  RPG:        { freq: 450, q: 0.7, dur: 0.15, tone: 110, toneVol: 0.7 },
};

const FALLBACK = { freq: 2000, q: 1.5, dur: 0.07, tone: 400, toneVol: 0.4 };

// Общий шумовой буфер на контекст (не печём шум на каждый щелчок).
let _noiseCtx = null;
let _noiseBuf = null;
function noiseBuf(ctx) {
  if (_noiseCtx === ctx && _noiseBuf) return _noiseBuf;
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.25));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  _noiseCtx = ctx;
  _noiseBuf = buf;
  return buf;
}

function burst(ctx, out, prof, freq, when, peak) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, when);
  bp.Q.setValueAtTime(prof.q, when);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + prof.dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(when, Math.random() * 0.1);
  src.stop(when + prof.dur + 0.02);
}

function ping(ctx, out, prof, when, peak) {
  if (!(prof.tone > 0)) return;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(prof.tone, when);
  const g = ctx.createGain();
  const td = Math.min(prof.dur, 0.06);
  g.gain.setValueAtTime(peak * prof.toneVol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + td);
  o.connect(g);
  g.connect(out);
  o.start(when);
  o.stop(when + td + 0.02);
}

// Щелчок заряженного патрона. Возвращает true если сыграло.
// x, y — для позиционной громкости (как у остальных sfx через _sfxVolAt).
export function playShellClick(scene, weaponName, x, y) {
  try {
    if (!scene || !scene.sound || scene.sound.locked) return false;
    const ctx = scene.sound.context;
    if (!ctx || typeof ctx.createBuffer !== 'function') return false;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
      if (ctx.state === 'suspended') return false;
    }
    const prof = PROFILES[weaponName] || FALLBACK;
    // Щелчок идёт прямым WebAudio мимо патча sound.play,
    // поэтому регулятор применяем вручную в ОБЕИХ ветках
    // (раньше позиционная ветка его игнорила — при 0% клацало).
    let vol = 0;
    try {
      if (scene && typeof scene._sfxVolAt === 'function' && Number.isFinite(x) && Number.isFinite(y)) {
        vol = scene._sfxVolAt(x, y, 0.4) * sfxVol();
      } else {
        vol = 0.4 * sfxVol();
      }
    } catch (e) {
      try { vol = 0.4 * sfxVol(); } catch (e2) { vol = 0; }
    }
    if (!(vol > 0.001)) return false;
    const t0 = ctx.currentTime || 0;
    const out = ctx.createGain();
    out.gain.setValueAtTime(vol, t0);
    out.connect(ctx.destination);
    burst(ctx, out, prof, prof.freq, t0, 1.0);
    ping(ctx, out, prof, t0, 0.6);
    if (prof.second) {
      const t1 = t0 + prof.second.gap;
      burst(ctx, out, prof, prof.freq + prof.second.dFreq, t1, 0.9);
      ping(ctx, out, prof, t1, 0.5);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// --- Перезарядка магазинного оружия ---
// У трубок (noMag) звук уже есть — поштучные playShellClick.
// У магазинов reload() был немым таймером — здесь staged-последовательность
// (выход магазина → вставка → затвор). Семейства задают характер
// (пистолет звонко, пулемёт глухо), детюн по имени делает каждый ствол
// чуть своим. Тайминги — долями delayMs, т.е. масштабируются
// reloadTime×reloadMult (и перками) сами. Последний щелчок всегда
// раньше конца перезарядки — затвор успевает до готовности.

// weaponName → семейство. Нет записи — 'rifle'.
const RELOAD_FAMILY = {
  Makarov: 'pistol', Glock: 'pistol', M1911: 'pistol', Deagle: 'pistol',
  UZI: 'smg', P90: 'smg',
  'AK-47': 'rifle', bad_ak47: 'rifle', 'М16': 'rifle', AUG: 'rifle',
  SIG_SG_550: 'rifle', SIG_SG_543: 'rifle', Sturmgewehr_44: 'rifle',
  'М1913': 'rifle', 'Neuhausen KE-7': 'rifle',
  M249: 'lmg', 'М60': 'lmg', 'Vickers K': 'lmg',
  SSG: 'bolt', LAR: 'bolt', VKS: 'bolt', Barrett_M82: 'bolt', Remington_700: 'bolt',
  'Сайга': 'scatter',
  minigun: 'heavy',
};

// Стадия: at — доля delayMs; freq/q/dur/tone/toneVol — как в PROFILES;
// peak — удар первого щелчка (0..1); second — второй удар пары.
const RELOAD_STAGES = {
  pistol: [
    { at: 0.12, freq: 2500, q: 1.6, dur: 0.06, tone: 420, toneVol: 0.4, peak: 0.8 },
    { at: 0.52, freq: 1700, q: 1.2, dur: 0.08, tone: 280, toneVol: 0.55, peak: 1.0 },
    { at: 0.85, freq: 3300, q: 2.0, dur: 0.05, tone: 720, toneVol: 0.35, peak: 0.85 },
  ],
  smg: [
    { at: 0.12, freq: 2100, q: 1.4, dur: 0.07, tone: 360, toneVol: 0.45, peak: 0.8 },
    { at: 0.52, freq: 1600, q: 1.1, dur: 0.08, tone: 260, toneVol: 0.55, peak: 1.0 },
    { at: 0.85, freq: 2900, q: 1.8, dur: 0.05, tone: 640, toneVol: 0.35, peak: 0.85, second: { dFreq: 500, gap: 0.05 } },
  ],
  rifle: [
    { at: 0.12, freq: 1500, q: 1.1, dur: 0.09, tone: 300, toneVol: 0.5, peak: 0.85 },
    { at: 0.52, freq: 1200, q: 0.9, dur: 0.10, tone: 240, toneVol: 0.6, peak: 1.0 },
    { at: 0.85, freq: 2600, q: 1.8, dur: 0.06, tone: 520, toneVol: 0.4, peak: 0.9, second: { dFreq: -400, gap: 0.055 } },
  ],
  lmg: [
    { at: 0.10, freq: 900, q: 0.8, dur: 0.12, tone: 180, toneVol: 0.6, peak: 0.85 },
    { at: 0.35, freq: 700, q: 0.7, dur: 0.12, tone: 140, toneVol: 0.6, peak: 0.8 },
    { at: 0.60, freq: 1000, q: 0.9, dur: 0.10, tone: 200, toneVol: 0.6, peak: 1.0 },
    { at: 0.87, freq: 1900, q: 1.4, dur: 0.08, tone: 380, toneVol: 0.4, peak: 0.9, second: { dFreq: 300, gap: 0.07 } },
  ],
  bolt: [
    { at: 0.10, freq: 2200, q: 1.5, dur: 0.06, tone: 400, toneVol: 0.4, peak: 0.75 },
    { at: 0.35, freq: 1500, q: 1.1, dur: 0.08, tone: 280, toneVol: 0.5, peak: 0.85 },
    { at: 0.62, freq: 2600, q: 1.8, dur: 0.06, tone: 520, toneVol: 0.4, peak: 1.0 },
    { at: 0.87, freq: 1800, q: 1.3, dur: 0.06, tone: 340, toneVol: 0.4, peak: 0.6 },
  ],
  scatter: [
    { at: 0.12, freq: 1400, q: 1.1, dur: 0.09, tone: 280, toneVol: 0.5, peak: 0.85 },
    { at: 0.52, freq: 1100, q: 0.9, dur: 0.10, tone: 220, toneVol: 0.6, peak: 1.0 },
    { at: 0.85, freq: 2000, q: 1.5, dur: 0.07, tone: 420, toneVol: 0.4, peak: 0.9, second: { dFreq: 600, gap: 0.05 } },
  ],
  heavy: [
    { at: 0.08, freq: 600, q: 0.7, dur: 0.14, tone: 110, toneVol: 0.65, peak: 0.85 },
    { at: 0.35, freq: 500, q: 0.7, dur: 0.14, tone: 100, toneVol: 0.65, peak: 0.8 },
    { at: 0.60, freq: 800, q: 0.8, dur: 0.12, tone: 150, toneVol: 0.6, peak: 1.0 },
    { at: 0.88, freq: 1600, q: 1.3, dur: 0.08, tone: 300, toneVol: 0.4, peak: 0.9, second: { dFreq: 200, gap: 0.06 } },
  ],
};

// Детерминированная расстройка 0.94–1.06 по имени — каждый ствол чуть свой.
function _detune(name) {
  try {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return 0.94 + (Math.abs(h) % 13) * 0.01;
  } catch (e) { return 1; }
}

function _reloadStage(ctx, vol, st, dt) {
  try {
    if (!ctx || ctx.state === 'suspended') return;
    if (!(vol > 0.001)) return;
    const t0 = ctx.currentTime || 0;
    const out = ctx.createGain();
    out.gain.setValueAtTime(vol, t0);
    out.connect(ctx.destination);
    const prof = { q: st.q, dur: st.dur, tone: st.tone, toneVol: st.toneVol };
    burst(ctx, out, prof, Math.max(60, st.freq * dt), t0, st.peak || 0.9);
    ping(ctx, out, prof, t0, 0.55);
    if (st.second) {
      const t1 = t0 + st.second.gap;
      burst(ctx, out, prof, Math.max(60, st.freq * dt + st.second.dFreq), t1, 0.8);
      ping(ctx, out, prof, t1, 0.45);
    }
  } catch (e) {}
}

// Ставит staged-звук перезарядки. Возвращает хендлы таймеров —
// владелец (Weapon) гасит их при отмене; сцена фризит scene-таймеры
// на паузе вместе с таймером самой перезарядки.
export function playReloadSequence(scene, weaponName, x, y, delayMs) {
  try {
    if (!scene || !scene.sound || scene.sound.locked) return [];
    const ctx = scene.sound.context;
    if (!ctx || typeof ctx.createBuffer !== 'function') return [];
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
      if (ctx.state === 'suspended') return [];
    }
    // Громкость — как у щелчка трубки (позиционная × регулятор).
    let vol = 0;
    try {
      if (scene && typeof scene._sfxVolAt === 'function' && Number.isFinite(x) && Number.isFinite(y)) {
        vol = scene._sfxVolAt(x, y, 0.42) * sfxVol();
      } else {
        vol = 0.42 * sfxVol();
      }
    } catch (e) {
      try { vol = 0.42 * sfxVol(); } catch (e2) { vol = 0; }
    }
    if (!(vol > 0.001)) return [];
    const delay = Math.max(400, Number(delayMs) || 2000);
    const fam = RELOAD_FAMILY[weaponName] || 'rifle';
    const stages = RELOAD_STAGES[fam] || RELOAD_STAGES.rifle;
    const dt = _detune(weaponName);
    const useSceneTimer = !!(scene.time && typeof scene.time.delayedCall === 'function');
    const timers = [];
    stages.forEach(st => {
      // Последний щелчок — до конца перезарядки (затвор раньше готовности).
      const ms = Math.max(80, Math.min(delay - 140, Math.round(st.at * delay)));
      const h = useSceneTimer
        ? scene.time.delayedCall(ms, () => _reloadStage(ctx, vol, st, dt))
        : setTimeout(() => _reloadStage(ctx, vol, st, dt), ms);
      timers.push(h);
    });
    return timers;
  } catch (e) { return []; }
}

export function clearReloadSfx(timers) {
  try {
    (timers || []).forEach(h => {
      try {
        if (!h) return;
        if (typeof h.remove === 'function') h.remove();
        else clearTimeout(h);
      } catch (e) {}
    });
  } catch (e) {}
}
