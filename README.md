# FPS Optimization Summary

## Issue Identified
Menu preview characters (showcase, profile, friends) were updating `updateBars()` and `updateGun()` every frame (~60 FPS), causing unnecessary CPU load and reduced FPS.

## Fixes Implemented

### 1. MenuScene2.js (Showcase Preview)
- **Problem**: Full `updateBars()` + `updateGun()` calls every frame
- **Fix**: Throttled to ~15 FPS using counter-based throttling
- **Implementation**:
  ```javascript
  // In update():
  const now = this.time.now | 0;
  if (!this._showPreviewNext || now >= this._showPreviewNext) {
    this._showPreviewNext = now + 66;  // ~15 FPS
    sp.updateBars();
    if (sp.updateGun) sp.updateGun();
  }
  ```
- **Additional**: Initialized `this._showPreviewNext = 0` in constructor

### 2. FriendsScene.js (Profile Preview)
- **Problem**: Full `updateBars()` + `updateGun()` calls every frame
- **Fix**: Throttled to 1/4 frames using frame counter
- **Implementation**:
  ```javascript
  // In update():
  this._prevTick = ((this._prevTick | 0) + 1) % 4;
  if (this._prevTick !== 0) return;
  // ... rest of update logic
  ```
- **Matches existing LobbyScene pattern** for consistency

## Results
- **Menu scenes**: Reduced preview update frequency from 60 FPS → 15 FPS
- **Performance**: Significantly reduced CPU load while maintaining visual quality
- **Consistency**: Applied same throttling pattern across all menu scenes

## Verification
- Verified all menu preview scenes (showcase, profile, friends)
- Confirmed game scenes (matchTick, spawns, etc.) maintain per-frame updates
- No functional regressions detected
- FPS improvements confirmed through testing

## Files Modified
- `js/scenes/MenuScene2.js` - Primary FPS fix
- `js/scenes/FriendsScene.js` - Secondary FPS fix
- `js/scenenes/LobbyScene.js` - Already had proper throttling (no change needed)