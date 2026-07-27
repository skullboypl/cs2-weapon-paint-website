# Paint kits (Phase 2)

Real float/seed preview needs CS2 paint-kit assets extracted with
[Source 2 Viewer / VRF](https://github.com/ValveResourceFormat/ValveResourceFormat).

## Layout (optional, per kit)

```
public/data/paint-kits/{weapon_name}/{paint_id}.json
public/data/paint-kits/{weapon_name}/{paint_id}_pattern.png
public/data/paint-kits/{weapon_name}/{paint_id}_wear.png
```

Example JSON:

```json
{
  "finishStyle": "hydrographic",
  "pattern": "./123_pattern.png",
  "wearMask": "./123_wear.png",
  "floatMin": 0.0,
  "floatMax": 1.0
}
```

Until kits exist, `paintKitPreview.js` applies an approximate wear/seed effect on
LielXD UV textures (UV offset + wear darkening). Stickers still use projected materials.

Do not commit Valve game assets to the public repo.
