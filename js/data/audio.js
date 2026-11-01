import { gameState } from './gameState.js?v=171';

// Громкость музыки и звуков (0..1, 0 = Выкл). Хранится в gameState.
export function musicVol() {
  const v = +gameState.musicVol;
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export function sfxVol() {
  const v = +gameState.sfxVol;
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export function volLabel(v) {
  return v <= 0 ? 'Выкл' : `${Math.round(v * 100)}%`;
}

// Поштучные триммеры громкости (множитель к БАЗЕ, до регулятора).
// Разные mp3 нормализованы по-разному + базы разбросаны по коду,
// поэтому выравниваем здесь, в одном месте (п.4: одна механика — один модуль).
// Ключ — точный ключ звука (shot_<имя> / sfx_*). Нет записи = ×1.
export const SFX_GAIN = {
  'shot_minigun': 1.5,
};

export function sfxGain(key) {
  try {
    const g = SFX_GAIN[String(key || '')];
    return Number.isFinite(+g) && +g > 0 ? +g : 1;
  } catch (e) { return 1; }
}

// Последняя известная БАЗОВАЯ громкость (до умножения на регулятор) по ключу.
// Страховка: если инстанс создан мимо патча (без штампа __baseVol),
// живое обновление всё равно считает от базы, а не от текущей громкости
// (иначе каждое движение слайдера множит текущую — сход к нулю,
// а после Выкл 0 × что угодно = 0 навсегда).
const baseByKey = new Map();

// Глобальный кран громкости: все звуки идут через менеджер (this.sound),
// категории делим по префиксу ключа (mus_* — музыка, остальное — звуки).
// Вызывается один раз из BootScene.create — покрывает все сцены и будущие вызовы.
export function applyVolumePatch(sound) {
  if (!sound || sound.__volPatched) return;
  try {
    const orig = sound.play.bind(sound);
    sound.play = (key, config) => {
      const c = { ...(config || {}) };
      const base = typeof c.volume === 'number' ? c.volume : 1;
      const k = String(key || '');
      const isMus = k.startsWith('mus_');
      const cat = isMus ? musicVol() : sfxVol();
      const g = isMus ? 1 : sfxGain(k);
      c.volume = base * g * cat;
      if (c.volume <= 0.001) return null;
      const started = orig(key, c);
      // ВАЖНО: SoundManager.play возвращает boolean, а не инстанс
      // (см. исходник Phaser 3.60), поэтому штамп __baseVol ставим не на
      // результат, а на реальный объект: самый свежий играющий с тем же
      // ключом без штампа (play синхронен — наш инстанс уже в sounds).
      // Без этого refreshLiveVolumes считал базу от ТЕКУЩЕЙ громкости:
      // убавление множило само себя, а Выкл уже не поднимался никогда.
      try {
        baseByKey.set(k, base);
        if (sound.sounds) {
          for (let i = sound.sounds.length - 1; i >= 0; i--) {
            const s = sound.sounds[i];
            if (s && s.key === k && s.isPlaying && typeof s.__baseVol !== 'number') {
              s.__baseVol = base;
              s.__volCat = k.startsWith('mus_') ? 'music' : 'sfx';
              break;
            }
          }
        }
      } catch (e) {}
      return started;
    };
    sound.__volPatched = true;
  } catch (e) { /* без патча игра не встанет */ }
}

// Пересчитать громкость УЖЕ играющих звуков (слайдеры в настройках).
// Без этого музыка, запущенная раньше, не реагирует на регулятор.
export function refreshLiveVolumes(sound) {
  try {
    if (!sound || !sound.sounds) return;
    sound.sounds.forEach(s => {
      try {
        if (!s || !s.isPlaying || typeof s.setVolume !== 'function') return;
        const skey = String((s.key != null ? s.key : ''));
        // База — со штампа, иначе из карты последних play, и только в крайнем
        // случае текущая громкость (для неё 0 уже смертелен: 0 × vol = 0).
        const base = typeof s.__baseVol === 'number' ? s.__baseVol
          : (baseByKey.has(skey) ? baseByKey.get(skey) : s.volume);
        const cat = s.__volCat || (skey.startsWith('mus_') ? 'music' : 'sfx');
        const g = cat === 'music' ? 1 : sfxGain(skey);
        s.setVolume(base * g * (cat === 'music' ? musicVol() : sfxVol()));
      } catch (e) {}
    });
  } catch (e) {}
}
