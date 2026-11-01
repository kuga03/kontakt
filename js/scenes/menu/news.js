import { gameW } from '../../ui/layout.js?v=3';

// Новости игры. Пока без бэкенда — статический список (дата, заголовок, текст).
// Открывается кнопкой «НОВОСТИ» в главном меню.
const NEWS = [
  {
    date: '18.10.2026',
    title: 'Гибкие настройки',
    text: 'В настройках появились переназначение клавиш, качество графики, отключение тряски камеры и вибрация. Клавиши меняются в разделе «УПРАВЛЕНИЕ», качество применяется после перезагрузки.'
  },
  {
    date: '10.10.2026',
    title: 'Баланс и мутаторы',
    text: 'Переработаны ивенты выходных: мутаторы теперь дают больше наград, а полоска прогресса стала заметнее. Проверь кнопку ивента в главном меню.'
  },
  {
    date: '02.10.2026',
    title: 'Банда и контракты',
    text: 'Бои банды больше не зависят от настроек свободной игры: свой состав, карта и сложность. В окне банды видны контракты и казна района.'
  },
  {
    date: '24.09.2026',
    title: 'Медали и ежедневка',
    text: 'Медали теперь выдаются за эффективность, а не за объём: K/D и доля команды. Ежедневный подарок ждёт каждый день — не пропусти стрик.'
  }
];

export function _openNewsModal() {
  if (this._newsModal) return;
  const cx = gameW(this) / 2, cy = 360;
  const W = 820, H = 560;
  const elems = [];
  const overlay = this.add.rectangle(cx, cy, gameW(this), 720, 0x000000, 0.7).setDepth(200);
  overlay.setInteractive();
  const bg = this.add.rectangle(cx, cy, W, H, 0x14142e, 1).setDepth(201)
    .setStrokeStyle(2, 0x8fb8ff, 1);
  elems.push(overlay, bg);
  elems.push(this.add.text(cx, cy - H / 2 + 28, 'НОВОСТИ', {
    fontSize: '24px', color: '#8fb8ff', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(202));

  // Список новостей: заголовок слева, дата у правого края (одной строкой —
  // раньше дата была слева и при 13px bold налезала на заголовок).
  let y = cy - H / 2 + 74;
  NEWS.forEach((n) => {
    elems.push(this.add.text(cx - W / 2 + 30, y, n.title, {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(202));
    elems.push(this.add.text(cx + W / 2 - 30, y + 2, n.date, {
      fontSize: '12px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(202));
    const body = this.add.text(cx - W / 2 + 30, y + 26, n.text, {
      fontSize: '14px', color: '#c8c8d8',
      wordWrap: { width: W - 70 }, lineSpacing: 4
    }).setOrigin(0, 0).setDepth(202);
    elems.push(body);
    y += 26 + body.displayHeight + 22;
  });

  const closeBtn = this.add.text(cx, cy + H / 2 - 34, 'ЗАКРЫТЬ', {
    fontSize: '15px', color: '#ffffff', backgroundColor: '#553333', padding: 8
  }).setOrigin(0.5).setDepth(202);
  elems.push(closeBtn);
  closeBtn.setInteractive({ useHandCursor: true });
  const close = () => {
    elems.forEach(o => { try { o.destroy(); } catch (e) {} });
    this._newsModal = null;
  };
  closeBtn.on('pointerdown', close);
  overlay.on('pointerdown', close);
  this._newsModal = { elems, close };
}

export function _closeNewsModal() {
  const m = this._newsModal;
  if (!m) return;
  m.elems.forEach(o => { try { o.destroy(); } catch (e) {} });
  this._newsModal = null;
}
