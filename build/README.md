# Build assets

This directory contains platform-specific build assets for the Reqlet desktop app.

## App icon

Wails expects the following files for platform icons:

| File | Platform | Size |
|------|----------|------|
| `appicon.png` | Source (all platforms) | 512x512 |
| `darwin/AppIcon.icns` | macOS | Multi-resolution |
| `linux/icon.png` | Linux | 256x256 |
| `windows/icon.ico` | Windows | Multi-resolution |

To generate platform icons from the source PNG (requires ImageMagick):

```bash
# macOS (.icns) — requires iconutil (macOS only)
mkdir -p build/darwin/AppIcon.iconset
for size in 16 32 64 128 256 512; do
  convert build/appicon.png -resize ${size}x${size} build/darwin/AppIcon.iconset/icon_${size}x${size}.png
done
iconutil -c icns build/darwin/AppIcon.iconset -o build/darwin/AppIcon.icns

# Linux
convert build/appicon.png -resize 256x256 build/linux/icon.png

# Windows (.ico)
convert build/appicon.png -resize 256x256 build/windows/icon.ico
```

Wails picks up these files automatically during `wails build`.
