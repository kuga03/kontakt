// assets.mjs — заглушки ассетов для headless-прогона.
// Реальные текстуры в Node не декодируются (jsdom без canvas-пакета), а для
// обучения визуал не нужен: важны физика, состояние и ИИ.
// TextureManager.boot добавляет __DEFAULT/__MISSING/__WHITE через addBase64
// (data-URI -> Image -> onload). В jsdom onload не приходит, поэтому меняем
// addBase64 на мгновенную пустую canvas-текстуру и сразу декрементим _pending.
export function stubAssets(Phaser) {
  const TM = Phaser.Textures.TextureManager.prototype;

  function blankCanvas(w = 32, h = 32) {
    const c = globalThis.document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  TM.addBase64 = function (key, data) {
    try { this.addCanvas(key, blankCanvas()); } catch (e) { /* текстура не критична */ }
    try { this.updatePending(); } catch (e) { /* boot ещё не начался */ }
    return this;
  };

  const origGet = TM.get;
  TM.get = function (key) {
    if (typeof key === 'string') {
      let t = origGet.call(this, key);
      if (!t) t = origGet.call(this, '__MISSING') || origGet.call(this, '__DEFAULT');
      return t;
    }
    return origGet.call(this, key);
  };

  const T = Phaser.Textures.Texture.prototype;
  const origTGet = T.get;
  T.get = function (name) {
    const f = origTGet.call(this, name);
    if (!f) return origTGet.call(this, '__BASE');
    return f;
  };
}
