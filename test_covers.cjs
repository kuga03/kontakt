const fs = require('fs');
let c1 = fs.readFileSync('js/data/flankGen.js', 'utf8').replace(/import [^;]+;/g, '').replace(/export /g, '');
let c2 = fs.readFileSync('js/data/campaignMaps.js', 'utf8').replace(/import [^;]+;/g, '').replace(/export /g, '');
const sandbox = { console };
const code = c1 + '\n' + c2 + '\n' + `
for (let id = 1; id <= 20; id++) {
  const width = (id === 6 ? 2800 : id === 7 ? 3000 : 3000);
  const data = genCampaignMapData(id, width, 900, 'KOTH', 'pustoch');
  const pts = (data.kothPoints && data.kothPoints.length) ? data.kothPoints : [
    { name: 'A', x: Math.round(width * 0.25) },
    { name: 'B', x: Math.round(width * 0.5) },
    { name: 'C', x: Math.round(width * 0.75) }
  ];
  pts.forEach(p => {
    const covers = data.objects.filter(o => o.type === 'cover' || o.type === 'crate');
    covers.forEach(c => {
      const left = c.x - c.w / 2;
      const right = c.x + c.w / 2;
      const top = c.y - c.h / 2;
      const bottom = c.y + c.h / 2;
      // Capture zone radius is typically 80-100px, or point is at (p.x, y)
      if (p.x >= left && p.x <= right) {
        console.log('Level id:', id, 'Point', p.name, 'x=' + p.x, 'INSIDE cover at x=' + c.x, 'w=' + c.w, 'left=' + left, 'right=' + right, 'y=' + c.y, 'h=' + c.h, 'top=' + top, 'bottom=' + bottom);
      }
    });
  });
}
`;
const vm = require('vm');
vm.runInNewContext(code, sandbox);
