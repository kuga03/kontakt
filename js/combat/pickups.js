// pickups.js — спавн подборов (было в GameScene.spawnPickup).
// Принимает сцену + класс Pickup, чтобы не тянуть импорты друг в друга.

export function bindPickupOverlap(scene, bot) {
  if (!bot) return;
  bot._pickupBound = true;
}

export function spawnPickup(scene, PickupClass, type, x, y, weaponName) {
  try {
    if (scene && typeof scene._escapeSolid === 'function') {
      try {
        const p = scene._escapeSolid(x, y);
        x = p.x; y = p.y;
      } catch (e) {}
    }
  } catch (e) {}
  const pickup = new PickupClass(scene, x, y, type, weaponName);
  scene.pickups.add(pickup);
  pickup._col = scene.physics.add.collider(pickup, scene.platforms);
  try {
    pickup._col2 = scene.physics.add.collider(pickup, scene.covers);
  } catch (e) {}
  return pickup;
}
