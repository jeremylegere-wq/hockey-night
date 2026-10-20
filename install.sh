#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/nhl-hub-app"
mkdir -p "$DEST" "$HOME/.local/bin" "$HOME/.local/share/applications"
cp -r "$DIR/VERSION" "$DIR/server.py" "$DIR/demo.py" "$DIR/web" "$DIR/nhl-hub" "$DIR/icon.png" "$DIR/icon.svg" "$DEST/"
[ -f "$DEST/config.json" ] || cp "$DIR/config.json" "$DEST/config.json"
chmod +x "$DEST/nhl-hub"
ln -sf "$DEST/nhl-hub" "$HOME/.local/bin/nhl-hub"

# icon for the app grid (theme lookup) and a desktop shortcut
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps" "$HOME/.local/share/icons/hicolor/scalable/apps"
cp "$DIR/icon.png" "$HOME/.local/share/icons/hicolor/256x256/apps/nhl-hub.png"
cp "$DIR/icon.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/nhl-hub.svg"
cat > "$HOME/.local/share/applications/nhl-hub.desktop" <<D
[Desktop Entry]
Type=Application
Name=Hockey Night
Comment=Full-screen NHL scores, box scores, standings
Exec=$DEST/nhl-hub
Icon=$DEST/icon.png
Terminal=false
Categories=Sports;
StartupNotify=false
D
DESK="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$DESK" ]; then
  cp "$HOME/.local/share/applications/nhl-hub.desktop" "$DESK/Hockey Night.desktop"
  chmod +x "$DESK/Hockey Night.desktop"
  gio set "$DESK/Hockey Night.desktop" metadata::trusted true 2>/dev/null || true
  echo "Desktop icon added: $DESK/Hockey Night.desktop (if it shows a padlock/warning, right-click it and choose 'Allow Launching')"
fi
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
echo "Hockey Night v$(cat "$DIR/VERSION") installed. Launch 'Hockey Night' from the desktop icon, the app grid, or run: nhl-hub   (nhl-hub --demo for sample data)"
echo "Edit favourite team / video sources in $DEST/config.json"
