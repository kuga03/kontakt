// Слой платформы: local / yandex / vk.
// Сейчас реальных ключей SDK нет, поэтому:
// - детектим среду (iframe VK, YaGames в window),
// - если SDK есть — пробуем его вызвать,
// - если нет — тихо работаем локально, игра не ломается.
// Когда выложишь в Яндекс/VK — сюда только воткнуть init скриптов,
// FriendsScene и сейвы уже говорят с игрой через этот файл.

export function detectPlatform() {
  try {
    if (typeof window !== 'undefined') {
      if (window.vkBridge || (window.location && /vk\.com|vk_apps|m.vk.com/.test(String(window.location.href)))) return 'vk';
      if (window.YaGames || window.ysdk || (window.location && /yandex/.test(String(window.location.href)))) return 'yandex';
      if (window.parent && window.parent !== window) {
        // В iframe без явных маркеров — считаем платформой, но работаем как local.
        return 'iframe';
      }
    }
  } catch (e) {}
  return 'local';
}

export function platformLabel(p) {
  return p === 'vk' ? 'VK Игры'
    : p === 'yandex' ? 'Яндекс Игры'
    : p === 'iframe' ? 'Платформа (iframe)' : 'Локально (этот ПК)';
}

// Кто смотрит игру: имя тянем из SDK, иначе из сейва.
export async function getViewer(getFallbackName) {
  const p = detectPlatform();
  try {
    // VK: реальный вызов появится после подключения vkBridge.
    if (p === 'vk' && window.vkBridge && window.vkBridge.send) {
      const info = await window.vkBridge.send('VKWebAppGetUserInfo', {});
      if (info && (info.first_name || info.id)) {
        return {
          id: 'vk_' + info.id,
          name: String(info.first_name || 'Игрок').slice(0, 16),
          photo: info.photo_200 || null,
          platform: 'vk'
        };
      }
    }
    // Яндекс: реальный вызов появится после YaGames.init().
    if (p === 'yandex' && window.ysdk && window.ysdk.getPlayer) {
      try {
        const pl = await window.ysdk.getPlayer();
        const name = (pl && pl.getName && pl.getName()) || '';
        const pid = (pl && pl.getUniqueID && pl.getUniqueID()) || 'ya';
        let photo = null;
        try { photo = pl.getPhoto ? pl.getPhoto('small') : null; } catch (e) {}
        return { id: 'ya_' + pid, name: (name || 'Игрок').slice(0, 16), photo, platform: 'yandex' };
      } catch (e) { /* гость — упадём в local */ }
    }
  } catch (e) { /* молча — гостевой режим обязателен для модерации */ }
  let fb = 'Игрок';
  try { fb = (typeof getFallbackName === 'function' ? getFallbackName() : getFallbackName) || 'Игрок'; } catch (e) {}
  return { id: 'local', name: String(fb).slice(0, 16), photo: null, platform: p === 'iframe' ? 'iframe' : 'local' };
}

// Друзья с платформы: VK — пикер (разовый выбор, решение не сохраняется),
// Яндекс — списка друзей нет, только сокомандники по лидербордам.
// Возвращаем [] если SDK нет — сцена дорисует локальных.
export async function getPlatformFriends() {
  const p = detectPlatform();
  try {
    if (p === 'vk' && window.vkBridge && window.vkBridge.send) {
      const res = await window.vkBridge.send('VKWebAppGetFriends', { multi: true });
      const users = (res && res.users) || [];
      return users.map(u => ({
        id: 'vk_' + u.id,
        name: String((u.first_name || 'Друг')).slice(0, 16),
        photo: u.photo_200 || null,
        platform: 'vk',
        fromPlatform: true
      }));
    }
  } catch (e) { /* пользователь закрыл пикер — это нормально */ }
  return [];
}

// Позвать друга: VK — инвайт, остальные — подсказка скопировать ссылку.
export async function inviteFriend() {
  const p = detectPlatform();
  try {
    if (p === 'vk' && window.vkBridge && window.vkBridge.send) {
      await window.vkBridge.send('VKWebAppShowInviteBox', {});
      return 'invite-sent';
    }
  } catch (e) {
    return 'cancelled';
  }
  return 'no-sdk';
}

// Облако: пока заглушка поверх localStorage.
// Сюда позже лягут player.setData/getData (Ya) и VKWebAppStorage* (VK)
// без правок в сценах: gameState продолжит ходить через saveGameState,
// а ключ целиком будем зеркалить в облако этим файлом.

// ---- Донат: сейчас недоступен (игра локальная, платить некуда).
// Сигнатуры финальные: после публикации сюда встанут ysdk.payments
// (Яндекс) и VKWebAppShowOrderBox (VK), а магазин продолжит звать
// те же функции — его код не поменяется.
export function donateAvailable() {
  const p = detectPlatform();
  return {
    available: false,
    platform: p,
    reason: 'Донат включится после выхода игры в Яндекс Играх и VK'
  };
}

// Обязательный вызов при каждом запуске для модерации Яндекса:
// дотягивает покупки, где деньги списались, а товар не выдался
// (payments.getPurchases + выдача + consumePurchase).
