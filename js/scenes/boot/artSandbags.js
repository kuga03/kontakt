// artSandbags.js — мешки с песком: только мешки, холст прозрачный (без подложки,
// без балок, кирпичей и щебня). Три ряда «кирпичом»: 5 + 4 + 3 с горкой вверху.
// Контур тёмный и тонкий — мешки читаются на любом фоне.
export function drawSandbags(ctx, W, H, rnd) {
  const cols = ['#c2b185', '#b29f72', '#cbbb92', '#a89670'];
  const bag = (cx, cy, w, h) => {
    const col = cols[Math.floor(rnd() * cols.length)];
    const hw = w / 2, hh = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rnd() - 0.5) * 0.08);
    // форма мешка: подушка с прищипами по углам
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.quadraticCurveTo(-hw * 1.06, -hh * 1.1, -hw * 0.6, -hh);
    ctx.quadraticCurveTo(0, -hh * 1.14, hw * 0.6, -hh);
    ctx.quadraticCurveTo(hw * 1.06, -hh * 1.1, hw, 0);
    ctx.quadraticCurveTo(hw * 1.06, hh * 1.1, hw * 0.6, hh);
    ctx.quadraticCurveTo(0, hh * 1.14, -hw * 0.6, hh);
    ctx.quadraticCurveTo(-hw * 1.06, hh * 1.1, -hw, 0);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    // тень внизу мешка
    ctx.fillStyle = 'rgba(40,30,15,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, hh * 0.45, hw * 0.85, hh * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // блик по верхней кромке (без шва — шов давал «улыбку»)
    ctx.strokeStyle = 'rgba(255,240,210,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, -hh * 0.55);
    ctx.quadraticCurveTo(0, -hh * 0.8, hw * 0.5, -hh * 0.55);
    ctx.stroke();
    // контур
    ctx.strokeStyle = 'rgba(20,16,10,0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };
  const bw = 46, bh = 28;
  // Низ пирамиды прижат к нижней кромке холста (зазор 2px): спрайт
  // масштабируется по высоте укрытия, и прежние 12px прозрачности внизу
  // поднимали мешки над землёй — выглядели парящими.
  const baseY = H - 4 - bh / 2;
  for (let i = 0; i < 5; i++) bag(30 + i * 46, baseY, bw, bh);
  for (let i = 0; i < 4; i++) bag(53 + i * 46, baseY - bh + 6, bw, bh);
  for (let i = 0; i < 3; i++) bag(76 + i * 46, baseY - 2 * bh + 12, bw, bh);
}
