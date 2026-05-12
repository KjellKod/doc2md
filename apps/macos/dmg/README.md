# doc2md DMG Artwork

`doc2md-dmg-background.png` is the committed DMG background used by `dmgbuild`-generated Finder metadata for the Mac drag-install DMG.

- Dimensions: `720x460` pixels.
- Format: PNG, RGB, non-interlaced.
- Intended layout: `doc2md.app` on the left, `Applications` on the right, with the background aligned to the package script's `720x460` Finder window.
- Source boundary: keep this file under `apps/macos/dmg/`, outside `apps/macos/doc2md/Resources/` and outside the Xcode target. `dmgbuild` copies it into the mounted volume as `.background.png` only; it must not be bundled into `doc2md.app/Contents/Resources/`.

Regenerate the PNG only when the Finder window size or installer visual language changes. After regenerating, run:

```bash
file apps/macos/dmg/doc2md-dmg-background.png
test -f apps/macos/dmg/doc2md-dmg-background.png
```

After a Release app build, assert the artwork was not bundled into the app:

```bash
test ! -e .build/mac/Build/Products/Release/doc2md.app/Contents/Resources/doc2md-dmg-background.png
```
