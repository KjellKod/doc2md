# doc2md App Icon Source

`doc2md-icon-1024.png` is the committed 1024x1024 source export for the macOS app icon.

The icon uses a document-to-Markdown conversion motif: a document page, a transform arrow, and a small `# md` mark. It intentionally avoids cloud/upload imagery and is maintainer-replaceable if final visual approval calls for different art.

After replacing the 1024x1024 PNG, regenerate the Xcode asset catalog slots from the repo root:

```bash
bash scripts/generate-mac-icons.sh
```

Do not add this source directory to `doc2md.xcodeproj`; only `Resources/Assets.xcassets` is bundled into the app.
